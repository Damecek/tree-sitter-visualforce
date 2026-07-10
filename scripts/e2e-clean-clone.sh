#!/usr/bin/env bash
set -euo pipefail

source_repository="${SOURCE_REPOSITORY:-$(git rev-parse --show-toplevel)}"
temporary_root="$(mktemp -d)"
trap 'rm -rf "$temporary_root"' EXIT

git clone --quiet "file://$source_repository" "$temporary_root/tree-sitter-visualforce"
cd "$temporary_root/tree-sitter-visualforce"

npm ci
npm run generate
npm run test:corpus
npm run build:native
npm run build:wasm
npm run check:fixtures
npm run check:queries
npm run test:binding
npm run check:regenerate

git diff --exit-code
echo "e2e: clean clone installed, generated, built, parsed, queried, and exercised a binding"

