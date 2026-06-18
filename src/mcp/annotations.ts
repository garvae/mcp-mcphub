// SPDX-License-Identifier: Apache-2.0

import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

import { getAnnotationsForRisk } from '../core/risk/annotations.js';
import type { RiskClass } from '../core/coverage/types.js';

export function getSdkAnnotationsForRisk(risk: RiskClass): ToolAnnotations {
  return getAnnotationsForRisk(risk);
}
