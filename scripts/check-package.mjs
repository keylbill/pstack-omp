import assert from 'node:assert/strict';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const provenance = JSON.parse(await readFile(join(root, 'upstream.json'), 'utf8'));
assert.equal(metadata.name, 'pstack');
assert.equal(metadata.version, '0.15.25-omp.1');
assert.equal(metadata.upstreamVersion, provenance.upstreamVersion);
assert.equal(metadata.repository.url, 'https://github.com/keylbill/pstack-omp.git');
assert.deepEqual(metadata.omp.extensions, ['./extensions/pstack.js']);
assert.match(await readFile(join(root, 'LICENSE'), 'utf8'), /Lauren Tan/);
assert.match(await readFile(join(root, 'LICENSE.cursor-team-kit'), 'utf8'), /Cursor/);
for (const path of ['plugin.json', 'models.json', 'installation.json', 'scripts/rollback.py', 'scripts/test_rollback.py']) {
  await assert.rejects(lstat(join(root, path)), { code: 'ENOENT' }, `${path} must not ship`);
}
const excluded = new Set(['.git', 'node_modules']);
const privateNames = /^(?:__pycache__|\.env(?:\..+)?|installation\.json|models\.json|receipts|backups|sessions|memories)$/;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    const name = relative(root, path);
    assert.ok(!entry.isSymbolicLink(), `Unexpected distribution symlink ${name}`);
    assert.ok(!privateNames.test(entry.name), `Private state must not ship at ${name}`);
    assert.ok(!/\.(?:pyc|pyo|log|bak|backup)$/.test(entry.name), `Runtime artifact must not ship at ${name}`);
    if (entry.isDirectory()) await inspect(path);
  }
}
await inspect(root);
for (const name of ['poteto-agent.md', 'comment-sicko.md']) await lstat(join(root, 'agents', name));
for (const name of ['control-cli', 'control-ui', 'deslop', 'create-skill', 'setup-pstack', 'poteto-mode']) {
  await lstat(join(root, 'skills', name, 'SKILL.md'));
}
console.log('Public package boundaries passed. This is not a secret scan or native runtime proof.');
