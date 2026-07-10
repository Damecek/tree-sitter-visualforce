#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "query check failed: $*" >&2
  exit 1
}

fixture="test/fixtures/valid/representative.page"
npm run build:native >/dev/null
parser_args=(--config-path test/tree-sitter-config.json --lib-path .build/visualforce.dylib --lang-name visualforce)

for query in queries/highlights.scm queries/injections.scm queries/indents.scm queries/folds.scm; do
  [[ -f "$query" ]] || fail "$query is missing"
  npx tree-sitter query "${parser_args[@]}" "$query" "$fixture" --quiet
done

highlights="$(npx tree-sitter query "${parser_args[@]}" -c queries/highlights.scm "$fixture")"
for capture in 'punctuation.special' 'variable.builtin' 'function' 'property' 'operator' 'number' 'boolean' 'constant.builtin' 'tag.builtin'; do
  grep -q "$capture" <<<"$highlights" || fail "highlight capture @$capture is missing"
done

injections="$(npx tree-sitter query "${parser_args[@]}" -c queries/injections.scm "$fixture")"
grep -q 'injection.content' <<<"$injections" || fail "injection content capture is missing"
grep -q '#set! injection.language "javascript"' queries/injections.scm || fail "JavaScript injection language is missing"
grep -q '#set! injection.language "css"' queries/injections.scm || fail "CSS injection language is missing"

echo "queries: all files compile and required captures are present"
