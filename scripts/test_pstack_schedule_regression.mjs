import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";
import { configurationFixture } from "./fixtures/configuration.mjs";

const sandboxAgentDir = await mkdtemp(join(tmpdir(), "pstack-schedule-regression-"));
after(() => rm(sandboxAgentDir, { recursive: true, force: true }));
await mkdir(join(sandboxAgentDir, "pstack"));
await writeFile(join(sandboxAgentDir, "pstack", "models.json"), JSON.stringify(configurationFixture()));

function createZodStub() {
  const chain = new Proxy(function () {}, {
    get(_t, p) {
      if (p === "safeParse") return (data) => (
        data?.version === 1 && typeof data.enabled === "boolean"
          ? { success: true, data }
          : { success: false }
      );
      if (p === "parse") return (v) => v;
      return () => chain;
    },
    apply() {
      return chain;
    },
  });
  return new Proxy(
    {},
    {
      get() {
        return (..._args) => chain;
      },
    },
  );
}

function createHarness(opts = {}) {
  let idle = opts.idle ?? true;
  let pending = opts.pending ?? false;
  const sessionId = opts.sessionId ?? "sess-1";
  const sessionFile = opts.sessionFile ?? "/tmp/sess-1";
  let branch = opts.branch ?? [];
  const notifications = [];
  const sent = [];
  const tools = new Map();
  const commands = new Map();
  const handlers = new Map();
  const clock = { now: 1000000, intervals: new Map(), timeouts: new Map(), nextId: 1 };
  const pi = {
    zod: createZodStub(),
    setLabel() {},
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
    },
    registerTool(def) {
      tools.set(def.name, def);
    },
    registerCommand(name, def) {
      commands.set(name, def);
    },
    sendMessage(payload, sendOpts) {
      sent.push({ payload, opts: sendOpts });
    },
    appendEntry() {},
    sendUserMessage() {},
    pi: {
      getAgentDir: () => sandboxAgentDir,
      isUserInterruptAbort(msg) {
        return msg?.isUserInterrupt === true;
      },
    },
  };
  const ctx = {
    agent: { kind: opts.kind ?? "main" },
    mode: "tui",
    sessionManager: {
      getSessionId() {
        return sessionId;
      },
      getSessionFile() {
        return sessionFile;
      },
      getBranch() {
        return branch;
      },
    },
    ui: {
      notify(message, level) {
        notifications.push({ message, level });
      },
      setStatus() {},
      onTerminalInput() {
        return () => {};
      },
    },
    models: {
      list() {
        return [];
      },
      resolve() {
        return undefined;
      },
      family() {
        return undefined;
      },
    },
    isIdle() {
      return idle;
    },
    hasPendingMessages() {
      return pending;
    },
    setInterval(cb, ms) {
      const id = clock.nextId++;
      clock.intervals.set(id, { cb, ms });
      return id;
    },
    clearTimer(id) {
      clock.intervals.delete(id);
      clock.timeouts.delete(id);
    },
    setTimeout(cb, ms) {
      const id = clock.nextId++;
      clock.timeouts.set(id, { cb, ms });
      return id;
    },
  };
  return {
    pi,
    ctx,
    sent,
    notifications,
    setBranch(entries) {
      branch = entries;
    },
    tools,
    commands,
    handlers,
    clock,
    setIdle(v) {
      idle = v;
    },
    setPending(v) {
      pending = v;
    },
    ticks() {
      return sent.filter((s) => s.payload?.customType === "org.pstack.omp.schedule-tick");
    },
    clearSent() {
      sent.length = 0;
    },
  };
}

async function loadAndEnable(h) {
  const mod = await import("../extensions/pstack.js");
  await mod.default(h.pi);
  const cmd = h.commands.get("pstack");
  assert.ok(cmd, "pstack command registered");
  await cmd.handler("on", h.ctx);
  h.clearSent();
}

