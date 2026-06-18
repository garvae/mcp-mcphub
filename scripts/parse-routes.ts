// SPDX-License-Identifier: Apache-2.0

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

type RouterName = 'app' | 'authenticatedRouter' | 'router';
type RouteMethod = 'ALL' | 'DELETE' | 'GET' | 'POST' | 'PUT';

export type ParsedRoute = {
  authenticated: boolean;
  fullPath: string;
  handlerName: string;
  includeInCoverage: boolean;
  line: number;
  method: RouteMethod;
  middlewareNames: string[];
  path: string;
  rawPath: string;
  routerName: RouterName;
  sourceFile: string;
};

type EvaluatedExpression = {
  containsPlaceholder: boolean;
  raw: string;
  resolved: string;
};

type RouteDefinition = Omit<ParsedRoute, 'fullPath'>;

type RouterMount = {
  child: RouterName;
  parent: RouterName;
  prefix: string;
};

const ROUTER_NAMES = new Set<RouterName>(['app', 'authenticatedRouter', 'router']);
const ROUTE_METHODS = new Map<string, RouteMethod>([
  ['all', 'ALL'],
  ['delete', 'DELETE'],
  ['get', 'GET'],
  ['post', 'POST'],
  ['put', 'PUT'],
]);

function normalizePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (normalized === '') {
    return '/';
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function joinPaths(prefix: string, path: string): string {
  if (prefix === '') {
    return normalizePath(path);
  }

  return normalizePath(`${prefix}/${path}`);
}

function toExpressionKey(expression: ts.Expression, sourceFile: ts.SourceFile): string {
  return expression.getText(sourceFile);
}

function evaluateExpression(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  variables: Map<string, EvaluatedExpression>,
): EvaluatedExpression {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return {
      containsPlaceholder: false,
      raw: expression.getText(sourceFile),
      resolved: expression.text,
    };
  }

  if (ts.isIdentifier(expression)) {
    return variables.get(expression.text) ?? {
      containsPlaceholder: true,
      raw: expression.getText(sourceFile),
      resolved: `<${expression.text}>`,
    };
  }

  if (ts.isPropertyAccessExpression(expression)) {
    const key = toExpressionKey(expression, sourceFile);
    if (key === 'config.basePath') {
      return {
        containsPlaceholder: false,
        raw: expression.getText(sourceFile),
        resolved: '',
      };
    }

    return {
      containsPlaceholder: true,
      raw: expression.getText(sourceFile),
      resolved: `<${key}>`,
    };
  }

  if (ts.isTemplateExpression(expression)) {
    let resolved = expression.head.text;
    let containsPlaceholder = false;

    for (const span of expression.templateSpans) {
      const evaluatedSpan = evaluateExpression(span.expression, sourceFile, variables);
      resolved += evaluatedSpan.resolved;
      resolved += span.literal.text;
      containsPlaceholder ||= evaluatedSpan.containsPlaceholder;
    }

    return {
      containsPlaceholder,
      raw: expression.getText(sourceFile),
      resolved,
    };
  }

  return {
    containsPlaceholder: true,
    raw: expression.getText(sourceFile),
    resolved: `<${expression.getText(sourceFile)}>`,
  };
}

function collectArgumentNames(expression: ts.Expression, sourceFile: ts.SourceFile): string[] {
  if (ts.isIdentifier(expression)) {
    return [expression.text];
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return [expression.getText(sourceFile)];
  }

  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.flatMap((element) => {
      return ts.isExpression(element) ? collectArgumentNames(element, sourceFile) : [];
    });
  }

  return [];
}

function getHandlerName(argumentsList: readonly ts.Expression[], sourceFile: ts.SourceFile): string {
  const lastArgument = argumentsList.at(-1);
  if (lastArgument === undefined) {
    return 'unknown';
  }

  if (ts.isIdentifier(lastArgument) || ts.isPropertyAccessExpression(lastArgument)) {
    return lastArgument.getText(sourceFile);
  }

  if (ts.isCallExpression(lastArgument)) {
    return lastArgument.expression.getText(sourceFile);
  }

  return lastArgument.kind === ts.SyntaxKind.ArrayLiteralExpression
    ? 'middleware-array'
    : lastArgument.getText(sourceFile);
}

