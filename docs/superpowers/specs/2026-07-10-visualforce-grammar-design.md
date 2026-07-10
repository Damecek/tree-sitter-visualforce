# Tree-sitter Visualforce Grammar Design

## Product goal

Build a standalone, MIT-licensed Tree-sitter grammar named `visualforce` for Salesforce Visualforce pages and components. The repository must be directly consumable by editors and parser hosts without grammar regeneration, and its first public release must include generated sources, standard bindings, queries, fixtures, CI, and reproducible validation.

## Source basis and version policy

The grammar extends `tree-sitter-html` version `0.23.2` exactly. That release corresponds to upstream commit `5a5ca8551a179998360b4a4ca2c0f366a35acc03`. The npm lockfile records the resolved artifact and integrity hash. Parser generation uses `tree-sitter-cli` version `0.26.10` exactly and ABI 15.

The HTML grammar and scanner are MIT licensed. Reused scanner and tag-stack code retain upstream copyright attribution in source headers, `LICENSE`, and `THIRD_PARTY_NOTICES.md`. Salesforce's BSD-licensed VS Code extension is used only as a behavioral reference; its TextMate grammar is not copied. No GPL source is used.

Primary references are the official Tree-sitter grammar DSL, testing, query, injection, and syntax-highlighting documentation; `tree-sitter/tree-sitter-html`; Salesforce Visualforce documentation; and `forcedotcom/salesforcedx-vscode` Visualforce syntax and fixtures.

## Evaluated approaches

### Extend HTML and minimally adapt its scanner — selected

Use Tree-sitter's grammar inheritance to preserve HTML structure, error recovery, tag balancing, void-element handling, and script/style boundaries. Override only the productions that can contain Visualforce expressions. Adapt the copied upstream scanner so raw script/style text stops before `{!`, allowing the grammar to alternate raw text with expression nodes.

This has the smallest maintenance surface and follows the proven Angular-family architecture while keeping Visualforce's expression language independent.

### Alias HTML and add queries — rejected

Queries cannot create syntax nodes. An HTML alias would continue treating `{!...}` as opaque attribute or text content, so it cannot meet the core parser requirement.

### Fork and rewrite all HTML productions and scanning — rejected

A full fork would make Visualforce-specific changes easy, but it would unnecessarily duplicate mature tag-stack and malformed-markup recovery behavior. The larger divergence would be harder to audit and update.

## Grammar architecture

`grammar.js` extends `require('tree-sitter-html/grammar')` and sets `name: 'visualforce'`. Visualforce expression rules form a contiguous, documented unit in the grammar.

The inherited document and element model remains intact. The following productions are overridden:

- `_node` recognizes a Visualforce expression before inherited HTML nodes.
- `text` stops at expression starts so markup text expressions become nodes.
- quoted and unquoted attribute values are sequences of literal fragments, entities, and Visualforce expressions.
- `script_element` and `style_element` alternate raw text fragments with Visualforce expressions before the matching end tag.
- `document` also accepts an XML declaration, while inherited doctype support remains available.

Tag names remain the scanner-backed HTML `tag_name` token. This accepts standard tags, `apex:*`, `c:*`, and arbitrary managed-package namespace tags while preserving exact start/end matching.

## Visualforce expression unit

A `visualforce_expression` has explicit `{!` and `}` delimiter nodes and a structured expression body. The supported expression surface is intentionally syntactic, not an assertion about undocumented Salesforce runtime semantics.

Supported nodes include:

- identifiers and `$` global identifiers;
- member access and chained properties;
- function calls and comma-separated argument lists;
- parenthesized expressions;
- single- and double-quoted strings with backslash escapes;
- integers, decimals, booleans, and null;
- unary `!`, `NOT`, `+`, and `-`;
- multiplicative, additive, comparison, equality, logical, and concatenation operators commonly found in Visualforce/formula expressions.

