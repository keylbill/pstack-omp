import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, rmdir, writeFile } from 'node:fs/promises';
import { devNull, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const UPSTREAM_REPOSITORY = 'https://github.com/cursor/plugins';
const ARCHIVE_URL = 'https://codeload.github.com/cursor/plugins/tar.gz/';
const VERSION_FILE = 'pstack/.cursor-plugin/plugin.json';
const FULL_SHA = /^[0-9a-f]{40}$/;
const USAGE = 'Usage: node scripts/upstream.mjs check|apply [--base <full-sha>] [--candidate <full-sha>]';
const ISOLATED_GIT_ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: devNull };

export const REGISTRY = Object.freeze([
  { upstreamPrefix: 'pstack/skills/', portPrefix: 'skills/', kind: 'merge' },
  { upstreamPrefix: 'pstack/agents/', portPrefix: 'agents/', kind: 'merge' },
  { upstreamPrefix: 'pstack/assets/', portPrefix: 'assets/', kind: 'merge' },
  { upstreamPrefix: 'pstack/automations/', portPrefix: 'automations/', kind: 'merge' },
  { upstreamPrefix: 'pstack/docs/guide/', portPrefix: 'docs/guide/', kind: 'merge' },
  { upstreamPrefix: 'pstack/LICENSE', portPrefix: 'LICENSE', kind: 'merge' },
  { upstreamPrefix: 'cursor-team-kit/skills/deslop/', portPrefix: 'skills/deslop/', kind: 'merge' },
  { upstreamPrefix: 'cursor-team-kit/skills/control-cli/', portPrefix: 'skills/control-cli/', kind: 'merge' },
  { upstreamPrefix: 'cursor-team-kit/skills/control-ui/', portPrefix: 'skills/control-ui/', kind: 'merge' },
  { upstreamPrefix: 'cursor-team-kit/LICENSE', portPrefix: 'LICENSE.cursor-team-kit', kind: 'merge' },
  { upstreamPrefix: 'pstack/', portPrefix: null, kind: 'review' },
]);

const isDirectoryPrefix = (prefix) => prefix.endsWith('/');
const SCAN_ROOTS = REGISTRY.map(({ upstreamPrefix }) => upstreamPrefix).filter(
  (prefix) => !REGISTRY.some(({ upstreamPrefix }) => upstreamPrefix !== prefix && isDirectoryPrefix(upstreamPrefix) && prefix.startsWith(upstreamPrefix)),
);

export const CLASSES = Object.freeze({
  conflict: 'Upstream and port both changed these lines. Apply writes the port file with `<<<<<<< port` / `>>>>>>> upstream` markers.',
  'conflict-add': 'Upstream added a file that the port already has with different content. The port file is kept.',
  'conflict-delete': 'Upstream removed a file that the port adapted. The port file is kept.',
  'conflict-binary': 'Upstream and port both changed this binary file. The port bytes are kept. The exec note gives the mode decision.',
  'port-absent': 'Upstream modified a file that the port does not have. Nothing is written.',
  'fast-forward': 'The port matched base. Apply writes the candidate file.',
  merged: 'Upstream and port changes merged cleanly. Apply writes the merged file.',
  added: 'New upstream file. Apply writes it.',
  removed: 'Upstream removed a file that the port kept unchanged. Apply deletes it.',
  none: 'The port already has the upstream content and mode. Nothing is written.',
  'review-added': 'Unmapped upstream file added. Review for OMP nativeness. Never written.',
  'review-removed': 'Unmapped upstream file removed. Review for OMP nativeness. Never written.',
  'review-modified': 'Unmapped upstream file modified. Review for OMP nativeness. Never written.',
});

export function resolveMapping(upstreamPath) {
  const entry = REGISTRY.find(({ upstreamPrefix }) =>
    isDirectoryPrefix(upstreamPrefix) ? upstreamPath.startsWith(upstreamPrefix) : upstreamPath === upstreamPrefix,
  );
  if (!entry) return null;
  if (entry.kind === 'review') return { kind: 'review', portPath: null };
  return { kind: 'merge', portPath: entry.portPrefix + upstreamPath.slice(entry.upstreamPrefix.length) };
}

function exec(file, args, { cwd, env = process.env } = {}) {
  return new Promise((resolvePromise, reject) => {
    execFile(file, args, { cwd, env, encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') return reject(error);
      resolvePromise({ code: error ? error.code : 0, stdout, stderr: stderr.toString('utf8').trim() });
    });
  });
}

async function execOk(file, args, options) {
  const result = await exec(file, args, options);
  if (result.code !== 0) throw new Error(`${file} ${args[0]} failed (exit ${result.code}): ${result.stderr}`);
  return result.stdout;
}

