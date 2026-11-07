import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { devNull, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { applyChanges, compareTrees, main, renderReport, run, UPSTREAM_REPOSITORY } from './upstream.mjs';

const roots = [];
after(() => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))));

const BASE_SHA = 'a'.repeat(40);
const MINOR_SHA = 'b'.repeat(40);
const PATCH_SHA = 'c'.repeat(40);
const OUTSIDE_SHA = 'd'.repeat(40);
const GIT_ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: devNull };

async function put(root, path, spec) {
  const { content, executable = false } = typeof spec === 'string' || Buffer.isBuffer(spec) ? { content: spec } : spec;
  const file = join(root, ...path.split('/'));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
  await chmod(file, executable ? 0o755 : 0o644);
}

async function tree(files) {
  const root = await mkdtemp(join(tmpdir(), 'pstack-upstream-test-'));
  roots.push(root);
  for (const [path, spec] of Object.entries(files)) await put(root, path, spec);
  return root;
}

async function snapshot(root) {
  const files = {};
  const visit = async (relative) => {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(path);
      else {
        const stat = await lstat(join(root, path));
        files[path] = { content: (await readFile(join(root, path))).toString('base64'), executable: (stat.mode & 0o100) !== 0 };
      }
    }
  };
  await visit('');
  return files;
}

