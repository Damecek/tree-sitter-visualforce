/* eslint-disable jsdoc/require-param-type, operator-linebreak */

import {execFile} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {promisify} from 'node:util';
import {fileURLToPath, pathToFileURL} from 'node:url';

const execFileAsync = promisify(execFile);
const defaultExcludedDirectories = new Set([
  '.build',
  '.git',
  '.worktrees',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
  'worktrees',
]);

/**
 *
 * @param value
 */
function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 *
 * @param passed
 * @param total
 */
function percentage(passed, total) {
  return total === 0 ? '100.00' : ((passed / total) * 100).toFixed(2);
}

/**
 *
 * @param target
 */
async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 *
 * @param directory
 */
async function isNestedRepository(directory) {
  return exists(path.join(directory, '.git'));
}

/**
 *
 * @param root
 */
export async function discoverVisualforceFiles(root) {
  const rootPath = path.resolve(root.path);
  const includedDirectories = new Set(root.includeDirectories ?? []);
  const excludedDirectories = new Set([
    ...defaultExcludedDirectories,
    ...(root.excludeDirectories ?? []),
  ]);
  for (const directory of includedDirectories) {
    excludedDirectories.delete(directory);
  }

  const discovered = [];

  /**
   *
   * @param directory
   * @param isRoot
   */
  async function walk(directory, isRoot = false) {
    if (
      !isRoot &&
      !root.includeNestedRepositories &&
      (await isNestedRepository(directory))
    ) {
      return;
    }

    const entries = await fs.readdir(directory, {withFileTypes: true});
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        if (!root.followSymbolicLinks) continue;
        const stats = await fs.stat(target);
        if (stats.isDirectory()) await walk(target);
        else if (stats.isFile()) await addFile(target);
        continue;
      }
      if (entry.isDirectory()) {
        if (!excludedDirectories.has(entry.name)) await walk(target);
        continue;
      }
      if (entry.isFile()) await addFile(target);
    }
  }

  /**
   *
   * @param filePath
   */
  async function addFile(filePath) {
    const extension = path.extname(filePath);
    if (extension !== '.page' && extension !== '.component') return;
    discovered.push({
      path: filePath,
      rootName: root.name,
      type: extension.slice(1),
    });
  }

  await walk(rootPath, true);
  discovered.sort((left, right) => left.path.localeCompare(right.path));
  return discovered;
}

/**
 *
 * @param configPath
 */
async function loadConfiguration(configPath) {
  const absoluteConfigPath = path.resolve(configPath);
  let source;
  try {
    source = await fs.readFile(absoluteConfigPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `Configuration not found: ${absoluteConfigPath}. Copy .visualforce-corpus.example.json to .visualforce-corpus.local.json and set local roots.`,
      );
    }
    throw error;
  }

  const config = JSON.parse(source);
  if (!Array.isArray(config.roots) || config.roots.length === 0) {
    throw new Error('The corpus configuration must contain at least one root.');
  }

  const configDirectory = path.dirname(absoluteConfigPath);
  const names = new Set();
  const roots = config.roots.map((root) => {
    if (!root.name || !root.path) {
      throw new Error('Every corpus root must have a name and path.');
    }
    if (names.has(root.name)) {
      throw new Error(`Corpus root names must be unique: ${root.name}`);
    }
    names.add(root.name);
    return {...root, path: path.resolve(configDirectory, root.path)};
  });

  return {
    ...config,
    configPath: absoluteConfigPath,
    roots,
    reportPath: path.resolve(
      configDirectory,
      config.reportPath ?? '.build/visualforce-corpus-report.json',
    ),
  };
}

/**
 *
 * @param repositoryRoot
 */
async function buildParser(repositoryRoot) {
  const cli = path.join(
    repositoryRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tree-sitter.cmd' : 'tree-sitter',
  );
  if (!(await exists(cli))) {
    throw new Error(`Tree-sitter CLI not found at ${cli}; run npm ci first.`);
  }

  const extension =
    process.platform === 'win32'
      ? 'dll'
      : process.platform === 'darwin'
        ? 'dylib'
        : 'so';
  const parserPath = path.join(
    repositoryRoot,
    '.build',
    `visualforce-real-world.${extension}`,
  );
  await fs.mkdir(path.dirname(parserPath), {recursive: true});
  await execFileAsync(cli, ['build', '-o', parserPath], {
    cwd: repositoryRoot,
    maxBuffer: 10 * 1024 * 1024,
  });
  return {cli, parserPath};
}

/**
 *
 * @param cli
 * @param arguments_
 * @param repositoryRoot
 */