Operator precedence is encoded explicitly. Formula-style calls such as `IF`, `JSENCODE`, `HTMLENCODE`, and `URLFOR` are ordinary call expressions, so the parser remains extensible and does not hard-code a closed function catalogue.

When a runtime-specific or otherwise unsupported construct appears, Tree-sitter's normal error recovery retains the surrounding `visualforce_expression` and markup structure. The grammar does not introduce a greedy catch-all that could hide parser defects. Incomplete expressions and partially typed tags may contain `ERROR` or missing nodes locally, but later markup must recover.

## Scanner behavior

The external scanner is based on the scanner and tag tables from `tree-sitter-html@0.23.2`. Its stack serialization, custom tag comparison, implicit close handling, void elements, comments, and matching end tags remain unchanged.

The one intentional behavioral change is raw-text segmentation. While inside a script or style element, raw text scanning ends immediately before `{!` or the matching case-insensitive closing tag. If scanning begins at `{!`, the scanner yields no raw-text token so the grammar can parse a `visualforce_expression`. Comparison characters and unrelated braces remain raw embedded-language text, preventing `<`, `>`, `<=`, or `>=` inside expressions or scripts from corrupting the markup tree.

## Injection and highlighting model

`queries/injections.scm` injects `javascript` into script raw-text fragments and `css` into style raw-text fragments. It also injects JavaScript into event-handler attribute values and CSS into `style` attribute values. Child Visualforce expression ranges are excluded by normal Tree-sitter injection behavior.

Highlights use conventional stable captures: tags as `@tag`, namespaced Visualforce tags as `@tag.builtin`, attributes as `@attribute`, strings as `@string`, comments as `@comment`, entities as `@string.special`, expression delimiters as `@punctuation.special`, calls as `@function`, `$` globals as `@variable.builtin`, properties as `@property`, and standard operator/number/boolean/null captures.

Indent and fold queries cover element pairs, script/style blocks, comments, and multiline expressions where the syntax tree makes those relationships reliable.

## Testing strategy

Development follows red-green-refactor cycles. Corpus tests specify exact trees for markup, expressions, attributes, recovery, script/style segmentation, and XML/doctype input. Realistic `.page` and `.component` fixtures cover small roots and a large representative page.

Repository scripts provide separate checks for:

- parser generation and corpus tests;
- fixture parsing with a strict no-unexpected-`ERROR` policy for valid fixtures and dedicated recovery assertions for intentionally incomplete/malformed fixtures;
- compilation and execution of every query against representative fixtures;
- required highlight and injection captures;
- native parser build, WASM parser build, and a generated Node binding smoke test;
- formatting/linting and JSON/metadata validation;
- regeneration reproducibility, verified with a clean Git diff;
- a clean-clone consumer E2E flow using `npm ci`.

CI runs essential checks on Ubuntu and macOS. Generated `src/grammar.json`, `src/node-types.json`, `src/parser.c`, scanner/header files, and standard bindings are committed so consumers do not need npm or the grammar DSL.

## Repository and release model

The repository uses `main`, exact dependency pins, a committed lockfile, and coherent verified commits. GitHub Actions must pass before creating annotated tag `v0.1.0` and a GitHub release. npm publication is excluded from this release unless safe ownership credentials are already present.

The public documentation covers architecture, syntax, limitations, licenses, regeneration, tests, editor consumption, and release commands. No required work remains as a placeholder.

## Design self-review

- Placeholder scan: no unresolved design placeholders remain.
- Consistency: the grammar, scanner, query, test, packaging, and release sections all use the same pinned dependency and CLI architecture.
- Scope: one parser package and its release form a cohesive deliverable; bindings, queries, and CI are packaging facets rather than independent products.
- Ambiguity: recovery permits local error nodes only in intentionally invalid editor-state fixtures; valid fixtures must parse without errors.
- Approval gate: the implementation prompt explicitly pre-approves the product direction and instructs written self-review in place of interactive approval, so implementation planning proceeds immediately.
