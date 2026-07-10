# Contributing

Contributions are welcome. Parser changes must preserve HTML structure, Visualforce expression nodes, embedded-language boundaries, and useful editor recovery.

## Setup

```bash
npm ci
npm test
```

The project pins `tree-sitter-cli` to 0.26.10 and `tree-sitter-html` to 0.23.2. Do not replace exact pins with ranges.

## Test-first parser changes

1. Add one focused case under `test/corpus/` with the intended syntax tree.
2. Run `npx tree-sitter test --file-name <corpus-file>` and confirm the new case fails for the intended reason.
3. Make the smallest grammar or scanner change that satisfies it.
4. Run `npm run generate` and the focused corpus test again.
5. Run `npm test`, both builds, the binding test, and the regeneration check.

Do not use `tree-sitter test --update` as a substitute for reviewing expected trees. Valid fixtures under `test/fixtures/valid/` must not contain `ERROR` or missing nodes. Invalid editor states belong in dedicated recovery cases with assertions that later markup remains available.

## Scanner changes

`src/scanner.c` and `src/tag.h` derive from `tree-sitter-html@0.23.2`. Keep their attribution intact. Scanner changes require corpus coverage for serialization-sensitive nesting, matching end tags, script/style boundaries, and partially typed input.

## Verification

```bash
npm test
npm run build:native
npm run build:wasm
npm run test:binding
npm run test:e2e
npm run check:regenerate
git diff --check
```

`npm run check:regenerate` must leave generated parser and binding files unchanged. Do not commit `node_modules`, `.build`, `build`, `target`, editor caches, credentials, or generated disposable binaries.

## Pull requests

Describe the syntax or recovery behavior being changed, include the red/green regression case, and call out any query or node-type compatibility impact. Keep unrelated refactoring out of parser changes.