const toFsPath = (root, path) => join(root, ...path.split('/'));

async function readSide(root, path) {
  let stat;
  try {
    stat = await lstat(toFsPath(root, path));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
  if (!stat.isFile()) throw new Error(`${path} under ${root} is not a regular file`);
  return { bytes: await readFile(toFsPath(root, path)), executable: (stat.mode & 0o100) !== 0 };
}

const sameSide = (left, right) =>
  left === null || right === null ? left === right : left.executable === right.executable && left.bytes.equals(right.bytes);

async function listTree(root, prefix) {
  const files = [];
  const visit = async (path) => {
    let stat;
    try {
      stat = await lstat(toFsPath(root, path));
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return;
      throw error;
    }
    if (stat.isDirectory()) {
      for (const name of (await readdir(toFsPath(root, path))).sort()) await visit(`${path}/${name}`);
    } else if (stat.isFile()) {
      files.push(path);
    } else {
      throw new Error(`Unsupported upstream entry ${path}: only regular files and directories are compared`);
    }
  };
  await visit(prefix.replace(/\/$/, ''));
  return files;
}

async function mergeText(scratch, port, base, candidate) {
  const dir = await mkdtemp(join(scratch, 'merge-'));
  await Promise.all([writeFile(join(dir, 'port'), port), writeFile(join(dir, 'base'), base), writeFile(join(dir, 'upstream'), candidate)]);
  const { code, stdout, stderr } = await exec(
    'git',
    ['merge-file', '-p', '-L', 'port', '-L', 'base', '-L', 'upstream', 'port', 'base', 'upstream'],
    { cwd: dir, env: ISOLATED_GIT_ENV },
  );
  if (code === 0) return { clean: true, bytes: stdout };
  if (code > 0 && code < 128) return { clean: false, bytes: stdout };
  throw new Error(`git merge-file failed (exit ${code}): ${stderr}`);
}

async function unifiedDiff(scratch, path, base, candidate) {
  const dir = await mkdtemp(join(scratch, 'diff-'));
  const stage = async (label, side) => {
    if (!side) return devNull;
    const relative = `${label}/${path}`;
    const file = toFsPath(dir, relative);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, side.bytes);
    await chmod(file, side.executable ? 0o755 : 0o644);
    return relative;
  };
  const args = ['diff', '--no-index', '--no-color', '--no-ext-diff', '--no-textconv', '--no-prefix', '--', await stage('a', base), await stage('b', candidate)];
  const { code, stdout, stderr } = await exec('git', args, { cwd: dir, env: ISOLATED_GIT_ENV });
  if (code !== 0 && code !== 1) throw new Error(`git diff failed for ${path} (exit ${code}): ${stderr}`);
  return stdout.toString('utf8');
}

const isBinary = (bytes) => bytes.includes(0);

const upstreamChange = ({ base, candidate }) => (base === null ? 'add' : candidate === null ? 'delete' : 'modify');

const portAbsent = ({ port }) => port === null;
const portMatchesBase = ({ port, base }) => sameSide(port, base);
const portMatchesCandidate = ({ port, candidate }) => sameSide(port, candidate);
const anyBinary = ({ base, port, candidate }) => [base, port, candidate].some(({ bytes }) => isBinary(bytes));
const otherwise = () => true;

const reportExec = ({ base, candidate }) => (base.executable !== candidate.executable ? 'reported' : null);

function execDisposition({ base, port, candidate }) {
  if (port.executable !== base.executable) return { exec: 'kept', executable: port.executable };
  return { exec: base.executable !== candidate.executable ? 'applied' : null, executable: candidate.executable };
}

function resolvedOutcome(className, bytes, sides) {
  const { exec, executable } = execDisposition(sides);
  const { port } = sides;
  const change = !bytes.equals(port.bytes)
    ? { type: 'write', bytes, executable }
    : executable !== port.executable
      ? { type: 'chmod', executable }
      : null;
  return { class: className, exec, change };
}

const untouched = (className, exec = () => null) => (sides) => ({ class: className, exec: exec(sides), change: null });