async function file(root, path, encoding = 'utf8') {
  try {
    const stat = await lstat(join(root, ...path.split('/')));
    return { content: await readFile(join(root, ...path.split('/')), { encoding }), executable: (stat.mode & 0o100) !== 0 };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' });

describe('three-way classification and apply', async () => {
  const baseRoot = await tree({
    'pstack/skills/ff/SKILL.md': 'base\n',
    'pstack/skills/merge/SKILL.md': 'one\ntwo\nthree\nfour\nfive\n',
    'pstack/skills/conflict/SKILL.md': 'alpha\nbeta\ngamma\n',
    'pstack/skills/removed/SKILL.md': 'old\n',
    'pstack/skills/conflict-delete/SKILL.md': 'old\n',
    'pstack/skills/port-absent/SKILL.md': 'base\n',
    'pstack/skills/already/SKILL.md': 'base\n',
    'pstack/skills/unchanged/SKILL.md': 'same\n',
    'pstack/skills/exec-applied/run.sh': { content: 'echo same\n', executable: false },
    'pstack/skills/exec-kept/run.sh': { content: 'echo base\n', executable: true },
    'pstack/skills/exec-kept-noop/run.sh': { content: 'echo base\n', executable: false },
    'pstack/skills/exec-caught-up/run.sh': { content: 'echo same\n', executable: false },
    'pstack/skills/exec-reported/run.sh': { content: 'echo base\n', executable: false },
    'pstack/assets/logo.png': Buffer.from([0x89, 0x50, 0, 1]),
    'pstack/assets/tool.bin': { content: Buffer.from([0, 1]), executable: false },
    'pstack/assets/kept.bin': { content: Buffer.from([0, 1]), executable: false },
    'pstack/README.md': 'readme base\n',
    'pstack/removed-doc.md': 'gone\n',
    'cursor-team-kit/LICENSE': 'license base\n',
    'cursor-team-kit/skills/other/SKILL.md': 'base\n',
  });
  const candidateRoot = await tree({
    'pstack/skills/ff/SKILL.md': 'candidate\n',
    'pstack/skills/merge/SKILL.md': 'one\ntwo\nthree\nfour\nFIVE upstream\n',
    'pstack/skills/conflict/SKILL.md': 'alpha\nbeta upstream\ngamma\n',
    'pstack/skills/added/run.sh': { content: 'echo new\n', executable: true },
    'pstack/skills/conflict-add/SKILL.md': 'upstream new\n',
    'pstack/skills/port-absent/SKILL.md': 'candidate\n',
    'pstack/skills/already/SKILL.md': 'candidate\n',
    'pstack/skills/unchanged/SKILL.md': 'same\n',
    'pstack/skills/exec-applied/run.sh': { content: 'echo same\n', executable: true },
    'pstack/skills/exec-kept/run.sh': { content: 'echo candidate\n', executable: true },
    'pstack/skills/exec-kept-noop/run.sh': { content: 'echo upstream\n', executable: false },
    'pstack/skills/exec-caught-up/run.sh': { content: 'echo same\n', executable: true },
    'pstack/skills/exec-reported/run.sh': { content: 'echo candidate\n', executable: true },
    'pstack/assets/logo.png': Buffer.from([0x89, 0x50, 0, 2]),
    'pstack/assets/tool.bin': { content: Buffer.from([0, 2]), executable: true },
    'pstack/assets/kept.bin': { content: Buffer.from([0, 2]), executable: false },
    'pstack/README.md': 'readme candidate\n',
    'pstack/new-doc.md': 'new doc\n',
    'cursor-team-kit/LICENSE': 'license candidate\n',
    'cursor-team-kit/skills/other/SKILL.md': 'candidate\n',
  });
  const portRoot = await tree({
    'skills/ff/SKILL.md': 'base\n',
    'skills/merge/SKILL.md': 'ONE port\ntwo\nthree\nfour\nfive\n',
    'skills/conflict/SKILL.md': 'alpha\nbeta port\ngamma\n',
    'skills/conflict-add/SKILL.md': 'port own\n',
    'skills/removed/SKILL.md': 'old\n',
    'skills/conflict-delete/SKILL.md': 'adapted\n',
    'skills/already/SKILL.md': 'candidate\n',
    'skills/unchanged/SKILL.md': 'port adapted\n',
    'skills/exec-applied/run.sh': { content: 'echo same\n', executable: false },
    'skills/exec-kept/run.sh': { content: 'echo base\n', executable: false },
    'skills/exec-kept-noop/run.sh': { content: 'echo upstream\n', executable: true },
    'skills/exec-caught-up/run.sh': { content: 'echo port\n', executable: true },
    'assets/logo.png': Buffer.from([0x89, 0x50, 0, 9]),
    'assets/tool.bin': { content: Buffer.from([0, 9]), executable: false },
    'assets/kept.bin': { content: Buffer.from([0, 9]), executable: true },
    'README.md': 'port readme\n',
    'LICENSE.cursor-team-kit': 'license base\n',
  });

  const before = await snapshot(portRoot);
  const entries = await compareTrees({ baseRoot, candidateRoot, portRoot });
  const report = renderReport({
    command: 'check',
    base: { commit: BASE_SHA, version: '1.0.0' },
    candidate: { commit: MINOR_SHA, version: '1.1.0' },
    entries,
  });

  it('reports every upstream-changed file with its class, and nothing else', () => {
    assert.deepEqual(Object.fromEntries(entries.map((entry) => [entry.upstreamPath, entry.class])), {
      'cursor-team-kit/LICENSE': 'fast-forward',
      'pstack/README.md': 'review-modified',
      'pstack/assets/kept.bin': 'conflict-binary',
      'pstack/assets/logo.png': 'conflict-binary',
      'pstack/assets/tool.bin': 'conflict-binary',
      'pstack/new-doc.md': 'review-added',
      'pstack/removed-doc.md': 'review-removed',
      'pstack/skills/added/run.sh': 'added',
      'pstack/skills/already/SKILL.md': 'none',
      'pstack/skills/conflict-add/SKILL.md': 'conflict-add',
      'pstack/skills/conflict-delete/SKILL.md': 'conflict-delete',
      'pstack/skills/conflict/SKILL.md': 'conflict',
      'pstack/skills/exec-applied/run.sh': 'fast-forward',
      'pstack/skills/exec-caught-up/run.sh': 'merged',
      'pstack/skills/exec-kept-noop/run.sh': 'merged',
      'pstack/skills/exec-kept/run.sh': 'merged',
      'pstack/skills/exec-reported/run.sh': 'port-absent',
      'pstack/skills/ff/SKILL.md': 'fast-forward',
      'pstack/skills/merge/SKILL.md': 'merged',
      'pstack/skills/port-absent/SKILL.md': 'port-absent',
      'pstack/skills/removed/SKILL.md': 'removed',
    });
  });

  it('compares bytes and mode together and decides exec independently of the content class', () => {
    const dispositions = Object.fromEntries(
      entries
        .filter((entry) => /exec-|\.bin$|logo|ff\/|already\//.test(entry.upstreamPath))
        .map((entry) => [entry.upstreamPath, { class: entry.class, exec: entry.exec, change: entry.change?.type ?? null }]),
    );
    assert.deepEqual(dispositions, {
      'pstack/assets/kept.bin': { class: 'conflict-binary', exec: 'kept', change: null },
      'pstack/assets/logo.png': { class: 'conflict-binary', exec: null, change: null },
      'pstack/assets/tool.bin': { class: 'conflict-binary', exec: 'applied', change: 'chmod' },
      'pstack/skills/already/SKILL.md': { class: 'none', exec: null, change: null },
      'pstack/skills/exec-applied/run.sh': { class: 'fast-forward', exec: 'applied', change: 'chmod' },
      'pstack/skills/exec-caught-up/run.sh': { class: 'merged', exec: 'kept', change: null },
      'pstack/skills/exec-kept-noop/run.sh': { class: 'merged', exec: 'kept', change: null },
      'pstack/skills/exec-kept/run.sh': { class: 'merged', exec: 'kept', change: 'write' },
      'pstack/skills/exec-reported/run.sh': { class: 'port-absent', exec: 'reported', change: null },
      'pstack/skills/ff/SKILL.md': { class: 'fast-forward', exec: null, change: 'write' },
    });
  });

  it('comparison writes nothing to the port', async () => {
    assert.deepEqual(await snapshot(portRoot), before);
  });

  it('renders exec dispositions and review diffs in the report', () => {
    assert.match(report, /^- Candidate: `b{40}` \(pstack 1\.1\.0\)$/m);
    assert.match(report, /^## conflict \(1\)$/m);
    assert.match(report, /^- `pstack\/skills\/exec-applied\/run\.sh` -> `skills\/exec-applied\/run\.sh` \(exec applied: false -> true\)$/m);
    assert.match(report, /^- `pstack\/skills\/exec-kept\/run\.sh` -> `skills\/exec-kept\/run\.sh` \(exec kept: port false\)$/m);
    assert.match(report, /^- `pstack\/skills\/exec-kept-noop\/run\.sh` -> `skills\/exec-kept-noop\/run\.sh` \(exec kept: port true\)$/m);
    assert.match(report, /^- `pstack\/skills\/exec-reported\/run\.sh` -> `skills\/exec-reported\/run\.sh` \(exec reported: false -> true\)$/m);
    assert.match(report, /^- `pstack\/assets\/tool\.bin` -> `assets\/tool\.bin` \(exec applied: false -> true\)$/m);
    assert.match(report, /^- `pstack\/assets\/kept\.bin` -> `assets\/kept\.bin` \(exec kept: port true\)$/m);
    assert.match(report, /^-readme base\n\+readme candidate$/m);
    assert.match(report, /^\+new doc$/m);
    assert.match(report, /^-gone$/m);
    assert.doesNotMatch(report, /cursor-team-kit\/skills\/other/);
    assert.doesNotMatch(report, /skills\/unchanged/);
  });

  it('apply writes mapped results, keeps conflicts and adaptations, and never writes review files', async () => {
    await applyChanges(portRoot, entries);
    assert.deepEqual(await file(portRoot, 'skills/ff/SKILL.md'), { content: 'candidate\n', executable: false });
    assert.deepEqual(await file(portRoot, 'skills/merge/SKILL.md'), { content: 'ONE port\ntwo\nthree\nfour\nFIVE upstream\n', executable: false });
    const conflict = await file(portRoot, 'skills/conflict/SKILL.md');
    assert.match(conflict.content, /^<<<<<<< port\nbeta port\n=======\nbeta upstream\n>>>>>>> upstream\n/m);
    assert.deepEqual(await file(portRoot, 'skills/added/run.sh'), { content: 'echo new\n', executable: true });
    assert.deepEqual(await file(portRoot, 'skills/conflict-add/SKILL.md'), { content: 'port own\n', executable: false });
    assert.equal(await file(portRoot, 'skills/removed/SKILL.md'), null);
    assert.deepEqual(await file(portRoot, 'skills/conflict-delete/SKILL.md'), { content: 'adapted\n', executable: false });
    assert.equal(await file(portRoot, 'skills/port-absent/SKILL.md'), null);
    assert.equal(await file(portRoot, 'skills/exec-reported/run.sh'), null);
    assert.deepEqual(await file(portRoot, 'skills/already/SKILL.md'), { content: 'candidate\n', executable: false });
    assert.deepEqual(await file(portRoot, 'skills/unchanged/SKILL.md'), { content: 'port adapted\n', executable: false });
    assert.deepEqual(await file(portRoot, 'skills/exec-applied/run.sh'), { content: 'echo same\n', executable: true });
    assert.deepEqual(await file(portRoot, 'skills/exec-kept/run.sh'), { content: 'echo candidate\n', executable: false });
    assert.deepEqual(await file(portRoot, 'skills/exec-kept-noop/run.sh'), { content: 'echo upstream\n', executable: true });
    assert.deepEqual(await file(portRoot, 'skills/exec-caught-up/run.sh'), { content: 'echo port\n', executable: true });
    assert.deepEqual(await file(portRoot, 'assets/logo.png', null), { content: Buffer.from([0x89, 0x50, 0, 9]), executable: false });
    assert.deepEqual(await file(portRoot, 'assets/tool.bin', null), { content: Buffer.from([0, 9]), executable: true });
    assert.deepEqual(await file(portRoot, 'assets/kept.bin', null), { content: Buffer.from([0, 9]), executable: true });
    assert.deepEqual(await file(portRoot, 'LICENSE.cursor-team-kit'), { content: 'license candidate\n', executable: false });
    assert.deepEqual(await file(portRoot, 'README.md'), { content: 'port readme\n', executable: false });
    for (const path of ['pstack/README.md', 'new-doc.md', 'pstack/new-doc.md', 'skills/other/SKILL.md']) {
      assert.equal(await file(portRoot, path), null, `${path} must not be written`);
    }
  });
});

describe('exec-only upstream change on an adapted port file', () => {
  it('keeps port bytes and applies the candidate mode', async () => {
    const baseRoot = await tree({ 'pstack/skills/s/run.sh': { content: 'echo upstream\n', executable: false } });
    const candidateRoot = await tree({ 'pstack/skills/s/run.sh': { content: 'echo upstream\n', executable: true } });
    const portRoot = await tree({ 'skills/s/run.sh': { content: 'echo port\n', executable: false } });
    const entries = await compareTrees({ baseRoot, candidateRoot, portRoot });
    assert.deepEqual(
      entries.map((entry) => ({ class: entry.class, exec: entry.exec, change: entry.change?.type })),
      [{ class: 'merged', exec: 'applied', change: 'chmod' }],
    );
    await applyChanges(portRoot, entries);
    assert.deepEqual(await file(portRoot, 'skills/s/run.sh'), { content: 'echo port\n', executable: true });
  });
});

describe('run', async () => {
  const plugin = (version) => JSON.stringify({ name: 'pstack', version });
  const upstreamTrees = {
    [BASE_SHA]: await tree({ 'pstack/.cursor-plugin/plugin.json': plugin('1.0.0'), 'pstack/skills/s/SKILL.md': 'base\n' }),
    [MINOR_SHA]: await tree({ 'pstack/.cursor-plugin/plugin.json': plugin('1.1.0'), 'pstack/skills/s/SKILL.md': 'candidate\n' }),
    [PATCH_SHA]: await tree({ 'pstack/.cursor-plugin/plugin.json': plugin('1.0.0'), 'pstack/skills/s/SKILL.md': 'candidate\n' }),
    [OUTSIDE_SHA]: await tree({ 'pstack/.cursor-plugin/plugin.json': plugin('1.0.0'), 'pstack/skills/s/SKILL.md': 'base\n', 'harness/x.md': 'outside\n' }),
  };
  const materialized = [];
  const source = (head) => ({
    resolveHead: async () => head,
    materialize: async (sha) => {
      materialized.push(sha);
      return upstreamTrees[sha];
    },
  });

  async function repository() {
    const root = await tree({
      'upstream.json': `${JSON.stringify({ repository: UPSTREAM_REPOSITORY, commit: BASE_SHA, upstreamVersion: '1.0.0', roots: ['pstack'] }, null, 2)}\n`,
      'package.json': `${JSON.stringify({ name: 'pstack', version: '1.0.0-omp.3', upstreamVersion: '1.0.0', type: 'module' }, null, 2)}\n`,
      'package-lock.json': `${JSON.stringify({ name: 'pstack', version: '1.0.0-omp.3', lockfileVersion: 3, packages: { '': { name: 'pstack', version: '1.0.0-omp.3' }, 'node_modules/zod': { version: '4.0.0' } } }, null, 2)}\n`,
      'skills/s/SKILL.md': 'base\n',
    });
    git(root, 'init', '-q');
    git(root, 'add', '-A');
    git(root, '-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'fixture');
    return root;
  }

  it('check reports the delta and writes no repository files', async () => {
    const repoRoot = await repository();
    const before = await snapshot(repoRoot);
    const report = await run({ command: 'check', repoRoot, source: source(MINOR_SHA) });
    assert.match(report, /^- Base: `a{40}` \(pstack 1\.0\.0\)$/m);
    assert.match(report, /^- Candidate: `b{40}` \(pstack 1\.1\.0\)$/m);
    assert.match(report, /^- `pstack\/skills\/s\/SKILL\.md` -> `skills\/s\/SKILL\.md`$/m);
    assert.deepEqual(await snapshot(repoRoot), before);
    assert.equal(git(repoRoot, 'status', '--porcelain'), '');
  });

  it('prints one no-pull line without writes when candidate equals base or nothing in scope changed', async () => {
    const repoRoot = await repository();
    const before = await snapshot(repoRoot);
    for (const [head, command] of [[BASE_SHA, 'apply'], [OUTSIDE_SHA, 'apply'], [OUTSIDE_SHA, 'check']]) {
      const output = await run({ command, repoRoot, source: source(head) });
      assert.match(output, /^No upstream pull needed: [^\n]*\n$/);
    }
    assert.deepEqual(await snapshot(repoRoot), before);
  });

  it('apply refuses a dirty tree before fetching anything, even when candidate equals base', async () => {
    const repoRoot = await repository();
    await writeFile(join(repoRoot, 'scratch.txt'), 'local work\n');
    materialized.length = 0;
    for (const head of [MINOR_SHA, BASE_SHA]) {
      await assert.rejects(run({ command: 'apply', repoRoot, source: source(head) }), /clean git tree/);
    }
    assert.deepEqual(materialized, []);
    assert.deepEqual(await file(repoRoot, 'skills/s/SKILL.md'), { content: 'base\n', executable: false });
  });

  it('apply writes results, starts a new omp series when the upstream version changes, and leaves the lockfile alone', async () => {
    const repoRoot = await repository();
    const lockBefore = await readFile(join(repoRoot, 'package-lock.json'), 'utf8');
    const report = await run({ command: 'apply', repoRoot, source: source(MINOR_SHA) });
    assert.match(report, /^- Port version: 1\.0\.0-omp\.3 -> 1\.1\.0-omp\.1$/m);
    assert.deepEqual(await file(repoRoot, 'skills/s/SKILL.md'), { content: 'candidate\n', executable: false });
    const provenance = JSON.parse(await readFile(join(repoRoot, 'upstream.json'), 'utf8'));
    assert.equal(provenance.commit, MINOR_SHA);
    assert.equal(provenance.upstreamVersion, '1.1.0');
    const metadata = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));
    assert.equal(metadata.version, '1.1.0-omp.1');
    assert.equal(metadata.upstreamVersion, '1.1.0');
    assert.equal(await readFile(join(repoRoot, 'package-lock.json'), 'utf8'), lockBefore);
  });

  it('apply increments the omp release when the upstream version is unchanged', async () => {
    const repoRoot = await repository();
    await run({ command: 'apply', repoRoot, source: source(PATCH_SHA) });
    const metadata = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));
    assert.equal(metadata.version, '1.0.0-omp.4');
    assert.equal(JSON.parse(await readFile(join(repoRoot, 'upstream.json'), 'utf8')).commit, PATCH_SHA);
  });

  it('CLI uses the working directory as the repository and rejects bad arguments', async () => {
    const repoRoot = await repository();
    const capture = () => {
      const chunks = [];
      return { chunks, write: (chunk) => chunks.push(chunk) };
    };
    const out = capture();
    const err = capture();
    assert.equal(await main(['check'], { cwd: repoRoot, source: source(MINOR_SHA), stdout: out, stderr: err }), 0);
    assert.match(out.chunks.join(''), /^# Upstream sync check$/m);
    assert.equal(await main(['check', '--base', 'abc'], { cwd: repoRoot, source: source(MINOR_SHA), stdout: out, stderr: err }), 1);
    assert.equal(await main(['sync'], { cwd: repoRoot, source: source(MINOR_SHA), stdout: out, stderr: err }), 1);
    assert.equal(await main(['check'], { cwd: join(repoRoot, 'skills'), source: source(MINOR_SHA), stdout: out, stderr: err }), 1);
  });
});
