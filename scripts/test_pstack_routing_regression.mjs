import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { configurationFixture } from './fixtures/configuration.mjs';

const extension = new URL('../extensions/pstack.js', import.meta.url);
const models = configurationFixture();
const root = await mkdtemp(join(tmpdir(), 'pstack-routing-regression-'));
const agentDir = join(root, 'profile');
const configurationPath = join(agentDir, 'pstack', 'models.json');
await mkdir(join(root, 'extensions'));
await mkdir(join(root, 'skills'));
await mkdir(join(agentDir, 'pstack'), { recursive: true });
const loadedExtension = join(root, 'extensions/pstack.mjs');
await writeFile(loadedExtension, await readFile(extension));
await writeFile(configurationPath, JSON.stringify(models));
const hooks = new Map();
const tools = new Map();
const commands = new Map();
const messages = [];
const notifications = [];
const pi = {
  zod: z, pi: { getAgentDir: () => agentDir }, setLabel() {},
  registerTool(tool) { tools.set(tool.name, tool); },
  registerCommand(name, command) { commands.set(name, command); },
  on(name, fn) { hooks.set(name, fn); }, appendEntry() {},
  sendMessage(message) { messages.push(message); },
};
const factory = (await import(pathToFileURL(loadedExtension))).default;
await factory(pi);
const concreteModel = { provider: 'test', id: 'comparison-base', thinking: { mode: 'effort', efforts: ['high'] } };
const literalModel = { provider: 'test', id: 'literal:xhigh', thinking: { mode: 'effort', efforts: ['high'] } };
const concreteSelectors = new Map([
  ['test/comparison-base', concreteModel],
  ['comparison-base', concreteModel],
  ['test/comparison-base:high', concreteModel],
  ['comparison-base:high', concreteModel],
  ['test/comparison-base:xhigh', concreteModel],
  ['comparison-base:xhigh', concreteModel],
  ['test/literal:xhigh', literalModel],
  ['literal:xhigh', literalModel],
  ['test/literal:xhigh:xhigh', literalModel],
  ['literal:xhigh:xhigh', literalModel],
  ['test/opaque:high', concreteModel],
]);
const ctx = { agent: { kind: 'main', id: 'main' }, sessionManager: { getSessionId: () => 'routing-test', getSessionFile: () => undefined, getBranch: () => [] }, models: { resolve(selector) { if (selector === '@missing' || selector === 'test/opaque') return undefined; return concreteSelectors.get(selector) ?? { provider: 'test', id: selector, thinking: { mode: 'effort', efforts: ['low', 'high', 'xhigh'] } }; }, list() { return [...new Set([...Object.values(models.roles).flat().map(value => value === 'auto' || value === 'inherit-parent' ? '@default' : value), '@comparison:high', '@comparison:unsupported'])].map(id => ({ provider: 'test', id })).concat(concreteModel, literalModel); } , family: model => model.provider }, ui: { setStatus() {}, notify(message) { notifications.push(message); } } };
const event = { type: 'before_subagent_spawn', agent: 'poteto-agent', invocationKind: 'task', patterns: ['agent-profile-model'], spawnKey: 'CodeProbe' };
assert.ok(tools.has('pstack_plan'));
const plan = (params, context = ctx) => tools.get('pstack_plan').execute('test', params, undefined, undefined, context);
const hook = hooks.get('before_subagent_spawn');
const normalized = selector => selector === 'auto' || selector === 'inherit-parent' ? '@default' : selector;
assert.equal(await hook({ ...event, spawnKey: 'NativeOnlyProbe' }, ctx), undefined);
assert.equal((await plan({ action: 'register', helpers: [{ name: 'NativeOnlyProbe', role: 'bug-fix' }] })).isError, true);
let result = await plan({ action: 'register', helpers: [{ name: 'CodeProbe', role: 'bug-fix' }, { name: 'JudgeProbe', role: 'interrogate reviewers', panelIndex: 1 }] });
assert.notEqual(result.isError, true);
assert.equal((await hook(event, ctx)).model, normalized(models.roles['bug-fix']));
assert.equal(await hook(event, ctx), undefined);
assert.equal(await hook({ ...event, spawnKey: 'UnplannedProbe' }, ctx), undefined);
assert.equal((await hook({ ...event, spawnKey: 'JudgeProbe' }, ctx)).model, normalized(models.roles['interrogate reviewers'][1]));
assert.equal((await plan({ action: 'register', helpers: [{ name: 'CodeProbe', role: 'bug-fix' }] })).isError, true);
for (const helper of [{ name: 'BadRole', role: 'not a role' }, { name: 'BadPanel', role: 'interrogate reviewers' }, { name: 'BadIndex', role: 'interrogate reviewers', panelIndex: 999 }, { name: 'BadScalar', role: 'bug-fix', panelIndex: 0 }, { name: 'bad name', role: 'bug-fix' }]) assert.equal((await plan({ action: 'register', helpers: [helper] })).isError, true);
assert.notEqual((await plan({ action: 'register', helpers: [{ name: 'ExactProbe', role: 'bug-fix' }] })).isError, true);
assert.equal(await hook({ ...event, spawnKey: 'ExactProbe-2' }, ctx), undefined);
assert.equal(await hook({ ...event, invocationKind: 'eval', spawnKey: 'ExactProbe' }, ctx), undefined);
assert.equal(await hook({ ...event, spawnKey: undefined }, ctx), undefined);
assert.equal((await hook({ ...event, spawnKey: 'ExactProbe' }, ctx)).model, normalized(models.roles['bug-fix']));
assert.equal((await plan({ action: 'register', helpers: [{ name: 'PendingProbe', role: 'bug-fix' }] })).isError, undefined);
await plan({ action: 'clear' });
assert.equal(await hook({ ...event, spawnKey: 'PendingProbe' }, ctx), undefined);
const clearedRegistration = plan({ action: 'register', helpers: [{ name: 'ClearRaceProbe', role: 'bug-fix' }] });
await plan({ action: 'clear' });
assert.equal((await clearedRegistration).isError, true);
assert.deepEqual((await plan({ action: 'status' })).details.plans, []);
assert.equal(await hook({ ...event, spawnKey: 'ClearRaceProbe' }, ctx), undefined);
const transitionedRegistration = plan({ action: 'register', helpers: [{ name: 'TransitionRaceProbe', role: 'bug-fix' }] });
await hooks.get('session_before_switch')();
await plan({ action: 'status' });
assert.equal((await transitionedRegistration).isError, true);
assert.equal(await hook({ ...event, spawnKey: 'TransitionRaceProbe' }, ctx), undefined);
assert.equal((await plan({ action: 'register', helpers: [{ name: 'WorkerProbe', role: 'bug-fix' }] }, { ...ctx, agent: { kind: 'sub', id: 'ParentWorker' } })).isError, undefined);
assert.equal((await hook({ ...event, spawnKey: 'ParentWorker.WorkerProbe' }, { ...ctx, agent: { kind: 'sub', id: 'ParentWorker' } })).model, normalized(models.roles['bug-fix']));
for (const [index, selector] of ['auto', 'inherit-parent', '@default', '@custom:high'].entries()) {
  models.roles['bug-fix'] = selector;
  await writeFile(configurationPath, JSON.stringify(models));
  const name = `AliasProbe${index}`;
  assert.notEqual((await plan({ action: 'register', helpers: [{ name, role: 'bug-fix' }] })).isError, true);
  assert.equal((await hook({ ...event, spawnKey: name }, ctx)).model, normalized(selector));
}
models.roles['bug-fix'] = '@missing';
await writeFile(configurationPath, JSON.stringify(models));
assert.equal((await plan({ action: 'register', helpers: [{ name: 'AtomicProbe', role: 'how explorer' }, { name: 'MissingProbe', role: 'bug-fix' }] })).isError, true);
assert.equal(await hook({ ...event, spawnKey: 'AtomicProbe' }, ctx), undefined);
assert.equal(await hook({ ...event, spawnKey: 'MissingProbe' }, ctx), undefined);
models.roles['bug-fix'] = '@custom:unsupported';
await writeFile(configurationPath, JSON.stringify(models));
assert.equal((await plan({ action: 'register', helpers: [{ name: 'EffortProbe', role: 'bug-fix' }] })).isError, true);
const configurationBeforeComparison = await readFile(configurationPath, 'utf8');
assert.equal((await plan({ action: 'register', helpers: [{ name: 'ComparisonArm', selector: '@comparison:high' }] })).isError, undefined);
assert.deepEqual((await plan({ action: 'status' })).details.plans, [
  { spawnKey: 'ComparisonArm', name: 'ComparisonArm', source: 'explicit', selector: '@comparison:high' },
]);
assert.deepEqual(await hook({ ...event, spawnKey: 'ComparisonArm' }, ctx), {
  model: '@comparison:high',
  note: 'pstack explicit comparison arm',
});
assert.equal(await hook({ ...event, spawnKey: 'ComparisonArm' }, ctx), undefined);
for (const helper of [
  { name: 'ComparisonMissing', selector: '@missing' },
  { name: 'ComparisonUnavailable', selector: '@unavailable' },
  { name: 'ComparisonEffort', selector: '@comparison:unsupported' },
  { name: 'ComparisonRole', role: 'how explorer', selector: '@comparison:high' },
  { name: 'ComparisonIndex', panelIndex: 0, selector: '@comparison:high' },
  { name: 'ComparisonEmpty', selector: ' ' },
  { name: 'ConcreteQualifiedEffort', selector: 'test/comparison-base:xhigh' },
  { name: 'ConcreteBareEffort', selector: 'comparison-base:xhigh' },
  { name: 'ConcreteMissingPrefix', selector: 'test/opaque:high' },
  { name: 'LiteralQualifiedEffort', selector: 'test/literal:xhigh:xhigh' },
  { name: 'LiteralBareEffort', selector: 'literal:xhigh:xhigh' },
]) {
  const failed = await plan({ action: 'register', helpers: [{ name: `${helper.name}Valid`, selector: '@comparison:high' }, helper] });
  assert.equal(failed.isError, true);
  assert.equal(await hook({ ...event, spawnKey: `${helper.name}Valid` }, ctx), undefined);
  assert.equal(await hook({ ...event, spawnKey: helper.name }, ctx), undefined);
}
for (const [name, selector] of [
  ['ConcreteQualified', 'test/comparison-base:high'],
  ['ConcreteBare', 'comparison-base:high'],
  ['LiteralQualified', 'test/literal:xhigh'],
  ['LiteralBare', 'literal:xhigh'],
]) {
  assert.equal((await plan({ action: 'register', helpers: [{ name, selector }] })).isError, undefined);
  assert.deepEqual(await hook({ ...event, spawnKey: name }, ctx), {
    model: selector,
    note: 'pstack explicit comparison arm',
  });
}
assert.equal(await readFile(configurationPath, 'utf8'), configurationBeforeComparison);
assert.equal((await plan({ action: 'register', helpers: [{ name: 'RoleAfterComparison', role: 'how explorer' }] })).isError, undefined);
assert.equal((await hook({ ...event, spawnKey: 'RoleAfterComparison' }, ctx)).model, normalized(models.roles['how explorer']));
assert.equal((await plan({ action: 'register', helpers: [
  { name: 'NullWireExplicit', role: null, panelIndex: null, selector: '@comparison:high' },
  { name: 'NullWireRole', role: 'how explorer', panelIndex: null, selector: null },
  { name: 'NullWirePanel', role: 'interrogate reviewers', panelIndex: 0, selector: null },
] })).isError, undefined);
assert.deepEqual(await hook({ ...event, spawnKey: 'NullWireExplicit' }, ctx), {
  model: '@comparison:high',
  note: 'pstack explicit comparison arm',
});
assert.equal((await hook({ ...event, spawnKey: 'NullWireRole' }, ctx)).model, normalized(models.roles['how explorer']));
assert.equal((await hook({ ...event, spawnKey: 'NullWirePanel' }, ctx)).model, normalized(models.roles['interrogate reviewers'][0]));
assert.deepEqual((await plan({ action: 'status', helpers: null })).details.plans, []);
assert.deepEqual((await plan({ action: 'clear', helpers: null })).details.plans, []);
assert.equal((await plan({ action: 'register', helpers: null })).isError, true);
for (const helper of [
  { name: 'NullWireMixed', role: 'how explorer', panelIndex: null, selector: '@comparison:high' },
  { name: 'NullWireEmpty', role: null, panelIndex: null, selector: null },
  { name: 'NullWireIndex', role: null, panelIndex: 0, selector: '@comparison:high' },
]) {
  assert.equal((await plan({ action: 'register', helpers: [helper] })).isError, true);
  assert.equal(await hook({ ...event, spawnKey: helper.name }, ctx), undefined);
}
const command = action => commands.get('pstack').handler(action, ctx);
const status = async () => { await command('status'); return messages.at(-1).details; };
const preserved = await readFile(configurationPath, 'utf8');
assert.equal((await status()).configurationStatus, 'valid-schema');
assert.equal((await status()).configurationPath, configurationPath);
await command('models');
assert.equal(messages.at(-1).details.configurationPath, configurationPath);
assert.equal(await readFile(configurationPath, 'utf8'), preserved);
await writeFile(join(root, 'models.json'), JSON.stringify(configurationFixture()));
for (const [index, value] of ['{', JSON.stringify({ schemaVersion: 1, budget: 'large', roles: {} })].entries()) {
  await writeFile(configurationPath, value);
  assert.equal((await status()).configurationStatus, 'invalid');
  const failed = await plan({ action: 'register', helpers: [{ name: `InvalidConfig${index}`, role: 'bug-fix' }] });
  assert.equal(failed.isError, true);
  assert.match(failed.content[0].text, /invalid.*Run|invalid.*Repair/s);
  assert.equal(await hook({ ...event, spawnKey: `InvalidConfig${index}` }, ctx), undefined);
  await command('models');
  assert.match(messages.at(-1).content, /configuration is invalid/);
  assert.equal(await readFile(configurationPath, 'utf8'), value);
}
await rm(configurationPath);
assert.equal((await status()).configurationStatus, 'missing');
await command('models');
assert.equal(messages.at(-1).details.configurationStatus, 'missing');
assert.ok(messages.at(-1).details.availableModels.some(model => model.id === 'comparison-base' && model.supportedEfforts.includes('high')));
await hooks.get('session_start')({}, { ...ctx, agent: { kind: 'sub', id: 'worker' } });
assert.equal(notifications.length, 0);
await hooks.get('session_start')({}, ctx);
assert.equal(notifications.length, 1);
await hooks.get('session_start')({}, ctx);
assert.equal(notifications.length, 1);
await assert.rejects(readFile(configurationPath), { code: 'ENOENT' });
const absent = await plan({ action: 'register', helpers: [{ name: 'MissingConfig', role: 'bug-fix' }] });
assert.equal(absent.isError, true);
assert.match(absent.content[0].text, /Run \/setup-pstack/);
assert.equal(await hook({ ...event, spawnKey: 'MissingConfig' }, ctx), undefined);
assert.equal((await plan({ action: 'register', helpers: [{ name: 'ExplicitWithoutConfig', selector: '@comparison:high' }] })).isError, undefined);
assert.equal((await hook({ ...event, spawnKey: 'ExplicitWithoutConfig' }, ctx)).model, '@comparison:high');
await mkdir(configurationPath);
assert.equal((await status()).configurationStatus, 'unreadable');
assert.equal((await plan({ action: 'register', helpers: [{ name: 'UnreadableConfig', role: 'bug-fix' }] })).isError, true);
await command('models');
assert.match(messages.at(-1).content, /configuration is unreadable/);
await rm(configurationPath, { recursive: true });
await writeFile(configurationPath, preserved);
await rm(join(root, 'extensions'), { recursive: true });
await mkdir(join(root, 'extensions'));
await writeFile(loadedExtension, await readFile(extension));
assert.equal(await readFile(configurationPath, 'utf8'), preserved);
const replacementTools = new Map();
await factory({ ...pi, registerTool(tool) { replacementTools.set(tool.name, tool); } });
assert.equal((await replacementTools.get('pstack_plan').execute('replacement', { action: 'register', helpers: [{ name: 'AfterUpgrade', role: 'how explorer' }] }, undefined, undefined, ctx)).isError, undefined);
assert.equal(await readFile(configurationPath, 'utf8'), preserved);
const profileCommands = new Map();
const profileTools = new Map();
const secondAgentDir = join(root, 'second-profile');
await factory({
  ...pi, pi: { getAgentDir: () => secondAgentDir },
  registerCommand(name, command) { profileCommands.set(name, command); },
  registerTool(tool) { profileTools.set(tool.name, tool); },
});
await profileCommands.get('pstack').handler('status', ctx);
assert.equal(messages.at(-1).details.configurationPath, join(secondAgentDir, 'pstack', 'models.json'));
assert.equal(messages.at(-1).details.configurationStatus, 'missing');
assert.equal((await profileTools.get('pstack_plan').execute('profile', { action: 'register', helpers: [{ name: 'OtherProfileRole', role: 'how explorer' }] }, undefined, undefined, ctx)).isError, true);
assert.equal(await readFile(configurationPath, 'utf8'), preserved);
await rm(root, { recursive: true, force: true });
console.log('pstack routing boundary regression passed');
