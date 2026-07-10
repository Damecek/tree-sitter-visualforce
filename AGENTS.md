# Repository commands

Use the exact committed toolchain and run changes test-first.

```bash
npm ci
npm run generate
npm test
npm run build:native
npm run build:wasm
npm run test:binding
npm run test:e2e
npm run check:regenerate
git diff --check
```

Valid fixtures must parse without `ERROR` or missing nodes. Keep the MIT attribution in `src/scanner.c`, `src/tag.h`, and `THIRD_PARTY_NOTICES.md` when changing scanner code.

Release only from a clean `main` after GitHub CI is green: create an annotated tag, push it normally, and create the matching GitHub release. Never force-push or publish to npm without confirmed package ownership.
