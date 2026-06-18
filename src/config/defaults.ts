// SPDX-License-Identifier: Apache-2.0

import type { ExposureProfile } from '../core/coverage/types.js';

export const DEFAULT_MCPHUB_AUTH_HEADER = 'Authorization';
export const DEFAULT_MCPHUB_RETRY_ATTEMPTS = 2;
export const DEFAULT_MCPHUB_RETRY_BACKOFF_MS = 250;
export const DEFAULT_MCPHUB_TIMEOUT_MS = 10_000;

export const DEFAULT_EXPOSURE_PROFILE: ExposureProfile = 'safe';
export const DEFAULT_EXPOSED_PROFILES: ExposureProfile[] = ['safe', 'ops', 'admin', 'all'];

export const DEFAULT_HTTP_HOST = '127.0.0.1';
export const DEFAULT_HTTP_PORT = 7345;
export const DEFAULT_HTTP_BODY_LIMIT = 1_048_576;
export const DEFAULT_HTTP_MODE = 'stateful';
export const DEFAULT_LOG_LEVEL = 'info';
export const DEFAULT_AUDIT_MAX_BYTES = 1_048_576;
export const DEFAULT_AUDIT_MAX_FILES = 5;
export const DEFAULT_RESOURCE_POLL_INTERVAL_MS = 5_000;

export const REDACTED_PLACEHOLDER = '[REDACTED]';
