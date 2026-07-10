#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "fixture check failed: $*" >&2
  exit 1
}

npm run build:native >/dev/null
parser_args=(--config-path test/tree-sitter-config.json --lib-path .build/visualforce.dylib --lang-name visualforce)

for fixture in test/fixtures/valid/*.page test/fixtures/valid/*.component; do
  output="$(npx tree-sitter parse "${parser_args[@]}" "$fixture" || true)"
  if grep -Eq '\((ERROR|MISSING)' <<<"$output"; then
    echo "$output" >&2
    fail "$fixture contains an unexpected ERROR or MISSING node"
  fi
  grep -q 'visualforce_expression' <<<"$output" || fail "$fixture has no Visualforce expression node"
done

incomplete="$(npx tree-sitter parse "${parser_args[@]}" test/fixtures/recovery/incomplete.page || true)"
grep -q 'visualforce_expression' <<<"$incomplete" || fail "incomplete expression was not preserved"

malformed="$(npx tree-sitter parse "${parser_args[@]}" test/fixtures/recovery/malformed.page || true)"
grep -q 'element' <<<"$malformed" || fail "malformed fixture lost its element structure"

recovered="$(npx tree-sitter query "${parser_args[@]}" -c test/queries/footer.scm test/fixtures/recovery/malformed.page)"
grep -q 'recovered.tag' <<<"$recovered" || fail "markup after the malformed region was not recovered"

echo "fixtures: valid files are error-free and recovery assertions passed"
