// SPDX-License-Identifier: Apache-2.0

import { isIP } from 'node:net';

const privateIpv4Cidrs = [
  { mask: 8, prefix: [10] },
  { mask: 8, prefix: [127] },
  { mask: 16, prefix: [169, 254] },
  { mask: 12, prefix: [172, 16] },
  { mask: 16, prefix: [192, 168] },
];

function isPrivateIpv4(host: string): boolean {
  const octets = host.split('.').map((value) => Number.parseInt(value, 10));
  if (octets.length !== 4 || octets.some((value) => Number.isNaN(value))) {
    return false;
  }

  const [firstOctet, secondOctet] = octets;
  if (firstOctet === undefined || secondOctet === undefined) {
    return false;
  }

  return privateIpv4Cidrs.some(({ mask, prefix }) => {
    if (mask === 8) {
      return firstOctet === prefix[0];
    }

    if (mask === 12) {
      return firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31;
    }

    return firstOctet === prefix[0] && secondOctet === prefix[1];
  });
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.toLowerCase();

  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

export function isPrivateHost(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === 'localhost') {
    return true;
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    return isPrivateIpv4(normalized);
  }

  if (ipVersion === 6) {
    return isPrivateIpv6(normalized);
  }

  return false;
}

export function assertNoPrivateUrl(targetUrl: string): void {
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Blocked non-HTTP target URL "${targetUrl}".`);
  }

  if (isPrivateHost(parsed.hostname)) {
    throw new Error(`Blocked private or localhost target URL "${targetUrl}".`);
  }
}
