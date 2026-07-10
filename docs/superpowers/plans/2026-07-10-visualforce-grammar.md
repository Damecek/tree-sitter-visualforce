# Tree-sitter Visualforce Grammar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver and publicly release a production-quality standalone Tree-sitter grammar for Salesforce Visualforce.

**Architecture:** Extend `tree-sitter-html@0.23.2`, preserve its scanner-backed HTML tag stack, and segment script/style raw text at Visualforce expression boundaries. Keep expression parsing in a dedicated grammar unit, commit generated ABI-15 parser sources and standard bindings, and validate syntax, queries, native/WASM builds, regeneration, and clean-clone consumption.

**Tech Stack:** Tree-sitter CLI 0.26.10, JavaScript grammar DSL, C external scanner, Rust/Node generated bindings, npm lockfile, GitHub Actions.

## Global Constraints

- The grammar name is exactly `visualforce`.
- `tree-sitter-html` is pinned exactly to `0.23.2` and `tree-sitter-cli` exactly to `0.26.10`.
- Generated parser ABI is 15 and generated sources are committed.
- Reused HTML scanner code retains MIT attribution; no GPL code is used.
- Visualforce expressions are not described or injected as Apex.
- Valid fixtures contain no `ERROR` or missing nodes; invalid editor-state fixtures have dedicated recovery assertions.
- Every commit ends with `Co-Authored-By: codex <codex@openai.com>`.
- Work is executed inline by one agent; the user's prompt replaces interactive review and branch-finish choice gates.

## File structure

- `grammar.js`: HTML extension and isolated Visualforce expression productions.
- `tree-sitter.json`, `package.json`, `package-lock.json`: parser metadata, exact tools, scripts, and lock state.
- `src/scanner.c`, `src/tag.h`: attributed HTML tag-stack scanner with raw-text segmentation.
- `src/grammar.json`, `src/node-types.json`, `src/parser.c`, `src/tree_sitter/*`: generated parser artifacts.
- `bindings/{c,go,node,python,rust,swift}/**`, language manifests: standard CLI-generated bindings.
- `queries/{highlights,injections,indents,folds}.scm`: editor captures and embedded-language boundaries.
- `test/corpus/*.txt`: exact syntax-tree behavior.
- `test/fixtures/valid/*`, `test/fixtures/recovery/*`: realistic pages/components and editor recovery cases.
- `test/queries/*.scm`, `test/highlight/*.page`: query validation expectations.
- `scripts/check-fixtures.sh`, `scripts/check-queries.sh`, `scripts/check-metadata.mjs`, `scripts/e2e-clean-clone.sh`: deterministic validation gates.
- `.github/workflows/ci.yml`: Ubuntu and macOS CI.
- `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`: public documentation and attribution.

---