async function executeParser(cli, arguments_, repositoryRoot) {
  try {
    return await execFileAsync(cli, arguments_, {
      cwd: repositoryRoot,
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (error) {
    if (error.code === 1 && typeof error.stdout === 'string') {
      return {stdout: error.stdout, stderr: error.stderr ?? ''};
    }
    throw error;
  }
}

/**
 *
 * @param stdout
 */
function parseJsonSummary(stdout) {
  const marker = '{\n  "parse_summaries"';
  const start = stdout.indexOf(marker);
  if (start === -1) {
    throw new Error(`Tree-sitter did not return a JSON summary:\n${stdout}`);
  }
  return JSON.parse(stdout.slice(start));
}

/**
 *
 * @param cst
 */
function parseErrorRanges(cst) {
  const errors = [];
  const rangePattern =
    /^(\d+):(\d+)\s+-\s+(\d+):(\d+)\s+.*?•(ERROR|MISSING)\b/gmu;
  for (const match of cst.matchAll(rangePattern)) {
    errors.push({
      type: match[5],
      start: {row: Number(match[1]), column: Number(match[2])},
      end: {row: Number(match[3]), column: Number(match[4])},
    });
  }
  return errors;
}

/**
 *
 * @param file
 * @param parser
 * @param repositoryRoot
 */
async function parseFile(file, parser, repositoryRoot) {
  const commonArguments = [
    '--lib-path',
    parser.parserPath,
    '--lang-name',
    'visualforce',
  ];
  const summaryResult = await executeParser(
    parser.cli,
    ['parse', ...commonArguments, '--quiet', '--json-summary', file.path],
    repositoryRoot,
  );
  const summary = parseJsonSummary(summaryResult.stdout).parse_summaries[0];
  let errors = [];
  if (!summary.successful) {
    const cstResult = await executeParser(
      parser.cli,
      ['parse', ...commonArguments, '--cst', file.path],
      repositoryRoot,
    );
    errors = parseErrorRanges(cstResult.stdout);
    if (errors.length === 0) {
      throw new Error(`Failed to extract error ranges for ${file.path}`);
    }
  }

  const contents = await fs.readFile(file.path);
  return {
    ...file,
    bytes: contents.byteLength,
    sha256: crypto.createHash('sha256').update(contents).digest('hex'),
    durationMs:
      summary.duration.secs * 1000 + summary.duration.nanos / 1_000_000,
    successful: summary.successful,
    errors,
  };
}

/**
 *
 * @param values
 * @param concurrency
 * @param callback
 */
async function mapWithConcurrency(values, concurrency, callback) {
  const results = new Array(values.length);
  let nextIndex = 0;

  /**
   *
   */
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(values[index], index);
    }
  }

  await Promise.all(
    Array.from({length: Math.min(concurrency, values.length)}, () => worker()),
  );
  return results;
}

/**
 *
 * @param totals
 * @param baseline
 */
export function assertBaseline(totals, baseline) {
  if (!baseline) return;
  const differences = [];
  if (totals.paths !== baseline.paths) {
    differences.push(
      `path count changed from ${baseline.paths} to ${totals.paths}`,
    );
  }
  if (totals.uniqueContents !== baseline.uniqueContents) {
    differences.push(
      `unique-content count changed from ${baseline.uniqueContents} to ${totals.uniqueContents}`,
    );
  }
  if (differences.length > 0) {
    throw new Error(
      `Real-world corpus baseline drift: ${differences.join('; ')}. Review the source repositories, then run npm run test:real:update-baseline.`,
    );
  }
}

/**
 *
 * @param configPath
 * @param totals
 */
export async function updateBaseline(configPath, totals) {
  const source = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(source);
  config.baseline = {
    paths: totals.paths,
    uniqueContents: totals.uniqueContents,
  };
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

/**
 *
 * @param root0
 * @param root0.configPath
 * @param root0.repositoryRoot
 * @param root0.skipBaseline
 */
export async function runValidation({
  configPath,
  repositoryRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url))),
  skipBaseline = false,
}) {
  const config = await loadConfiguration(configPath);
  for (const root of config.roots) {
    if (!(await exists(root.path))) {
      throw new Error(`Configured corpus root does not exist: ${root.path}`);
    }
  }

  const filesByRoot = await Promise.all(
    config.roots.map((root) => discoverVisualforceFiles(root)),
  );
  const files = filesByRoot.flat();
  const parser = await buildParser(repositoryRoot);
  const concurrency = Math.max(
    1,
    Math.min(config.concurrency ?? os.availableParallelism(), 8),
  );
  const parsedFiles = await mapWithConcurrency(files, concurrency, (file) =>
    parseFile(file, parser, repositoryRoot),
  );

  const contentGroups = new Map();
  for (const file of parsedFiles) {
    const group = contentGroups.get(file.sha256) ?? [];
    group.push(file);
    contentGroups.set(file.sha256, group);
  }
  const uniqueGroups = [...contentGroups.values()];
  const totals = {
    paths: parsedFiles.length,
    passedPaths: parsedFiles.filter((file) => file.successful).length,
    failedPaths: parsedFiles.filter((file) => !file.successful).length,
    uniqueContents: uniqueGroups.length,
    passedUniqueContents: uniqueGroups.filter((group) =>
      group.every((file) => file.successful),
    ).length,
    failedUniqueContents: uniqueGroups.filter((group) =>
      group.some((file) => !file.successful),
    ).length,
    pages: parsedFiles.filter((file) => file.type === 'page').length,
    components: parsedFiles.filter((file) => file.type === 'component').length,
    bytes: parsedFiles.reduce((total, file) => total + file.bytes, 0),
    durationMs: parsedFiles.reduce((total, file) => total + file.durationMs, 0),
  };

  const roots = config.roots.map((root) => {
    const rootFiles = parsedFiles.filter((file) => file.rootName === root.name);
    const rootHashes = new Set(rootFiles.map((file) => file.sha256));
    return {
      name: root.name,
      path: root.path,
      paths: rootFiles.length,
      passedPaths: rootFiles.filter((file) => file.successful).length,
      failedPaths: rootFiles.filter((file) => !file.successful).length,
      uniqueContents: rootHashes.size,
      pages: rootFiles.filter((file) => file.type === 'page').length,
      components: rootFiles.filter((file) => file.type === 'component').length,
      bytes: rootFiles.reduce((total, file) => total + file.bytes, 0),
      durationMs: rootFiles.reduce((total, file) => total + file.durationMs, 0),
    };
  });

  const failures = parsedFiles
    .filter((file) => !file.successful)
    .map((file) => ({
      path: file.path,
      root: file.rootName,
      sha256: file.sha256,
      errors: file.errors,
    }));
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    configPath: config.configPath,
    reportPath: config.reportPath,
    parserPath: parser.parserPath,
    totals,
    roots,
    failures,
    files: parsedFiles.map((file) => ({
      path: file.path,
      root: file.rootName,
      type: file.type,
      bytes: file.bytes,
      sha256: file.sha256,
      durationMs: file.durationMs,
      successful: file.successful,
      errors: file.errors,
    })),
  };

  await fs.mkdir(path.dirname(config.reportPath), {recursive: true});
  await fs.writeFile(config.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (!skipBaseline) assertBaseline(totals, config.baseline);
  return report;
}