const DECISIONS = Object.freeze({
  add: [
    {
      when: portAbsent,
      resolve: ({ candidate }) => ({ class: 'added', exec: null, change: { type: 'write', bytes: candidate.bytes, executable: candidate.executable } }),
    },
    { when: portMatchesCandidate, resolve: untouched('none') },
    { when: otherwise, resolve: untouched('conflict-add') },
  ],
  delete: [
    { when: portAbsent, resolve: untouched('none') },
    { when: portMatchesBase, resolve: () => ({ class: 'removed', exec: null, change: { type: 'delete' } }) },
    { when: otherwise, resolve: untouched('conflict-delete') },
  ],
  modify: [
    { when: portAbsent, resolve: untouched('port-absent', reportExec) },
    { when: portMatchesBase, resolve: (sides) => resolvedOutcome('fast-forward', sides.candidate.bytes, sides) },
    { when: portMatchesCandidate, resolve: untouched('none') },
    { when: anyBinary, resolve: (sides) => resolvedOutcome('conflict-binary', sides.port.bytes, sides) },
    {
      when: otherwise,
      resolve: async (sides, merge) => {
        const merged = await merge(sides.port.bytes, sides.base.bytes, sides.candidate.bytes);
        return resolvedOutcome(merged.clean ? 'merged' : 'conflict', merged.bytes, sides);
      },
    },
  ],
});

function classifyMerge(sides, merge) {
  return DECISIONS[upstreamChange(sides)].find(({ when }) => when(sides)).resolve(sides, merge);
}

const EXEC_NOTES = {
  applied: (entry) => `exec applied: ${entry.base} -> ${entry.candidate}`,
  kept: (entry) => `exec kept: port ${entry.port}`,
  reported: (entry) => `exec reported: ${entry.base} -> ${entry.candidate}`,
};