### Task 1: Reproducible grammar repository skeleton

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tree-sitter.json`
- Generate: standard binding and build files with `tree-sitter init`
- Create: `LICENSE`
- Create: `THIRD_PARTY_NOTICES.md`

**Interfaces:**
- Consumes: design pins `tree-sitter-html@0.23.2` and `tree-sitter-cli@0.26.10`.
- Produces: `npm run generate`, `npm run test:corpus`, `npm run build:native`, and `npm run build:wasm` commands used by every later task.

- [ ] **Step 1: Record exact package metadata and tool scripts**

Create `package.json` with package name/version `tree-sitter-visualforce@0.1.0`, `tree-sitter-html: "0.23.2"`, `tree-sitter-cli: "0.26.10"`, exact lint dependencies, standard Tree-sitter files, and explicit scripts for generation, tests, native/WASM builds, bindings, queries, fixtures, formatting, metadata, and E2E.

- [ ] **Step 2: Install exact dependencies and commit the lockfile**

Run: `rtk npm install --package-lock-only`

Expected: `package-lock.json` records exact CLI and HTML versions and npm exits 0.

- [ ] **Step 3: Generate current standard repository bindings**

Run interactively: `rtk npx tree-sitter init`

Supply grammar name `visualforce`, scope `source.visualforce`, file types `page,component`, MIT license, repository URL, version `0.1.0`, and enable all standard bindings. Preserve the exact-pinned package metadata if the initializer proposes ranges.

- [ ] **Step 4: Add license and third-party attribution**

Use the MIT license for this repository. Identify `tree-sitter-html@0.23.2`, its upstream commit, reused `src/scanner.c` and `src/tag.h`, copyright holders, and MIT license in `THIRD_PARTY_NOTICES.md`.

- [ ] **Step 5: Validate metadata before committing**

Run: `rtk npm ci && rtk npm run check:metadata && rtk git diff --check`

Expected: dependency install and metadata validation exit 0; no whitespace errors.

- [ ] **Step 6: Commit the verified skeleton**

Commit subject: `build: scaffold the Visualforce grammar package` plus the required co-author trailer.

### Task 2: HTML structure and explicit Visualforce expressions

**Files:**
- Create: `test/corpus/markup.txt`
- Create: `test/corpus/expressions.txt`
- Create: `test/corpus/attributes.txt`
- Create: `grammar.js`
- Create: `src/scanner.c`
- Create: `src/tag.h`
- Generate: `src/grammar.json`, `src/node-types.json`, `src/parser.c`, `src/tree_sitter/*`

**Interfaces:**
- Consumes: upstream HTML external tokens and tag-stack contracts.
- Produces: `visualforce_expression`, `global_identifier`, `member_expression`, `call_expression`, `argument_list`, literal, unary, and binary nodes; normal HTML/Visualforce element trees.

- [ ] **Step 1: Write failing markup corpus tests**

Add exact expected trees for `<apex:page>`, nested HTML and `apex:*`, self-closing `c:*`, managed-package namespace tags, comments, doctype/XML declaration, quoted/unquoted attributes, and page/component root shapes.

- [ ] **Step 2: Verify the markup tests are red**

Run: `rtk npx tree-sitter test --file-name markup.txt`

Expected: failure because `grammar.js` and the Visualforce parser do not exist.

- [ ] **Step 3: Implement the minimal inherited HTML grammar and scanner**

Extend `tree-sitter-html/grammar`, name it `visualforce`, preserve inherited external ordering, add XML declaration support, and copy the attributed scanner/tag header from exact upstream. Rename exported scanner symbols from `tree_sitter_html_*` to `tree_sitter_visualforce_*`.

- [ ] **Step 4: Generate and verify markup green**

Run: `rtk npm run generate && rtk npx tree-sitter test --file-name markup.txt`

Expected: all markup cases pass.

- [ ] **Step 5: Write failing expression and attribute corpus tests**

Specify delimiters, identifiers, `$User`/`$Resource`, chained properties, nested `IF`/`JSENCODE`/`HTMLENCODE`/`URLFOR`, parentheses, strings with commas/parentheses/comparison characters/escaped quotes/braces, numbers, booleans, null, unary/binary operators, text expressions, expression-only attributes, mixed attributes, unquoted attributes, and style/event attributes.

- [ ] **Step 6: Verify expression tests are red**

Run: `rtk npx tree-sitter test --file-name expressions.txt && rtk npx tree-sitter test --file-name attributes.txt`

Expected: corpus diffs show opaque HTML text/value nodes instead of explicit Visualforce nodes.

- [ ] **Step 7: Implement the expression unit and containing-value overrides**

Add explicit delimiter aliases, precedence-layered unary/binary rules, calls, members, globals, literals, and parenthesized expressions. Override `_node`, text, and quoted/unquoted attribute values so expressions are explicit without changing tag-name scanning.

- [ ] **Step 8: Verify expression and full corpus green**

Run: `rtk npm run generate && rtk npm run test:corpus`

Expected: every corpus case passes with no unresolved conflicts.

- [ ] **Step 9: Commit the parser milestone**

Commit subject: `feat: parse Visualforce markup and expressions` plus the required co-author trailer.

### Task 3: Embedded JavaScript/CSS and editor recovery

**Files:**
- Create: `test/corpus/embedded.txt`
- Create: `test/corpus/recovery.txt`
- Modify: `grammar.js`
- Modify: `src/scanner.c`
- Regenerate: `src/grammar.json`, `src/node-types.json`, `src/parser.c`

**Interfaces:**
- Consumes: expression nodes and scanner tag stack from Task 2.
- Produces: alternating `raw_text` and `visualforce_expression` children inside script/style elements with closing-tag recovery preserved.

- [ ] **Step 1: Write failing embedded-language corpus tests**

Cover plain JavaScript, JavaScript with `{!JSENCODE(...)}` and record values, CSS with and without expressions, comparison operators, unrelated braces, closing tags, and surrounding markup after both embedded elements.

- [ ] **Step 2: Verify embedded tests are red**

Run: `rtk npx tree-sitter test --file-name embedded.txt`

Expected: inherited `raw_text` contains each Visualforce expression opaquely.

- [ ] **Step 3: Segment raw text at expression starts**

Modify only upstream `scan_raw_text`: stop and mark the raw-text token before `{!`; yield no raw token when already positioned at `{!`; continue stopping at the matching case-insensitive script/style end delimiter. Override script/style productions to repeat raw text or Visualforce expressions.

- [ ] **Step 4: Verify embedded tests green**

Run: `rtk npm run generate && rtk npx tree-sitter test --file-name embedded.txt`

Expected: script/style expressions are explicit and later markup remains correctly nested.

- [ ] **Step 5: Write failing recovery tests**

Cover incomplete `{!`, incomplete call/property access, partial start/end tags, mismatched/malformed tags, expressions with `<`, `>`, `<=`, `>=`, and recovery to a later sibling element.

- [ ] **Step 6: Verify recovery tests are red for the missing cases**

Run: `rtk npx tree-sitter test --file-name recovery.txt`

Expected: one or more exact recovery trees differ or lose the later sibling.

- [ ] **Step 7: Make the smallest grammar/scanner recovery adjustments**

Use precedence and optional incomplete-expression alternatives only where each failing tree requires them. Do not add a greedy raw-expression fallback and do not mark valid parser failures as expected.

- [ ] **Step 8: Verify all corpus tests green**

Run: `rtk npm run generate && rtk npm run test:corpus`

Expected: all exact trees pass, including preserved siblings after invalid regions.

- [ ] **Step 9: Commit the embedded/recovery milestone**

Commit subject: `feat: preserve embedded language boundaries and recovery` plus the required co-author trailer.

### Task 4: Fixtures and automated query validation

**Files:**
- Create: `test/fixtures/valid/simple.page`
- Create: `test/fixtures/valid/component.component`
- Create: `test/fixtures/valid/embedded.page`
- Create: `test/fixtures/valid/representative.page`
- Create: `test/fixtures/recovery/incomplete.page`
- Create: `test/fixtures/recovery/malformed.page`
- Create: `queries/highlights.scm`
- Create: `queries/injections.scm`
- Create: `queries/indents.scm`
- Create: `queries/folds.scm`
- Create: `scripts/check-fixtures.sh`
- Create: `scripts/check-queries.sh`

**Interfaces:**
- Consumes: stable node types from Tasks 2–3.
- Produces: conventional captures and strict fixture/query gates used locally, in CI, and in E2E.

- [ ] **Step 1: Add realistic valid and recovery fixtures**

The large page includes nested components, globals, nested functions, event/style attributes, scripts, styles, comments, entities, self-closing tags, and content after embedded blocks. Recovery fixtures isolate only intentional invalid regions and include later valid siblings.

- [ ] **Step 2: Write failing fixture checker**

Implement a shell checker that parses every valid fixture and fails on `(ERROR` or `(MISSING`; separately assert expression nodes and preserved later siblings in recovery fixtures.

- [ ] **Step 3: Verify fixture checker is red before all fixtures parse correctly**

Run: `rtk bash scripts/check-fixtures.sh`

Expected: nonzero exit identifying any missing required node or current error.

- [ ] **Step 4: Fix only fixture-exposed parser defects and verify green**

Run: `rtk npm run generate && rtk bash scripts/check-fixtures.sh`

Expected: all valid fixtures are error-free and recovery assertions pass.

- [ ] **Step 5: Write highlight, injection, indent, and fold queries**

Use standard captures from the design. Match namespaced tag tokens with anchored predicates. Inject `javascript` and `css` into raw text and matching event/style attributes while excluding Visualforce child ranges.

- [ ] **Step 6: Write and verify the query gate red/green**

The checker compiles every `.scm` file against representative fixtures, runs capture output, and asserts `punctuation.special`, `variable.builtin`, `function`, `property`, `javascript`, and `css` evidence. First run before complete queries must fail; after query implementation run `rtk bash scripts/check-queries.sh` and expect exit 0.

- [ ] **Step 7: Commit fixtures and queries**

Commit subject: `feat: add editor queries and representative fixtures` plus the required co-author trailer.

### Task 5: Bindings, build matrix, linting, and clean-clone E2E

**Files:**
- Create: `scripts/check-metadata.mjs`
- Create: `scripts/e2e-clean-clone.sh`
- Modify: generated binding tests where grammar naming requires it
- Create: `eslint.config.mjs`
- Create: `.prettierignore`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: package scripts, committed generated parser/bindings, corpus, fixtures, queries.
- Produces: one `npm test` verification surface and two-platform GitHub CI.

- [ ] **Step 1: Write metadata and generated-binding checks**

Assert exact package/CLI/HTML versions, grammar name, ABI 15, generated artifact presence, query presence, file types, repository URL, license, and no forbidden package ranges.

- [ ] **Step 2: Exercise a generated binding test-first**

Make the generated Rust binding test parse `<apex:page>{!$User.Name}</apex:page>` and assert a `visualforce_expression`. Run `rtk cargo test`; verify it fails before the binding/parser is aligned, then regenerate/fix minimal binding metadata and verify it passes.

- [ ] **Step 3: Add native, WASM, formatting, and regeneration scripts**

Native build writes `.build/visualforce.{dylib,so}` as appropriate. WASM build writes `.build/tree-sitter-visualforce.wasm`. Regeneration runs generation then `git diff --exit-code -- grammar.js src bindings tree-sitter.json`.

- [ ] **Step 4: Write the clean-clone E2E smoke test**

Clone the current repository into a temporary directory, run `npm ci`, regenerate, build native and WASM, parse `representative.page`, run highlight/injection queries, assert required Visualforce captures, and leave the source checkout untouched.

- [ ] **Step 5: Add Ubuntu/macOS GitHub Actions**

Use `actions/checkout@v4`, `actions/setup-node@v4` with Node 24, `dtolnay/rust-toolchain@stable`, `npm ci`, corpus/fixture/query/lint/metadata checks on both OSes, and native/WASM/binding/E2E checks on Ubuntu where practical. Upload no disposable binaries.

- [ ] **Step 6: Run the full local gate**

Run: `rtk npm test && rtk npm run build:native && rtk npm run build:wasm && rtk npm run test:binding && rtk npm run test:e2e`

Expected: every command exits 0.

- [ ] **Step 7: Commit build and CI automation**

Commit subject: `ci: verify generated parser and consumer workflows` plus the required co-author trailer.

### Task 6: Public documentation and release readiness

**Files:**
- Create: `README.md`
- Create: `CONTRIBUTING.md`
- Create: `AGENTS.md`
- Update: `THIRD_PARTY_NOTICES.md`

**Interfaces:**
- Consumes: commands proven by Tasks 1–5.
- Produces: public architecture, syntax, limitation, consumption, development, and release guidance.

- [ ] **Step 1: Document architecture and supported syntax**

Explain the distinct `visualforce` grammar, pinned HTML inheritance, scanner adaptation, expression-node surface, JavaScript/CSS injections, standard editor consumers, file types, generated artifacts, and installation from GitHub.

- [ ] **Step 2: Document explicit limitations**

State that the parser provides useful syntax structure rather than runtime validation, does not parse expressions as Apex, leaves undocumented/runtime-specific constructs to local recovery, injects embedded languages by query rather than parsing them in the base tree, and captures a namespaced tag as one scanner token.

- [ ] **Step 3: Add verified contributor and agent commands**

`CONTRIBUTING.md` explains TDD corpus updates, scanner attribution, generation, tests, and release expectations. Concise `AGENTS.md` records `npm ci`, generation, corpus, full validation, regeneration cleanliness, and release audit commands.

- [ ] **Step 4: Audit public docs and repository placeholders**

Run: `rtk rg -n "TODO|TBD|FIXME|placeholder" --glob '!docs/superpowers/**' --glob '!src/parser.c' .`

Expected: no unresolved product placeholders.

- [ ] **Step 5: Commit documentation**

Commit subject: `docs: document Visualforce grammar usage and maintenance` plus the required co-author trailer.

### Task 7: Verification, publication, CI, tag, and release

**Files:**
- Modify only files required by evidence-backed failures.

**Interfaces:**
- Consumes: complete locally verified repository.
- Produces: public GitHub repository, green CI, annotated `v0.1.0`, GitHub release, clean final checkout.

- [ ] **Step 1: Run verification-before-completion gate**

Run fresh: `rtk npm ci && rtk npm test && rtk npm run build:native && rtk npm run build:wasm && rtk npm run test:binding && rtk npm run test:e2e && rtk npm run check:regenerate && rtk git diff --check`.

Expected: every command exits 0 and regeneration produces no tracked diff.

- [ ] **Step 2: Audit required files and commits**

Run: `rtk git status --short --branch`, `rtk git log --format='%H%n%B%n---'`, and an explicit required-file check.

Expected: clean `main`; every commit has the required co-author trailer; all required artifacts exist.

- [ ] **Step 3: Create and push the public repository safely**

Re-confirm `gh auth status` and nonexistence. Run `rtk gh repo create Damecek/tree-sitter-visualforce --public --source=. --remote=origin --push` only if still absent. If it appeared, inspect its default branch and history before adding a remote; never overwrite remote work.

- [ ] **Step 4: Monitor GitHub Actions and repair only evidence-backed failures**

Use `rtk gh run list --repo Damecek/tree-sitter-visualforce` and `rtk gh run watch <run-id> --repo Damecek/tree-sitter-visualforce --exit-status`. For a failure, invoke systematic debugging, reproduce or isolate the exact platform difference, add a regression check, commit, push normally, and watch the replacement run.

- [ ] **Step 5: Create annotated release tag and GitHub release**

After green CI, create `v0.1.0` with `rtk git tag -a v0.1.0 -m 'tree-sitter-visualforce v0.1.0'`, push it, and create a GitHub release describing syntax, queries, verification, attribution, and known limitations.

- [ ] **Step 6: Verify public release state and clean checkout**

Run: `rtk gh repo view`, `rtk gh release view v0.1.0`, `rtk gh run list --limit 5`, `rtk git ls-remote --tags origin v0.1.0`, `rtk git status --porcelain`, and `rtk git rev-parse HEAD`.

Expected: public repository URL resolves, release/tag points to final commit, required CI is green, and worktree output is empty.

## Plan self-review

- Spec coverage: every required repository artifact, syntax category, fixture category, query capture, build target, CI platform, clean-clone flow, publication step, and final report datum maps to a task above.
- Placeholder scan: occurrences of the word “placeholder” describe the required scan/check, not unfinished content; there are no deferred implementation instructions.
- Interface consistency: scripts introduced in Tasks 1, 4, and 5 are the same commands used by CI, E2E, contributor docs, and final verification.
- TDD consistency: handwritten parser behavior and binding behavior begin with a witnessed failing test; generated files/configuration use direct validation, consistent with the skill exception for generated/config files.
- Execution choice: the user explicitly requires inline execution and forbids subagents, so `superpowers:executing-plans` is selected without pausing for the normal handoff question.
