# tree-sitter-visualforce

[![CI](https://github.com/Damecek/tree-sitter-visualforce/actions/workflows/ci.yml/badge.svg)](https://github.com/Damecek/tree-sitter-visualforce/actions/workflows/ci.yml)

A standalone [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for Salesforce Visualforce pages and components.

The grammar is named `visualforce`. It extends [`tree-sitter-html` 0.23.2](https://github.com/tree-sitter/tree-sitter-html/releases/tag/v0.23.2) and adds explicit syntax nodes for Visualforce expressions in markup text, attributes, JavaScript, and CSS. Generated parser sources are committed, so consumers can build the parser without npm or grammar regeneration.

## Supported syntax

- Standard HTML and arbitrary namespaced tags, including `apex:*`, `c:*`, and managed-package components
- `.page` and `.component` documents
- Quoted, unquoted, expression-only, and mixed literal/expression attributes
- HTML comments, entities, doctype declarations, and XML declarations
- `{! ... }` expressions in text and attributes
- Expressions embedded in `<script>`, `<style>`, event-handler attributes, and `style` attributes
- Identifiers, `$User`, `$Resource`, and other `$` globals
- Chained member access, function calls, argument lists, and parentheses
- Single- and double-quoted strings with escapes, numbers, booleans, and null
- Common unary, arithmetic, concatenation, comparison, equality, and logical operators
- Formula-style calls such as `IF`, `JSENCODE`, `HTMLENCODE`, and `URLFOR`
- Editor recovery for incomplete expressions, partial start tags, and mismatched markup

Example:

```xml
<apex:page controller="AccountController">
  <style>.card { color: {!theme.primary}; }</style>
  <button onclick="openAccount('{!JSENCODE(account.Id)}')">
    {!HTMLENCODE(account.Name)}
  </button>
  <script>const active = {!account.Score__c >= 10};</script>
</apex:page>
```

The Visualforce fragments above become `visualforce_expression` nodes rather than opaque HTML text:

```text
(visualforce_expression
  (expression_start)
  (call_expression
    function: (identifier)
    arguments: (argument_list
      (member_expression
        object: (identifier)
        property: (identifier))))
  (expression_end))
```

## Architecture

`grammar.js` uses Tree-sitter grammar inheritance instead of copying the HTML grammar. The external scanner and tag table are adapted from the exact pinned HTML release and retain its tag stack, custom-tag matching, implicit closes, void elements, comments, and case-insensitive script/style closing tags.

The scanner has three narrowly scoped Visualforce/editor adaptations:

1. Script and style raw text stops before `{!`, allowing the expression grammar to parse the fragment before raw scanning resumes.
2. An expression may close synthetically only when nothing except whitespace remains at end of file.
3. A partially typed start tag may synthesize its final `>` only at end of file, after which the inherited tag stack unwinds open elements.

Comparison operators such as `<`, `>`, `<=`, and `>=` are parsed within expression state, so they do not corrupt the surrounding markup tree.

## Queries

- `queries/highlights.scm` provides conventional captures for tags, namespaced tags, attributes, strings, comments, entities, expression delimiters, functions, globals, properties, operators, and literals.
- `queries/injections.scm` injects `javascript` and `css` into script/style raw-text fragments and matching inline attributes. Visualforce child ranges remain owned by this grammar.
- `queries/indents.scm` covers paired elements, embedded blocks, and argument lists.
- `queries/folds.scm` covers elements, embedded blocks, comments, and multiline expressions.

Namespaced tags are scanner tokens such as `apex:page`; the highlight query captures the whole token as `@tag.builtin` and also supplies the general `@tag` capture.

## Consuming the parser

The release tag is suitable for source-based consumers. The exported C symbol is `tree_sitter_visualforce`.

For Zed extension development:

```toml
[grammars.visualforce]
repository = "https://github.com/Damecek/tree-sitter-visualforce"
rev = "v0.1.0"
```

For Node consumers before any npm publication:

```bash
npm install tree-sitter@0.25.0 github:Damecek/tree-sitter-visualforce#v0.1.0
```

For Rust consumers:

```toml
[dependencies]
tree-sitter = "0.26.10"
tree-sitter-visualforce = { git = "https://github.com/Damecek/tree-sitter-visualforce", tag = "v0.1.0" }
```

Neovim, Helix, and Emacs integrations can point their Tree-sitter grammar source configuration at the same repository and tag, register the `page` and `component` file types, and install the queries from `queries/` according to the editor's normal parser packaging convention.

## Development

Requirements:

- Node.js 24 or newer
- npm
- Rust stable for the exercised Rust binding
- a C/C++ toolchain supported by Tree-sitter

Install and run the complete local parser/query gate:

```bash
npm ci
npm test
```

Generate and verify committed artifacts:

```bash
npm run generate
npm run check:regenerate
```

Build both parser formats and exercise a generated binding:

```bash
npm run build:native
npm run build:wasm
npm run test:binding
```

Run the consumer-style clean-clone validation:

```bash
npm run test:e2e
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the test-first workflow. The architecture decision and implementation plan are preserved under `docs/superpowers/`.

## Known limitations

- This grammar provides structural syntax, highlighting, injections, and recovery. It does not validate Salesforce runtime semantics, controller members, component attributes, permissions, or formula function signatures.
- Visualforce expressions are related to Salesforce formula syntax but are not Apex. The grammar neither embeds nor injects an Apex parser.
- The expression grammar intentionally covers documented/common structural forms. Runtime-specific or undocumented constructs outside that surface recover locally and may contain `ERROR` nodes.
- JavaScript and CSS remain `raw_text` in the base tree and become language trees through injection queries. Expression fragments split the injected content into ranges.
- Namespaced tag prefixes are not separate syntax nodes because the inherited HTML tag-balancing scanner emits the complete tag name as one token.
- EOF-only synthetic delimiters improve editor behavior but do not attempt to reinterpret arbitrary mid-document malformed expressions as valid syntax.

## License and attribution

This repository is MIT licensed. The adapted `tree-sitter-html` scanner and tag table are also MIT licensed; exact provenance and the upstream license text are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