function computePrefixes(mounts: readonly RouterMount[]): Map<RouterName, string[]> {
  const prefixMap = new Map<RouterName, string[]>([['app', ['']]]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const mount of mounts) {
      const parentPrefixes = prefixMap.get(mount.parent);
      if (parentPrefixes === undefined) {
        continue;
      }

      const childPrefixes = prefixMap.get(mount.child) ?? [];
      const nextPrefixes = new Set(childPrefixes);

      for (const parentPrefix of parentPrefixes) {
        nextPrefixes.add(joinPaths(parentPrefix, mount.prefix));
      }

      if (nextPrefixes.size !== childPrefixes.length) {
        prefixMap.set(mount.child, [...nextPrefixes]);
        changed = true;
      }
    }
  }

  return prefixMap;
}

export function parseRoutesFromSource(sourceText: string, sourceFilePath: string): ParsedRoute[] {
  const sourceFile = ts.createSourceFile(
    sourceFilePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const variables = new Map<string, EvaluatedExpression>();
  const mounts: RouterMount[] = [];
  const routeDefinitions: RouteDefinition[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
      variables.set(node.name.text, evaluateExpression(node.initializer, sourceFile, variables));
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const receiver = node.expression.expression.getText(sourceFile);
      const methodName = node.expression.name.text;

      if (ROUTER_NAMES.has(receiver as RouterName)) {
        const routerName = receiver as RouterName;
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

        if (methodName === 'use') {
          const [firstArg, secondArg] = node.arguments;
          if (firstArg !== undefined && secondArg !== undefined && ts.isIdentifier(secondArg)) {
            const prefix = evaluateExpression(firstArg, sourceFile, variables);
            if (ROUTER_NAMES.has(secondArg.text as RouterName)) {
              mounts.push({
                child: secondArg.text as RouterName,
                parent: routerName,
                prefix: prefix.resolved,
              });
            }
          } else if (firstArg !== undefined && ts.isIdentifier(firstArg) && ROUTER_NAMES.has(firstArg.text as RouterName)) {
            mounts.push({
              child: firstArg.text as RouterName,
              parent: routerName,
              prefix: '',
            });
          }
        }

        const routeMethod = ROUTE_METHODS.get(methodName);
        if (routeMethod !== undefined) {
          const [pathExpression, ...restArguments] = node.arguments;
          if (pathExpression !== undefined) {
            const evaluatedPath = evaluateExpression(pathExpression, sourceFile, variables);
            const middlewareNames = restArguments.flatMap((argument) =>
              collectArgumentNames(argument, sourceFile),
            );
            const authenticated =
              routerName === 'authenticatedRouter' || middlewareNames.includes('auth');

            routeDefinitions.push({
              authenticated,
              handlerName: getHandlerName(restArguments, sourceFile),
              includeInCoverage: !evaluatedPath.containsPlaceholder,
              line,
              method: routeMethod,
              middlewareNames,
              path: evaluatedPath.resolved,
              rawPath: evaluatedPath.raw,
              routerName,
              sourceFile: sourceFilePath,
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const prefixMap = computePrefixes(mounts);

  return routeDefinitions
    .flatMap((route) => {
      const prefixes = prefixMap.get(route.routerName) ?? [''];

      return prefixes.map((prefix) => ({
        ...route,
        fullPath: joinPaths(prefix, route.path),
      }));
    })
    .sort((left, right) => {
      if (left.fullPath !== right.fullPath) {
        return left.fullPath.localeCompare(right.fullPath);
      }

      if (left.method !== right.method) {
        return left.method.localeCompare(right.method);
      }

      return left.line - right.line;
    });
}

async function main(): Promise<void> {
  const inputFile = process.argv[2];
  if (inputFile === undefined) {
    throw new Error('Usage: tsx scripts/parse-routes.ts <source-file> [output-file]');
  }

  const outputFile = process.argv[3];
  const sourceText = await readFile(resolve(inputFile), 'utf8');
  const routes = parseRoutesFromSource(sourceText, inputFile);
  const payload = JSON.stringify(routes, null, 2);

  if (outputFile === undefined) {
    process.stdout.write(`${payload}\n`);
    return;
  }

  await mkdir(dirname(resolve(outputFile)), { recursive: true });
  await writeFile(resolve(outputFile), `${payload}\n`, 'utf8');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}
