// SPDX-License-Identifier: Apache-2.0

export function assertNotManagementServer(
  targetName: string,
  managementServerName: string | undefined,
  operation: string,
): void {
  if (managementServerName !== undefined && targetName === managementServerName) {
    throw new Error(`Refusing to ${operation} for the management server "${targetName}".`);
  }
}