function onEvent(h, name) {
  const list = h.handlers.get(name) ?? [];
  assert.ok(list.length > 0, `handler registered for ${name}`);
  return list[0];
}

function savedMode(data) {
  return { type: "custom", customType: "org.pstack.omp.state", data };
}

async function readMode(h) {
  await h.commands.get("pstack").handler("status", h.ctx);
  return h.sent.at(-1).payload.details.enabled;
}

describe("pstack mode restoration regression", () => {
  const cases = [
    { name: "fresh main defaults on", expected: true },
    { name: "fresh worker stays off", kind: "worker", expected: false },
    { name: "worker ignores saved on", kind: "worker", branch: [savedMode({ version: 1, enabled: true })], expected: false },
    { name: "saved off survives restoration", branch: [savedMode({ version: 1, enabled: false })], expected: false },
    { name: "saved on survives restoration", branch: [savedMode({ version: 1, enabled: true })], expected: true },
    { name: "malformed state fails closed", branch: [savedMode({ version: 1, enabled: "true" })], expected: false, warning: true },
    { name: "invalid version fails closed after saved on", branch: [savedMode({ version: 1, enabled: true }), savedMode({ version: 2, enabled: true })], expected: false, warning: true },
    { name: "latest explicit branch state wins", branch: [savedMode({ version: 1, enabled: false }), savedMode({ version: 1, enabled: true })], expected: true },
  ];
  for (const entry of cases) {
    it(entry.name, async () => {
      const h = createHarness(entry);
      const mod = await import("../extensions/pstack.js");
      await mod.default(h.pi);
      await onEvent(h, "session_start")({}, h.ctx);
      assert.equal(await readMode(h), entry.expected);
      assert.equal(h.notifications.length, entry.warning ? 1 : 0);
      if (entry.warning) assert.equal(h.notifications[0].level, "warning");
      const modes = h.sent.filter((s) => s.payload.customType === "org.pstack.omp.mode");
      assert.equal(modes.length, entry.kind === "worker" ? 0 : 1);
      if (modes.length) assert.equal(modes[0].payload.details.enabled, entry.expected);
    });
  }

  for (const event of ["session_switch", "session_branch", "session_tree"]) {
    it(`${event} restores the selected branch instead of retaining prior mode`, async () => {
      const h = createHarness();
      const mod = await import("../extensions/pstack.js");
      await mod.default(h.pi);
      await onEvent(h, "session_start")({}, h.ctx);
      assert.equal(await readMode(h), true);
      h.setBranch([savedMode({ version: 1, enabled: false })]);
      await onEvent(h, event)({}, h.ctx);
      assert.equal(await readMode(h), false);
      h.setBranch([savedMode({ version: 1, enabled: true })]);
      await onEvent(h, event)({}, h.ctx);
      assert.equal(await readMode(h), true);
      h.setBranch([]);
      await onEvent(h, event)({}, h.ctx);
      assert.equal(await readMode(h), true);
    });
  }
});