/**
 *
 * @param report
 */
function printSummary(report) {
  const pathCounts = `${formatCount(report.totals.passedPaths)}/${formatCount(report.totals.paths)}`;
  const pathPercentage = percentage(
    report.totals.passedPaths,
    report.totals.paths,
  );
  console.log(
    `Visualforce corpus: ${pathCounts} paths passed (${pathPercentage}%).`,
  );
  const uniqueCounts = `${formatCount(report.totals.passedUniqueContents)}/${formatCount(report.totals.uniqueContents)}`;
  const uniquePercentage = percentage(
    report.totals.passedUniqueContents,
    report.totals.uniqueContents,
  );
  console.log(
    `Unique contents: ${uniqueCounts} passed (${uniquePercentage}%).`,
  );
  const fileCounts = `${formatCount(report.totals.pages)} pages, ${formatCount(report.totals.components)} components`;
  const parseMetrics = `${formatCount(report.totals.bytes)} bytes, ${report.totals.durationMs.toFixed(2)} ms parser time`;
  console.log(`Files: ${fileCounts}, ${parseMetrics}.`);
  for (const root of report.roots) {
    console.log(
      `- ${root.name}: ${root.passedPaths}/${root.paths} paths passed (${root.pages} pages, ${root.components} components).`,
    );
  }
  for (const failure of report.failures) {
    const ranges = failure.errors
      .map(
        (error) =>
          `${error.type} [${error.start.row},${error.start.column}]-[${error.end.row},${error.end.column}]`,
      )
      .join(', ');
    console.log(`- FAIL ${failure.path}: ${ranges}`);
  }
  console.log(`JSON report: ${report.reportPath}`);
}

/**
 *
 */
async function main() {
  const arguments_ = process.argv.slice(2);
  const update = arguments_.includes('--update-baseline');
  const configIndex = arguments_.indexOf('--config');
  const configPath =
    configIndex === -1
      ? path.resolve('.visualforce-corpus.local.json')
      : path.resolve(arguments_[configIndex + 1]);
  const report = await runValidation({
    configPath,
    skipBaseline: update,
  });
  printSummary(report);

  if (report.totals.failedPaths > 0) {
    process.exitCode = 1;
    return;
  }
  if (update) {
    await updateBaseline(configPath, report.totals);
    console.log(
      `Updated baseline to ${report.totals.paths} paths and ${report.totals.uniqueContents} unique contents.`,
    );
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