export async function compareTrees({ baseRoot, candidateRoot, portRoot }) {
  const paths = new Set();
  for (const root of [baseRoot, candidateRoot]) {
    for (const prefix of SCAN_ROOTS) for (const path of await listTree(root, prefix)) paths.add(path);
  }
  const scratch = await mkdtemp(join(tmpdir(), 'pstack-upstream-compare-'));
  try {
    const entries = [];
    for (const upstreamPath of [...paths].sort()) {
      const base = await readSide(baseRoot, upstreamPath);
      const candidate = await readSide(candidateRoot, upstreamPath);
      if (sameSide(base, candidate)) continue;
      const mapping = resolveMapping(upstreamPath);
      if (!mapping) throw new Error(`Upstream path ${upstreamPath} has no registry mapping`);
      if (mapping.kind === 'review') {
        const reviewClass = !base ? 'review-added' : !candidate ? 'review-removed' : 'review-modified';
        entries.push({ upstreamPath, kind: 'review', portPath: null, class: reviewClass, exec: null, change: null, diff: await unifiedDiff(scratch, upstreamPath, base, candidate) });
        continue;
      }
      const port = await readSide(portRoot, mapping.portPath);
      const outcome = await classifyMerge({ base, port, candidate }, (...sides) => mergeText(scratch, ...sides));
      const modes = { base: base?.executable ?? null, port: port?.executable ?? null, candidate: candidate?.executable ?? null };
      entries.push({ upstreamPath, kind: 'merge', portPath: mapping.portPath, ...outcome, modes, diff: null });
    }
    return entries;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function assertWritable(root, path) {
  const segments = path.split('/');
  if (path.startsWith('/') || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`Refusing to write unsafe port path ${path}`);
  }
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    current = join(current, segment);
    try {
      if (!(await lstat(current)).isDirectory()) throw new Error(`Refusing to write ${path}: ${current} is not a real directory`);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
  }
  try {
    if (!(await lstat(join(current, segments.at(-1)))).isFile()) throw new Error(`Refusing to replace non-regular file ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function pruneEmptyParents(root, path) {
  const segments = path.split('/');
  for (let depth = segments.length - 1; depth > 0; depth -= 1) {
    try {
      await rmdir(join(root, ...segments.slice(0, depth)));
    } catch (error) {
      if (error.code === 'ENOTEMPTY' || error.code === 'EEXIST') return;
      throw error;
    }
  }
}

const APPLY = {
  async write(root, path, change) {
    const file = toFsPath(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, change.bytes);
    await chmod(file, change.executable ? 0o755 : 0o644);
  },
  async chmod(root, path, change) {
    await chmod(toFsPath(root, path), change.executable ? 0o755 : 0o644);
  },
  async delete(root, path) {
    await rm(toFsPath(root, path));
    await pruneEmptyParents(root, path);
  },
};

export async function applyChanges(portRoot, entries) {
  const planned = entries.filter((entry) => entry.change);
  for (const entry of planned) await assertWritable(portRoot, entry.portPath);
  for (const entry of planned) await APPLY[entry.change.type](portRoot, entry.portPath, entry.change);
}

export function nextPortVersion(currentVersion, currentUpstreamVersion, candidateUpstreamVersion) {
  if (candidateUpstreamVersion !== currentUpstreamVersion) return `${candidateUpstreamVersion}-omp.1`;
  const match = /^(.+)-omp\.(\d+)$/.exec(currentVersion);
  if (!match || match[1] !== currentUpstreamVersion) {
    throw new Error(`package.json version ${currentVersion} is not ${currentUpstreamVersion}-omp.<N>`);
  }
  return `${match[1]}-omp.${Number(match[2]) + 1}`;
}

function setTopLevelString(text, key, value, file) {
  const pattern = new RegExp(`^(  ${JSON.stringify(key)}: )"(?:[^"\\\\]|\\\\.)*"`, 'gm');
  if (text.match(pattern)?.length !== 1) throw new Error(`${file} must contain exactly one top-level "${key}" string`);
  const next = text.replace(pattern, (_, lead) => lead + JSON.stringify(value));
  if (JSON.parse(next)[key] !== value) throw new Error(`Failed to update "${key}" in ${file}`);
  return next;
}

async function planProvenance(repoRoot, { commit, upstreamVersion }) {
  const upstreamPath = join(repoRoot, 'upstream.json');
  const packagePath = join(repoRoot, 'package.json');
  const packageText = await readFile(packagePath, 'utf8');
  const metadata = JSON.parse(packageText);
  const to = nextPortVersion(metadata.version, metadata.upstreamVersion, upstreamVersion);
  let upstreamText = await readFile(upstreamPath, 'utf8');
  upstreamText = setTopLevelString(upstreamText, 'commit', commit, 'upstream.json');
  upstreamText = setTopLevelString(upstreamText, 'upstreamVersion', upstreamVersion, 'upstream.json');
  let nextPackage = setTopLevelString(packageText, 'version', to, 'package.json');
  nextPackage = setTopLevelString(nextPackage, 'upstreamVersion', upstreamVersion, 'package.json');
  return {
    from: metadata.version,
    to,
    files: [
      { path: upstreamPath, text: upstreamText },
      { path: packagePath, text: nextPackage },
    ],
  };
}

function validateArchiveListing(listing, top) {
  for (const name of listing.split('\n').filter(Boolean)) {
    if (name === 'pax_global_header') continue;
    const segments = name.replace(/\/$/, '').split('/');
    if (segments[0] !== top || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
      throw new Error(`Unsafe or unexpected archive entry ${JSON.stringify(name)}`);
    }
  }
}

export const githubSource = {
  async resolveHead() {
    const output = (await execOk('git', ['ls-remote', UPSTREAM_REPOSITORY, 'HEAD'])).toString('utf8');
    const match = /^([0-9a-f]{40})\tHEAD$/m.exec(output);
    if (!match) throw new Error(`git ls-remote ${UPSTREAM_REPOSITORY} HEAD returned no commit`);
    return match[1];
  },
  async materialize(sha, dir) {
    const archive = join(dir, 'archive.tar.gz');
    const tree = join(dir, 'tree');
    const top = `plugins-${sha}`;
    await mkdir(tree, { recursive: true });
    const response = await fetch(`${ARCHIVE_URL}${sha}`);
    if (!response.ok) throw new Error(`Fetching ${ARCHIVE_URL}${sha} failed with HTTP ${response.status}`);
    await writeFile(archive, Buffer.from(await response.arrayBuffer()));
    validateArchiveListing((await execOk('tar', ['-tzf', archive])).toString('utf8'), top);
    await execOk('tar', ['-xzf', archive, '--no-same-owner', '-C', tree]);
    const extracted = (await readdir(tree)).filter((name) => name !== 'pax_global_header');
    if (extracted.length !== 1 || extracted[0] !== top || !(await lstat(join(tree, top))).isDirectory()) {
      throw new Error(`Archive for ${sha} does not contain exactly ${top}/`);
    }
    return join(tree, top);
  },
};

async function readPluginVersion(root, sha) {
  const side = await readSide(root, VERSION_FILE);
  const version = side && JSON.parse(side.bytes.toString('utf8')).version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/.test(version)) {
    throw new Error(`Upstream ${sha} has no valid version in ${VERSION_FILE}`);
  }
  return version;
}

