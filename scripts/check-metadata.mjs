import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const packageJson = readJson('package.json');
const treeSitterJson = readJson('tree-sitter.json');

assert.equal(packageJson.name, 'tree-sitter-visualforce');
assert.equal(packageJson.version, '0.1.0');
assert.equal(packageJson.license, 'MIT');
assert.equal(packageJson.devDependencies['tree-sitter-cli'], '0.26.10');
assert.equal(packageJson.devDependencies['tree-sitter-html'], '0.23.2');
assert.equal(treeSitterJson.grammars[0].name, 'visualforce');
assert.equal(treeSitterJson.grammars[0].scope, 'source.visualforce');
assert.deepEqual(treeSitterJson.grammars[0]['file-types'], ['component', 'page']);
assert.equal(treeSitterJson.metadata.version, packageJson.version);

console.log('metadata: exact pins and Visualforce grammar identity verified');
