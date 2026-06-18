// SPDX-License-Identifier: Apache-2.0

import { createRequire } from 'node:module';

type PackageMetadata = {
  name: string;
  version: string;
};

const require = createRequire(import.meta.url);
const packageMetadata = require('../package.json') as PackageMetadata;

export const PACKAGE_METADATA = packageMetadata;
export const PACKAGE_VERSION = packageMetadata.version;