function fenced(text) {
  const longest = (text.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}diff\n${text.endsWith('\n') ? text : `${text}\n`}${fence}`;
}

export function renderReport({ command, base, candidate, entries, portVersion = null }) {
  const lines = [
    `# Upstream sync ${command}`,
    '',
    `- Base: \`${base.commit}\` (pstack ${base.version})`,
    `- Candidate: \`${candidate.commit}\` (pstack ${candidate.version})`,
    `- Changed upstream files: ${entries.length}`,
  ];
  if (portVersion) lines.push(`- Port version: ${portVersion.from} -> ${portVersion.to}`);
  for (const [name, summary] of Object.entries(CLASSES)) {
    const members = entries.filter((entry) => entry.class === name);
    if (members.length === 0) continue;
    lines.push('', `## ${name} (${members.length})`, '', summary, '');
    for (const entry of members) {
      if (entry.kind === 'review') {
        lines.push(`- \`${entry.upstreamPath}\``, '', fenced(entry.diff), '');
      } else {
        const note = entry.exec ? ` (${EXEC_NOTES[entry.exec](entry.modes)})` : '';
        lines.push(`- \`${entry.upstreamPath}\` -> \`${entry.portPath}\`${note}`);
      }
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

async function assertCleanTree(repoRoot) {
  const status = await execOk('git', ['status', '--porcelain=v1', '--untracked-files=all', '-z'], { cwd: repoRoot });
  if (status.length > 0) throw new Error('apply requires a clean git tree; commit or stash changes first');
}

export async function run({ command, base, candidate, repoRoot, source = githubSource }) {
  if (command !== 'check' && command !== 'apply') throw new Error(USAGE);
  const provenance = JSON.parse(await readFile(join(repoRoot, 'upstream.json'), 'utf8'));
  if (provenance.repository !== UPSTREAM_REPOSITORY) {
    throw new Error(`upstream.json repository ${provenance.repository} is not ${UPSTREAM_REPOSITORY}`);
  }
  const baseCommit = base ?? provenance.commit;
  if (!FULL_SHA.test(baseCommit ?? '')) throw new Error(`Base must be a full lowercase commit sha, got ${baseCommit}`);
  const candidateCommit = candidate ?? (await source.resolveHead());
  if (!FULL_SHA.test(candidateCommit ?? '')) throw new Error(`Candidate must be a full lowercase commit sha, got ${candidateCommit}`);
  if (command === 'apply') await assertCleanTree(repoRoot);
  if (candidateCommit === baseCommit) return `No upstream pull needed: candidate ${candidateCommit} equals base.\n`;

  const temp = await mkdtemp(join(tmpdir(), 'pstack-upstream-'));
  try {
    await Promise.all([mkdir(join(temp, 'base')), mkdir(join(temp, 'candidate'))]);
    const baseRoot = await source.materialize(baseCommit, join(temp, 'base'));
    const candidateRoot = await source.materialize(candidateCommit, join(temp, 'candidate'));
    const baseSide = { commit: baseCommit, version: await readPluginVersion(baseRoot, baseCommit) };
    const candidateSide = { commit: candidateCommit, version: await readPluginVersion(candidateRoot, candidateCommit) };
    const entries = await compareTrees({ baseRoot, candidateRoot, portRoot: repoRoot });
    if (entries.length === 0) {
      return `No upstream pull needed: candidate ${candidateCommit} (pstack ${candidateSide.version}) has no mapped or review changes since base ${baseCommit}.\n`;
    }
    if (command === 'check') return renderReport({ command, base: baseSide, candidate: candidateSide, entries });
    const portVersion = await planProvenance(repoRoot, { commit: candidateCommit, upstreamVersion: candidateSide.version });
    await applyChanges(repoRoot, entries);
    for (const file of portVersion.files) await writeFile(file.path, file.text);
    return renderReport({ command, base: baseSide, candidate: candidateSide, entries, portVersion });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (command !== 'check' && command !== 'apply') throw new Error(USAGE);
  const options = { command };
  for (let index = 0; index < rest.length; index += 2) {
    const name = { '--base': 'base', '--candidate': 'candidate' }[rest[index]];
    if (!name || name in options || rest[index + 1] === undefined) throw new Error(USAGE);
    options[name] = rest[index + 1];
  }
  return options;
}

async function resolveRepoRoot(cwd) {
  const { code, stdout } = await exec('git', ['rev-parse', '--show-toplevel'], { cwd });
  if (code !== 0 || (await realpath(stdout.toString('utf8').trim())) !== (await realpath(cwd))) {
    throw new Error('Run from the root of the pstack-omp git repository');
  }
  return cwd;
}

export async function main(argv = process.argv.slice(2), { cwd = process.cwd(), source = githubSource, stdout = process.stdout, stderr = process.stderr } = {}) {
  try {
    const options = parseArgs(argv);
    stdout.write(await run({ ...options, repoRoot: await resolveRepoRoot(cwd), source }));
    return 0;
  } catch (error) {
    stderr.write(`upstream: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main();
}
