// SPDX-License-Identifier: Apache-2.0

import type { RiskClass } from '../coverage/types.js';

export const RISK_CLASS_ORDER: RiskClass[] = [
  'read',
  'safe_write',
  'destructive',
  'dangerous_config',
  'secret_sensitive',
];

export const RISK_CLASS_DESCRIPTIONS: Record<RiskClass, string> = {
  dangerous_config:
    'Can change authentication, routing, external connectivity, or other high-impact instance behavior.',
  destructive: 'Deletes data or applies changes that are hard to reverse safely.',
  read: 'Read-only inspection and diagnostics.',
  safe_write: 'Operational writes that are usually reversible but still affect running workflows.',
  secret_sensitive: 'May expose or transform sensitive values and must remain redacted by default.',
};

export function compareRiskClass(left: RiskClass, right: RiskClass): number {
  return RISK_CLASS_ORDER.indexOf(left) - RISK_CLASS_ORDER.indexOf(right);
}
