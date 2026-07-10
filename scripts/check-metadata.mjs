import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const packageJson = readJson('package.json');
const treeSitterJson = readJson('tree-sitter.json');

assert.equal(packageJson.name, 'tree-sitter-visualforce');
assert.equal(packageJson.version, '0.1.0');
assert.equal(packageJson.license, 'MIT');
assert.equal(packageJson.devDependencies['tree-sitter-cli'], '0.26.10');
assert.equal(packageJson.devDependencies['tree-sitter-html'], '0.23.2');
assert.equal(treeSitterJson.grammars[0].name, 'visualforce');
assert.equal(treeSitterJson.grammars[0].scope, 'source.visualforce');
assert.deepEqual(treeSitterJson.grammars[0]['file-types'], [
  'component',
  'page',
]);
assert.equal(treeSitterJson.metadata.version, packageJson.version);

for (const path of [
  'grammar.js',
  'src/grammar.json',
  'src/node-types.json',
  'src/parser.c',
  'src/scanner.c',
  'src/tag.h',
  'queries/highlights.scm',
  'queries/injections.scm',
  'queries/indents.scm',
  'queries/folds.scm',
]) {
  assert.ok(existsSync(path), `${path} must be committed`);
}

const parserSource = readFileSync('src/parser.c', 'utf8');
assert.match(parserSource, /#define LANGUAGE_VERSION 15\b/);
assert.match(parserSource, /tree_sitter_visualforce/);
assert.deepEqual(treeSitterJson.grammars[0]['external-files'], ['src/tag.h']);
assert.equal(treeSitterJson.grammars[0].highlights, 'queries/highlights.scm');
assert.equal(treeSitterJson.grammars[0].injections, 'queries/injections.scm');

console.log('metadata: exact pins and Visualforce grammar identity verified');
