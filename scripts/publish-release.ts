import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

type PackageManifest = {
  name: string;
  version: string;
};

function readPackageManifest(): PackageManifest {
  return JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as PackageManifest;
}

async function isVersionPublished(name: string, version: string): Promise<boolean> {
  const encodedName = name.replace('/', '%2f');
  const encodedVersion = encodeURIComponent(version);
  const registryUrl = `https://registry.npmjs.org/${encodedName}/${encodedVersion}`;
  const response = await fetch(registryUrl, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    throw new Error(`Failed to verify npm publication: ${response.status} ${response.statusText}`);
  }

  return true;
}

async function main(): Promise<void> {
  const { name, version } = readPackageManifest();

  // Keep the release workflow idempotent for ordinary merges to main.
  if (await isVersionPublished(name, version)) {
    console.log(`Skipping publish because ${name}@${version} is already available on npm.`);
    return;
  }

  const result = spawnSync('pnpm', ['publish', '--no-git-checks', ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (typeof result.status === 'number') {
    process.exit(result.status);
  }

  throw result.error ?? new Error('pnpm publish terminated without an exit status.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
