#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
npm run typecheck --registry=https://registry.npmjs.org
npm test --registry=https://registry.npmjs.org
npm run build --registry=https://registry.npmjs.org
node scripts/assert-dist-ext.mjs
node scripts/assert-nm-entry.mjs
