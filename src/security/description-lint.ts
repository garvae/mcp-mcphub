// SPDX-License-Identifier: Apache-2.0

const suspiciousDescriptionPatterns = [
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/iu,
  /\beyJ[A-Za-z0-9_\-]+?\.[A-Za-z0-9_\-]+?\.[A-Za-z0-9_\-]+/u,
  /\bsk-[A-Za-z0-9]{20,}\b/u,
] as const;

export function assertSafeDescription(description: string): void {
  if (description.length > 500) {
    throw new Error('Description exceeds the 500-character safety limit.');
  }

  if (suspiciousDescriptionPatterns.some((pattern) => pattern.test(description))) {
    throw new Error('Description contains secret-like material and was rejected.');
  }
}
