// SPDX-License-Identifier: Apache-2.0

import type { RiskClass } from '../coverage/types.js';

export type McpToolAnnotations = {
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  readOnlyHint?: boolean;
};

export function getAnnotationsForRisk(risk: RiskClass): McpToolAnnotations {
  switch (risk) {
    case 'read':
      return { readOnlyHint: true };
    case 'safe_write':
      return { idempotentHint: false };
    case 'destructive':
      return { destructiveHint: true, idempotentHint: false };
    case 'dangerous_config':
      return {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      };
    case 'secret_sensitive':
      return { openWorldHint: false };
  }
}
