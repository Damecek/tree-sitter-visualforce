# Repository commands

Use the exact committed toolchain and run changes test-first.

```bash
npm ci
npm run generate
npm test
npm run test:real:harness
# Optional when .visualforce-corpus.local.json is configured:
npm run test:real
npm run build:native
npm run build:wasm
npm run test:binding
npm run test:e2e
npm run check:regenerate
git diff --check
```

Valid fixtures must parse without `ERROR` or missing nodes. Keep the MIT attribution in `src/scanner.c`, `src/tag.h`, and `THIRD_PARTY_NOTICES.md` when changing scanner code.

Keep real-world corpus inputs local and read-only. Never commit `.visualforce-corpus.local.json`, `.build/` reports, absolute local paths, or private/customer Visualforce files. Commit only minimized anonymized regressions; do not use an allowlist to make `npm run test:real` green. Update discovery baselines only after reviewing the count delta and reaching zero parse failures.

Release only from a clean `main` after GitHub CI is green: create an annotated tag, push it normally, and create the matching GitHub release. Never force-push or publish to npm without confirmed package ownership.