describe("pstack schedule regression", () => {
  it("lists and stops all schedules with null wire fields", async () => {
    const h = createHarness();
    await loadAndEnable(h);
    const tool = h.tools.get("pstack_schedule");
    for (const id of ["wire-a", "wire-b"]) {
      const result = await tool.execute("start", { action: "start", id, everyMs: 5000, prompt: "Check state." }, null, null, h.ctx);
      assert.notEqual(result.isError, true);
    }
    const status = await tool.execute("status", { action: "status", id: null, everyMs: null, prompt: null }, null, null, h.ctx);
    assert.deepEqual(status.details.active.map(entry => entry.id), ["wire-a", "wire-b"]);
    assert.equal(h.clock.intervals.size, 2);
    const stopped = await tool.execute("stop", { action: "stop", id: null, everyMs: null, prompt: null }, null, null, h.ctx);
    assert.deepEqual(stopped.details.active, []);
    assert.equal(h.clock.intervals.size, 0);
    assert.equal(h.ticks().length, 0);
  });

  it("rejects null required start fields without creating timers", async () => {
    const h = createHarness();
    await loadAndEnable(h);
    const tool = h.tools.get("pstack_schedule");
    for (const params of [
      { action: "start", id: null, everyMs: 5000, prompt: "Check state." },
      { action: "start", id: "wire", everyMs: null, prompt: "Check state." },
      { action: "start", id: "wire", everyMs: 5000, prompt: null },
    ]) {
      const result = await tool.execute("start", params, null, null, h.ctx);
      assert.equal(result.isError, true);
      assert.equal(result.content[0].text, "Start requires id, everyMs, and prompt.");
    }
    assert.equal(h.clock.intervals.size, 0);
    assert.equal(h.ticks().length, 0);
  });

  it("rejects fractional cadence before any timer", async () => {
    const h = createHarness();
    const realNow = Date.now;
    Date.now = () => h.clock.now;
    try {
      await loadAndEnable(h);
      const tool = h.tools.get("pstack_schedule");
      assert.ok(tool, "pstack_schedule tool registered");
      const res = await tool.execute(
        "t1",
        { action: "start", id: "frac", everyMs: 30000.5, prompt: "P" },
        null,
        null,
        h.ctx,
      );
      assert.equal(res.isError, true);
      assert.match(res.content[0].text, /integer/);
      assert.equal(h.clock.intervals.size, 0);
      assert.equal(h.ticks().length, 0);
      h.clearSent();
      const cmd = h.commands.get("pstack");
      await cmd.handler("schedule start frac2 30000.5 PROMPT", h.ctx);
      assert.equal(h.clock.intervals.size, 0);
      assert.equal(h.ticks().length, 0);
      const last = h.sent[h.sent.length - 1];
      assert.match(last.payload.content, /integer/);
    } finally {
      Date.now = realNow;
    }
  });

  it("retains numeric id and formatted prompt exactly", async () => {
    const h = createHarness();
    const realNow = Date.now;
    Date.now = () => h.clock.now;
    try {
      await loadAndEnable(h);
      const cmd = h.commands.get("pstack");
      await cmd.handler("schedule start 5000 5000 EXACT_PROMPT", h.ctx);
      assert.equal(h.clock.intervals.size, 1);
      h.setIdle(true);
      h.setPending(false);
      for (const entry of [...h.clock.intervals.values()]) entry.cb();
      const ticks = h.ticks();
      assert.equal(ticks.length, 1);
      assert.equal(ticks[0].payload.content, "[5000 every 5000ms]\nEXACT_PROMPT");
      const h2 = createHarness();
      Date.now = () => h2.clock.now;
      await loadAndEnable(h2);
      const cmd2 = h2.commands.get("pstack");
      const formatted = "line1\n  line2  \n\tline3";
      await cmd2.handler(`schedule start fmt 5000 ${formatted}`, h2.ctx);
      assert.equal(h2.clock.intervals.size, 1);
      for (const entry of [...h2.clock.intervals.values()]) entry.cb();
      const ticks2 = h2.ticks();
      assert.equal(ticks2.length, 1);
      assert.equal(ticks2[0].payload.content, `[fmt every 5000ms]\n${formatted}`);
    } finally {
      Date.now = realNow;
    }
  });

  it("drops stopped member from batched tick while valid member remains", async () => {
    const h = createHarness();
    const realNow = Date.now;
    Date.now = () => h.clock.now;
    try {
      await loadAndEnable(h);
      const tool = h.tools.get("pstack_schedule");
      const cmd = h.commands.get("pstack");
      const a = await tool.execute("a1", { action: "start", id: "A", everyMs: 5000, prompt: "PROMPT_A" }, null, null, h.ctx);
      assert.equal(a.isError, undefined);
      const b = await tool.execute("b1", { action: "start", id: "B", everyMs: 5000, prompt: "PROMPT_B" }, null, null, h.ctx);
      assert.equal(b.isError, undefined);
      h.clearSent();
      h.setIdle(false);
      for (const entry of [...h.clock.intervals.values()]) entry.cb();
      assert.equal(h.ticks().length, 0);
      assert.equal(h.clock.intervals.size, 2);
      h.setIdle(true);
      h.setPending(false);
      const agentEnd = onEvent(h, "agent_end");
      await agentEnd({ willContinue: false, messages: [] }, h.ctx);
      const delivered = h.ticks();
      assert.equal(delivered.length, 1);
      const batchContent = delivered[0].payload.content;
      assert.equal(batchContent, "[A every 5000ms]\nPROMPT_A\n\n[B every 5000ms]\nPROMPT_B");
      const batch = {
        role: "custom",
        customType: "org.pstack.omp.schedule-tick",
        content: batchContent,
        details: delivered[0].payload.details,
      };
      assert.equal(batch.details.members.length, 2);
      await cmd.handler("schedule stop A", h.ctx);
      const context = onEvent(h, "context");
      const unrelated = { role: "user", content: "keep me" };
      const rebuilt = await context({ messages: [batch, unrelated] });
      assert.ok(rebuilt);
      assert.equal(rebuilt.messages.length, 2);
      assert.equal(rebuilt.messages[0].content, "[B every 5000ms]\nPROMPT_B");
      assert.equal(rebuilt.messages[1], unrelated);
      await tool.execute("a2", { action: "start", id: "A", everyMs: 5000, prompt: "PROMPT_A_NEW" }, null, null, h.ctx);
      const rebuiltAfterReplace = await context({ messages: [batch, unrelated] });
      assert.ok(rebuiltAfterReplace);
      assert.equal(rebuiltAfterReplace.messages.length, 2);
      assert.equal(rebuiltAfterReplace.messages[0].content, "[B every 5000ms]\nPROMPT_B");
      assert.equal(rebuiltAfterReplace.messages[1], unrelated);
    } finally {
      Date.now = realNow;
    }
  });

  it("stale callback cannot wake after stop or transition", async () => {
    const h = createHarness();
    const realNow = Date.now;
    Date.now = () => h.clock.now;
    try {
      await loadAndEnable(h);
      const tool = h.tools.get("pstack_schedule");
      await tool.execute("s1", { action: "start", id: "STALE", everyMs: 5000, prompt: "P" }, null, null, h.ctx);
      assert.equal(h.clock.intervals.size, 1);
      const [captured] = [...h.clock.intervals.values()];
      await tool.execute("s2", { action: "stop", id: "STALE" }, null, null, h.ctx);
      assert.equal(h.clock.intervals.size, 0);
      h.clearSent();
      h.setIdle(true);
      h.setPending(false);
      captured.cb();
      assert.equal(h.ticks().length, 0);
      await tool.execute("s3", { action: "start", id: "T2", everyMs: 5000, prompt: "Q" }, null, null, h.ctx);
      const [live] = [...h.clock.intervals.values()];
      const beforeSwitch = onEvent(h, "session_before_switch");
      await beforeSwitch({}, h.ctx);
      h.clearSent();
      live.cb();
      assert.equal(h.ticks().length, 0);
    } finally {
      Date.now = realNow;
    }
  });

  it("repeated identical start preserves deadline", async () => {
    const h = createHarness();
    const realNow = Date.now;
    Date.now = () => h.clock.now;
    try {
      await loadAndEnable(h);
      const tool = h.tools.get("pstack_schedule");
      const first = await tool.execute("r1", { action: "start", id: "KEEP", everyMs: 5000, prompt: "SAME" }, null, null, h.ctx);
      assert.equal(first.details.active, true);
      const firstDue = first.details.nextDueAt;
      assert.equal(h.clock.intervals.size, 1);
      const [handle] = [...h.clock.intervals.keys()];
      h.clock.now += 1000;
      const second = await tool.execute("r2", { action: "start", id: "KEEP", everyMs: 5000, prompt: "SAME" }, null, null, h.ctx);
      assert.equal(second.details.active, true);
      assert.equal(second.details.nextDueAt, firstDue);
      assert.equal(h.clock.intervals.size, 1);
      assert.ok(h.clock.intervals.has(handle));
    } finally {
      Date.now = realNow;
    }
  });

  it("old factory tick cannot revive after reload with same id", async () => {
    const realNow = Date.now;
    const h1 = createHarness();
    Date.now = () => h1.clock.now;
    try {
      await loadAndEnable(h1);
      const tool1 = h1.tools.get("pstack_schedule");
      await tool1.execute("o1", { action: "start", id: "SAME", everyMs: 5000, prompt: "PROMPT_OLD" }, null, null, h1.ctx);
      for (const entry of [...h1.clock.intervals.values()]) entry.cb();
      const oldTicks = h1.ticks();
      assert.equal(oldTicks.length, 1);
      const oldMessage = {
        role: "custom",
        customType: "org.pstack.omp.schedule-tick",
        content: oldTicks[0].payload.content,
        details: oldTicks[0].payload.details,
      };
      assert.ok(oldMessage.content.includes("PROMPT_OLD"));
      const h2 = createHarness();
      Date.now = () => h2.clock.now;
      await loadAndEnable(h2);
      const tool2 = h2.tools.get("pstack_schedule");
      await tool2.execute("n1", { action: "start", id: "SAME", everyMs: 5000, prompt: "PROMPT_NEW" }, null, null, h2.ctx);
      const context2 = onEvent(h2, "context");
      const result = await context2({ messages: [oldMessage] });
      assert.ok(result);
      assert.equal(result.messages.length, 0);
      h2.clearSent();
      for (const entry of [...h2.clock.intervals.values()]) entry.cb();
      const fresh = h2.ticks();
      assert.equal(fresh.length, 1);
      assert.ok(fresh[0].payload.content.includes("PROMPT_NEW"));
      assert.ok(!fresh[0].payload.content.includes("PROMPT_OLD"));
    } finally {
      Date.now = realNow;
    }
  });

  it("manual pre-compact clears while auto pre-compact retains", async () => {
    const realNow = Date.now;
    const h = createHarness();
    Date.now = () => h.clock.now;
    try {
      await loadAndEnable(h);
      const tool = h.tools.get("pstack_schedule");
      await tool.execute("m1", { action: "start", id: "M", everyMs: 5000, prompt: "MANUAL" }, null, null, h.ctx);
      assert.equal(h.clock.intervals.size, 1);
      const beforeCompact = onEvent(h, "session_before_compact");
      await beforeCompact({}, h.ctx);
      assert.equal(h.clock.intervals.size, 0);
      const status = await tool.execute("m2", { action: "status", id: "M" }, null, null, h.ctx);
      assert.equal(status.details.active, false);
    } finally {
      Date.now = realNow;
    }
    const h2 = createHarness();
    Date.now = () => h2.clock.now;
    try {
      await loadAndEnable(h2);
      const tool2 = h2.tools.get("pstack_schedule");
      await tool2.execute("a1", { action: "start", id: "AUTO", everyMs: 5000, prompt: "AUTOP" }, null, null, h2.ctx);
      const autoStart = onEvent(h2, "auto_compaction_start");
      await autoStart({}, h2.ctx);
      h2.setIdle(false);
      for (const entry of [...h2.clock.intervals.values()]) entry.cb();
      const beforeCompact2 = onEvent(h2, "session_before_compact");
      await beforeCompact2({}, h2.ctx);
      assert.equal(h2.clock.intervals.size, 1);
      const status2 = await tool2.execute("a2", { action: "status", id: "AUTO" }, null, null, h2.ctx);
      assert.equal(status2.details.active, true);
    } finally {
      Date.now = realNow;
    }
  });
});
