import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertBaseline,
  discoverVisualforceFiles,
  runValidation,
  updateBaseline,
} from '../scripts/test-real-world-corpus.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const fixtureConfig = path.join(
  repositoryRoot,
  'test/fixtures/real-world/config.json',
);

test('discovery handles spaces and excludes generated or nested worktrees', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'visualforce corpus '));
  t.after(() => fs.rm(root, {recursive: true, force: true}));

  const files = [
    'force app/pages/One.page',
    'force app/components/Two.component',
    'node_modules/ignored.page',
    'build/ignored.component',
    '.worktrees/copy/ignored.page',
    'nested-repository/ignored.page',
  ];
  for (const file of files) {
    const target = path.join(root, file);
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.writeFile(target, '<apex:page/>');
  }
  await fs.writeFile(
    path.join(root, 'nested-repository/.git'),
    'gitdir: elsewhere',
  );

  const discovered = await discoverVisualforceFiles({
    name: 'fixture',
    path: root,
  });

  assert.deepEqual(
    discovered.map((file) => path.relative(root, file.path)),
    ['force app/components/Two.component', 'force app/pages/One.page'],
  );
});

test('validation parses committed fixtures and reports path and content totals', async () => {
  const report = await runValidation({
    configPath: fixtureConfig,
    repositoryRoot,
  });

  assert.equal(report.schemaVersion, 1);
  assert.deepEqual(report.totals, {
    paths: 3,
    passedPaths: 3,
    failedPaths: 0,
    uniqueContents: 2,
    passedUniqueContents: 2,
    failedUniqueContents: 0,
    pages: 2,
    components: 1,
    bytes: report.totals.bytes,
    durationMs: report.totals.durationMs,
  });
  assert.deepEqual(
    report.roots.map(({name, paths, passedPaths}) => ({
      name,
      paths,
      passedPaths,
    })),
    [
      {name: 'first', paths: 1, passedPaths: 1},
      {name: 'second', paths: 2, passedPaths: 2},
    ],
  );
  assert.equal(report.failures.length, 0);

  const written = JSON.parse(await fs.readFile(report.reportPath, 'utf8'));
  assert.equal(written.totals.paths, 3);
  assert.equal(JSON.stringify(written).includes('IF (VALUE'), false);
});

test('baseline checks explain discovery drift and can be updated', async (t) => {
  assert.throws(
    () =>
      assertBaseline(
        {paths: 3, uniqueContents: 2},
        {paths: 4, uniqueContents: 2},
      ),
    /path count changed from 4 to 3/,
  );

  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'visualforce baseline '),
  );
  t.after(() => fs.rm(directory, {recursive: true, force: true}));
  const configPath = path.join(directory, 'config.json');
  await fs.writeFile(configPath, `${JSON.stringify({roots: []}, null, 2)}\n`);

  await updateBaseline(configPath, {paths: 3, uniqueContents: 2});

  const updated = JSON.parse(await fs.readFile(configPath, 'utf8'));
  assert.deepEqual(updated.baseline, {paths: 3, uniqueContents: 2});
});
