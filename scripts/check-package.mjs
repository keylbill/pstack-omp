import assert from 'node:assert/strict';
import { isUtf8 } from 'node:buffer';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const cursorTerms = [
  'subagent_type',
  'run_in_background',
  'TodoWrite',
  '.cursor/',
  'cloud agent',
  'AskQuestion',
  'composer',
];

const cursorTextRoots = ['skills/', 'agents/', 'automations/', 'docs/guide/'];

const root = fileURLToPath(new URL('../', import.meta.url));
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const provenance = JSON.parse(await readFile(join(root, 'upstream.json'), 'utf8'));
assert.equal(metadata.name, 'pstack');
assert.equal(metadata.upstreamVersion, provenance.upstreamVersion);
const upstreamVersionPattern = provenance.upstreamVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
assert.match(metadata.version, new RegExp(`^${upstreamVersionPattern}-omp\\.\\d+$`));
assert.match(provenance.commit, /^[0-9a-f]{40}$/i);
assert.equal(metadata.repository.url, 'https://github.com/keylbill/pstack-omp.git');
assert.deepEqual(metadata.omp.extensions, ['./extensions/pstack.js']);
assert.match(await readFile(join(root, 'LICENSE'), 'utf8'), /Lauren Tan/);
assert.match(await readFile(join(root, 'LICENSE.cursor-team-kit'), 'utf8'), /Cursor/);
for (const path of ['plugin.json', '.cursor-plugin', 'commands', 'models.json', 'installation.json', 'scripts/rollback.py', 'scripts/test_rollback.py']) {
  await assert.rejects(lstat(join(root, path)), { code: 'ENOENT' }, `${path} must not ship`);
}
const excluded = new Set(['.git', 'node_modules']);
const privateNames = /^(?:__pycache__|\.env(?:\..+)?|installation\.json|models\.json|receipts|backups|sessions|memories)$/;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    const name = relative(root, path).split(sep).join('/');
    assert.ok(!entry.isSymbolicLink(), `Unexpected distribution symlink ${name}`);
    assert.ok(!privateNames.test(entry.name), `Private state must not ship at ${name}`);
    assert.ok(!/\.(?:pyc|pyo|log|bak|backup)$/.test(entry.name), `Runtime artifact must not ship at ${name}`);
    if (entry.isDirectory()) {
      await inspect(path);
    } else if (entry.isFile() && cursorTextRoots.some(prefix => name.startsWith(prefix))) {
      const bytes = await readFile(path);
      if (bytes.includes(0) || !isUtf8(bytes)) continue;
      const lines = bytes.toString('utf8').split(/\r?\n/);
      for (const [index, line] of lines.entries()) {
        const normalized = line.toLowerCase();
        for (const term of cursorTerms) {
          assert.ok(!normalized.includes(term.toLowerCase()), `${name}:${index + 1}: Cursor-only term ${JSON.stringify(term)} must not ship`);
        }
      }
    }
  }
}
await inspect(root);
for (const name of ['poteto-agent.md', 'comment-sicko.md']) await lstat(join(root, 'agents', name));
for (const name of ['control-cli', 'control-ui', 'deslop', 'create-skill', 'setup-pstack', 'poteto-mode', 'statechart', 'create-formal-verification-skill', 'maintain-formal-verification-skill', 'ketchup-video']) {
  await lstat(join(root, 'skills', name, 'SKILL.md'));
}
console.log('Public package boundaries passed. This is not a secret scan or native runtime proof.');
