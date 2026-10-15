import { access, readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const stateType = "org.pstack.omp.state";
const modeType = "org.pstack.omp.mode";
const commandType = "org.pstack.omp.command";
const scheduleTickType = "org.pstack.omp.schedule-tick";
const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const updateReferencePath = join(packageRoot, "skills", "poteto-mode", "references", "upstream-update.md");
const updateReferenceDir = join(packageRoot, "skills", "poteto-mode", "references");
const roleNames = [
  "feature, refactoring", "bug-fix", "perf-issue", "hillclimb",
  "judgment and prose", "hardest tasks", "how explorer", "how explainer",
  "why investigators", "why synthesizer", "reflect tooling",
  "reflect judgment, divergent, synthesizer", "arena runners",
  "arena cross-judge pool", "swarm workers", "architect runners",
  "interrogate reviewers",
];
const panelRoles = {
  "arena runners": true,
  "arena cross-judge pool": true,
  "architect runners": true,
  "interrogate reviewers": true,
};
const scheduleIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const scheduleIdMax = 64;
const scheduleMinMs = 1;
const scheduleMaxMs = 2147483647;
const scheduleDeferredMs = 1000;

export default async function pstack(pi) {
  const configurationPath = join(pi.pi.getAgentDir(), "pstack", "models.json");
  const z = pi.zod;
  const selectorSchema = z.string().trim().min(1);
  const configurationSchema = z.object({
    schemaVersion: z.literal(1),
    budget: z.enum(["unlimited", "large", "medium", "small"]),
    roles: z.object(Object.fromEntries(roleNames.map(role => [
      role, panelRoles[role] === true ? z.array(selectorSchema).min(2) : selectorSchema,
    ]))).passthrough(),
  });

  async function readConfiguration() {
    let text;
    try {
      text = await readFile(configurationPath, "utf8");
    } catch (error) {
      const status = error?.code === "ENOENT" ? "missing" : "unreadable";
      return {
        status, configurationPath,
        error: status === "missing"
          ? `Pstack configuration is missing at ${configurationPath}. Run /setup-pstack before configured role dispatch. No fallback was registered.`
          : `Pstack configuration is unreadable at ${configurationPath} (${error?.code ?? "read error"}). Restore access before setup or dispatch. No fallback was registered.`,
      };
    }
    try {
      return { status: "valid-schema", configurationPath, configuration: configurationSchema.parse(JSON.parse(text)) };
    } catch {
      return {
        status: "invalid", configurationPath,
        error: `Pstack configuration is invalid at ${configurationPath}. Expected schemaVersion 1, a supported budget, all 17 roles, and at least two selectors per panel. Repair it with /setup-pstack after reviewing existing choices. No fallback was registered.`,
      };
    }
  }

  async function requireConfiguration() {
    const result = await readConfiguration();
    if (result.status !== "valid-schema") throw new Error(result.error);
    return result.configuration;
  }
  const modeStateSchema = z.object({ version: z.literal(1), enabled: z.boolean() });
  let enabled = false;
  const aliases = new Map();
  pi.setLabel("Pstack");
  let ownerEpoch = 0;
  let ownerSessionId = undefined;
  let ownerSessionFile = undefined;
  let scheduleGen = 0;
  const schedules = new Map();
  const stoppedInfo = new Map();
  let deliveryLatch = false;
  let deferredHandle = null;
  let deferredCtx = null;
  let compacting = false;
  let tuiUnsub = null;
  let lastMainCtx = null;
  const ownerToken = randomUUID();
  const helperPlans = new Map();
  const usedHelperNames = new Set();
  let planSession;
  let planGeneration = 0;
  let setupNoticeShown = false;

  function bindPlanSession(ctx) {
    const identity = sessionIdentity(ctx);
    const key = JSON.stringify([identity.id, identity.file, ctx.agent.id]);
    if (key !== planSession) {
      planGeneration++;
      helperPlans.clear();
      usedHelperNames.clear();
      planSession = key;
    }
  }

  function helperKey(name, ctx) {
    return ctx.agent.kind === "main" ? name : `${ctx.agent.id}.${name}`;
  }

  pi.on("before_subagent_spawn", (event, ctx) => {
    bindPlanSession(ctx);
    if (event.invocationKind !== "task" || typeof event.spawnKey !== "string") return;
    usedHelperNames.add(event.spawnKey);
    const plan = helperPlans.get(event.spawnKey);
    if (!plan) return;
    helperPlans.delete(event.spawnKey);
    return { model: plan.selector, note: plan.source === "explicit" ? "pstack explicit comparison arm" : `pstack ${plan.role}${plan.panelIndex === undefined ? "" : ` [${plan.panelIndex}]`}` };
  });

  pi.registerTool({
    name: "pstack_plan",
    label: "Pstack helper plan",
    description: "Register one-shot routing for named native task helpers. Normally use role and optional panelIndex from the latest pstack models.json. Only for swarm comparison arms whose models the user explicitly named, use selector instead of role and panelIndex. The two shapes are exclusive. Set unused role, panelIndex, or selector fields to null when the wire requires every field. For status and clear, helpers may be null. All selectors require native resolution, authentication, and supported effort, with no fallback or configuration changes. Each fresh helper name must exactly match the task item name. Unplanned helpers are unchanged. Never put model in task input. Plans are process-local, parent-session scoped, and consumed once at spawn. status lists pending plans; clear cancels plans without making names reusable.",
    parameters: z.object({
      action: z.enum(["register", "status", "clear"]),
      helpers: z.array(z.object({
        name: z.string().regex(/^[A-Z][A-Za-z0-9]{0,31}$/),
        role: z.enum(roleNames).nullable().optional(),
        panelIndex: z.number().int().min(0).nullable().optional(),
        selector: selectorSchema.nullable().optional(),
      })).min(1).nullable().optional(),
    }),
    async execute(_id, { action, helpers }, _signal, _onUpdate, ctx) {
      bindPlanSession(ctx);
      try {
        if (action === "clear") {
          planGeneration++;
          helperPlans.clear();
        }
        if (action === "register") {
          if (!helpers?.length) throw new Error("Register requires helpers.");
          const registrationOwner = planSession;
          const registrationGeneration = planGeneration;
          const configuration = helpers.some(helper => helper.role != null)
            ? await requireConfiguration()
            : undefined;
          const identity = sessionIdentity(ctx);
          if (_signal?.aborted || planGeneration !== registrationGeneration || planSession !== registrationOwner || JSON.stringify([identity.id, identity.file, ctx.agent.id]) !== registrationOwner) throw new Error("Helper registration was cancelled, cleared, or its parent session changed.");
          const authenticated = new Set(ctx.models.list().map(model => `${model.provider}/${model.id}`));
          const pending = new Map();
          for (const helper of helpers) {
            if (!/^[A-Z][A-Za-z0-9]{0,31}$/.test(helper.name)) throw new Error(`Invalid helper name ${helper.name}. Use a fresh CamelCase name of at most 32 characters.`);
            const role = helper.role ?? undefined;
            const panelIndex = helper.panelIndex ?? undefined;
            const requestedSelector = helper.selector ?? undefined;
            const explicit = requestedSelector !== undefined;
            if (explicit && (role !== undefined || panelIndex !== undefined)) throw new Error("An explicit selector cannot be combined with role or panelIndex.");
            if (!explicit && !roleNames.includes(role)) throw new Error(`Unknown pstack role ${role}.`);
            if (explicit && (typeof requestedSelector !== "string" || !requestedSelector.trim())) throw new Error("An explicit selector must be a nonempty native model selector.");
            const key = helperKey(helper.name, ctx);
            if (usedHelperNames.has(key) || pending.has(key)) throw new Error(`Helper name ${helper.name} has already been reserved. Choose a fresh task name.`);
            const choice = explicit ? requestedSelector.trim() : configuration.roles[role];
            const isPanel = !explicit && panelRoles[role] === true;
            if (isPanel && (!Number.isInteger(panelIndex) || panelIndex < 0 || panelIndex >= choice.length)) throw new Error(`Role ${role} requires a valid zero-based panelIndex.`);
            if (!isPanel && panelIndex !== undefined) throw new Error(`Role ${role} is not a panel.`);
            const selected = isPanel ? choice[panelIndex] : choice;
            const selector = selected === "auto" || selected === "inherit-parent" ? "@default" : selected;
            const model = ctx.models.resolve(selector);
            if (!model || !authenticated.has(`${model.provider}/${model.id}`)) throw new Error(`Pstack selector ${selector} is unresolved or unavailable. No fallback was registered.`);
            let effort = /^@[^:]+:(.+)$/.exec(selector)?.[1];
            const colon = selector.lastIndexOf(":");
            if (!effort && colon >= 0) {
              const suffix = selector.slice(colon + 1);
              const literal = selector.toLowerCase() === model.id.toLowerCase() || selector.toLowerCase() === `${model.provider}/${model.id}`.toLowerCase();
              if (!literal) {
                const prefixModel = ctx.models.resolve(selector.slice(0, colon));
                if (!prefixModel || prefixModel.provider !== model.provider || prefixModel.id !== model.id) throw new Error(`Pstack selector ${selector} has a suffix whose effort cannot be validated against its native model identity. No fallback was registered.`);
                effort = suffix;
              }
            }
            if (effort && !["off", "auto", "inherit"].includes(effort) && !model.thinking?.efforts?.includes(effort)) throw new Error(`Pstack selector ${selector} requests an unsupported effort.`);
            pending.set(key, { name: helper.name, ...(explicit ? { source: "explicit" } : { role, ...(isPanel ? { panelIndex } : {}) }), selector });
          }
          for (const [key, plan] of pending) {
            helperPlans.set(key, plan);
            usedHelperNames.add(key);
          }
        }
        const plans = [...helperPlans].map(([spawnKey, plan]) => ({ spawnKey, ...plan }));
        return { content: [{ type: "text", text: JSON.stringify({ action, plans }, null, 2) }], details: { action, plans } };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
      }
    },
  });

  function modeMessage() {
    return {
      customType: modeType,
      content: enabled
        ? "Pstack mode is on for this session. Use the full installed skill://poteto-mode router for engineering tasks; if its body and skill://poteto-mode/references/omp-runtime.md are not already autoloaded/read, read them once, then reuse current context. Host safety, native tools, and repository constraints remain binding."
        : "Pstack mode is off for this session. Do not proactively invoke pstack workflow or workflow-only skills. Explicit individual skill requests still work. Host safety, native tools, and repository constraints remain binding.",
      display: false,
      details: { enabled },
    };
  }

  function sessionIdentity(ctx) {
    const id = ctx.sessionManager.getSessionId();
    const getFile = ctx.sessionManager.getSessionFile;
    const file = typeof getFile === "function" ? ctx.sessionManager.getSessionFile() : undefined;
    return {
      id: typeof id === "string" ? id : undefined,
      file: typeof file === "string" ? file : undefined,
    };
  }

  function bindOwner(ctx) {
    const current = sessionIdentity(ctx);
    if (ownerSessionId === undefined) ownerSessionId = current.id;
    if (ownerSessionFile === undefined) ownerSessionFile = current.file;
  }

  function ownerMatches(ctx) {
    const current = sessionIdentity(ctx);
    if (ownerSessionId !== undefined && current.id !== undefined && current.id !== ownerSessionId) return false;
    if (ownerSessionFile !== undefined && current.file !== undefined && current.file !== ownerSessionFile) return false;
    return true;
  }

  function clearTimerSafe(ctx, handle) {
    if (!handle) return;
    ctx.clearTimer(handle);
  }

  function cancelDeferred() {
    if (deferredHandle) {
      const ctx = deferredCtx ?? lastMainCtx;
      ctx.clearTimer(deferredHandle);
    }
    deferredHandle = null;
    deferredCtx = null;
  }

  function clearOne(id, reason) {
    const entry = schedules.get(id);
    if (entry) {
      clearTimerSafe(entry.timerCtx ?? lastMainCtx, entry.handle);
      schedules.delete(id);
    }
    stoppedInfo.set(id, { reason: reason ?? "stopped", at: Date.now() });
    if (stoppedInfo.size > 32) {
      const oldest = stoppedInfo.keys().next();
      if (!oldest.done) stoppedInfo.delete(oldest.value);
    }
    if (schedules.size === 0) {
      cancelDeferred();
      deliveryLatch = false;
      return;
    }
    const anyDue = [...schedules.values()].some((item) => item.due);
    if (!anyDue) {
      cancelDeferred();
      return;
    }
    if (!deferredHandle && lastMainCtx) {
      const capturedEpoch = ownerEpoch;
      const capturedToken = ownerToken;
      deferredCtx = lastMainCtx;
      deferredHandle = lastMainCtx.setTimeout(() => {
        deferredHandle = null;
        deferredCtx = null;
        if (capturedEpoch !== ownerEpoch) return;
        if (capturedToken !== ownerToken) return;
        tryDeliver(lastMainCtx, "stop-rebuild");
      }, scheduleDeferredMs);
    }
  }

  function clearAll(reason) {
    ownerEpoch += 1;
    for (const entry of schedules.values()) {
      clearTimerSafe(entry.timerCtx ?? lastMainCtx, entry.handle);
    }
    schedules.clear();
    cancelDeferred();
    deliveryLatch = false;
    if (reason) {
      stoppedInfo.set("_all", { reason, at: Date.now() });
      if (stoppedInfo.size > 32) {
        const oldest = stoppedInfo.keys().next();
        if (!oldest.done) stoppedInfo.delete(oldest.value);
      }
    }
  }

  function parseScheduleId(raw) {
    const id = String(raw ?? "").trim();
    if (!id) return { ok: false, error: "Schedule id is required." };
    if (id.length > scheduleIdMax) return { ok: false, error: `Schedule id exceeds ${scheduleIdMax} chars.` };
    if (!scheduleIdPattern.test(id)) return { ok: false, error: "Schedule id must start alphanumeric and contain only letters, digits, _ or -." };
    return { ok: true, id };
  }

  function parseScheduleMs(raw) {
    const num = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
    if (!Number.isFinite(num) || !Number.isInteger(num)) return { ok: false, error: "everyMs must be an integer number of milliseconds." };
    if (num < scheduleMinMs || num > scheduleMaxMs) {
      return { ok: false, error: `everyMs must be ${scheduleMinMs} to ${scheduleMaxMs} ms. No clamping applied.` };
    }
    return { ok: true, everyMs: num };
  }

  function parseSchedulePrompt(raw) {
    const prompt = String(raw ?? "");
    if (!prompt.trim()) return { ok: false, error: "Prompt must be nonblank." };
    return { ok: true, prompt };
  }

  function scheduleStatus(id) {
    const now = Date.now();
    const scope = "live-process-only. Timers never survive shutdown or restart. Explicit start required.";
    if (id !== undefined) {
      const entry = schedules.get(id);
      if (!entry) {
        const stopped = stoppedInfo.get(id);
        return {
          scope, mode: enabled ? "on" : "off", ownerEpoch, ownerSessionId, ownerSessionFile,
          id, active: false, stopped: stopped ?? { reason: "not-found", at: now },
        };
      }
      return {
        scope, mode: enabled ? "on" : "off", ownerEpoch, ownerSessionId, ownerSessionFile,
        id: entry.id, active: true, everyMs: entry.everyMs, nextDueAt: entry.nextDueAt,
        lastDispatchAt: entry.lastDispatchAt, due: entry.due, generation: entry.generation,
      };
    }
    return {
      scope, mode: enabled ? "on" : "off", ownerEpoch, ownerSessionId, ownerSessionFile,
      compacting, active: [...schedules.values()].map((entry) => ({
        id: entry.id, everyMs: entry.everyMs, nextDueAt: entry.nextDueAt,
        lastDispatchAt: entry.lastDispatchAt, due: entry.due, generation: entry.generation,
      })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    };
  }

  function tryDeliver(ctx, cause) {
    if (!enabled) return false;
    if (!ctx || ctx.agent?.kind !== "main") return false;
    let owned;
    try {
      owned = ownerMatches(ctx);
    } catch (error) {
      console.error(`[pstack schedule] owner check failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
    if (!owned) return false;
    if (compacting) return false;
    let idle;
    try {
      idle = ctx.isIdle();
    } catch (error) {
      console.error(`[pstack schedule] isIdle failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
    if (!idle) return false;
    let pending;
    try {
      pending = ctx.hasPendingMessages();
    } catch (error) {
      console.error(`[pstack schedule] hasPendingMessages failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
    if (pending) return false;
    if (deliveryLatch) return false;
    const due = [...schedules.values()].filter((item) => item.due).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (due.length === 0) return false;
    const generations = {};
    for (const item of due) generations[item.id] = item.generation;
    const members = due.map((item) => ({ id: item.id, everyMs: item.everyMs, generation: item.generation, prompt: item.prompt }));
    const body = members.map((member) => `[${member.id} every ${member.everyMs}ms]\n${member.prompt}`).join("\n\n");
    const payload = {
      customType: scheduleTickType,
      content: body,
      display: true,
      attribution: "agent",
      details: {
        ownerEpoch, ownerToken, generations, scheduleIds: members.map((member) => member.id), members, cause: cause ?? "tick",
      },
    };
    deliveryLatch = true;
    const now = Date.now();
    for (const item of due) {
      const live = schedules.get(item.id);
      if (live && live.generation === item.generation) {
        live.due = false;
        live.lastDispatchAt = now;
      }
    }
    try {
      pi.sendMessage(payload, { deliverAs: "nextTurn", triggerTurn: true });
    } finally {
      deliveryLatch = false;
    }
    return true;
  }

  function onTick(id, generation, epoch, token, timerCtx) {
    if (token !== ownerToken) return;
    const entry = schedules.get(id);
    if (!entry) return;
    if (epoch !== ownerEpoch) return;
    if (entry.generation !== generation) return;
    entry.nextDueAt = Date.now() + entry.everyMs;
    entry.due = true;
    tryDeliver(timerCtx ?? lastMainCtx, "interval");
  }

  function ensureDeferred(ctx) {
    if (deferredHandle) return;
    const anyDue = [...schedules.values()].some((item) => item.due);
    if (!anyDue) return;
    const capturedEpoch = ownerEpoch;
    const capturedToken = ownerToken;
    deferredCtx = ctx;
    deferredHandle = ctx.setTimeout(() => {
      deferredHandle = null;
      deferredCtx = null;
      if (capturedEpoch !== ownerEpoch) return;
      if (capturedToken !== ownerToken) return;
      tryDeliver(ctx, "deferred");
    }, scheduleDeferredMs);
  }

  function newestAssistantAbort(messages) {
    if (!Array.isArray(messages)) return undefined;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg && msg.role === "assistant") return msg;
    }
    return undefined;
  }

  function isUserInterrupt(message) {
    if (!message || message.stopReason !== "aborted") return false;
    return pi.pi.isUserInterruptAbort(message) === true;
  }

  function detachTui() {
    if (tuiUnsub) {
      tuiUnsub();
      tuiUnsub = null;
    }
  }

  function attachTui(ctx) {
    detachTui();
    if (!ctx || ctx.mode !== "tui") return;
    if (typeof ctx.ui?.onTerminalInput !== "function") return;
    if (ctx.agent?.kind !== "main") return;
    lastMainCtx = ctx;
    tuiUnsub = ctx.ui.onTerminalInput((data) => {
      if (data === "\x03" || data === "\x1b") {
        const live = lastMainCtx;
        if (live && live.isIdle() === false && schedules.size > 0) {
          clearAll("tui-interrupt");
        }
      }
      return undefined;
    });
  }

  function startSchedule(ctx, rawId, rawMs, rawPrompt) {
    if (!ctx || ctx.agent?.kind !== "main") {
      return { ok: false, error: "Schedules belong to the main coordinator." };
    }
    if (!enabled) {
      return { ok: false, error: "Pstack mode is off. Turn it on before starting a schedule. Start never enables mode implicitly." };
    }
    const idParsed = parseScheduleId(rawId);
    if (!idParsed.ok) return idParsed;
    const msParsed = parseScheduleMs(rawMs);
    if (!msParsed.ok) return msParsed;
    const promptParsed = parseSchedulePrompt(rawPrompt);
    if (!promptParsed.ok) return promptParsed;
    bindOwner(ctx);
    if (!ownerMatches(ctx)) return { ok: false, error: "Schedule owner changed. Bind to the current session first." };
    const existing = schedules.get(idParsed.id);
    if (existing && existing.everyMs === msParsed.everyMs && existing.prompt === promptParsed.prompt) {
      return { ok: true, id: idParsed.id, deduped: true, status: scheduleStatus(idParsed.id) };
    }
    if (existing) {
      clearTimerSafe(existing.timerCtx ?? ctx, existing.handle);
      schedules.delete(idParsed.id);
    }
    stoppedInfo.delete(idParsed.id);
    scheduleGen += 1;
    const generation = scheduleGen;
    const capturedEpoch = ownerEpoch;
    const capturedToken = ownerToken;
    const entry = {
      id: idParsed.id, everyMs: msParsed.everyMs, prompt: promptParsed.prompt,
      handle: null, generation, nextDueAt: Date.now() + msParsed.everyMs,
      lastDispatchAt: null, due: false, timerCtx: ctx,
    };
    try {
      entry.handle = ctx.setInterval(() => {
        onTick(entry.id, generation, capturedEpoch, capturedToken, entry.timerCtx);
      }, entry.everyMs);
    } catch (error) {
      schedules.delete(entry.id);
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    schedules.set(entry.id, entry);
    lastMainCtx = ctx;
    return { ok: true, id: entry.id, deduped: false, status: scheduleStatus(entry.id) };
  }

  function restore(ctx) {
    enabled = ctx.agent.kind === "main";
    for (const entry of ctx.sessionManager.getBranch()) {
      if (ctx.agent.kind === "main" && entry.type === "custom" && entry.customType === stateType) {
        const parsed = modeStateSchema.safeParse(entry.data);
        enabled = parsed.success ? parsed.data.enabled : false;
        if (!parsed.success) ctx.ui.notify("Invalid stored pstack state. Mode is off until /pstack on.", "warning");
      }
    }
    clearAll();
    ownerSessionId = undefined;
    ownerSessionFile = undefined;
    bindOwner(ctx);
    if (ctx.agent.kind === "main") {
      lastMainCtx = ctx;
      attachTui(ctx);
      ctx.ui.setStatus("pstack", enabled ? "pstack on" : "pstack off");
      pi.sendMessage(modeMessage(), { deliverAs: "nextTurn" });
    }
  }

  function announce(content, details) {
    pi.sendMessage({ customType: commandType, content, display: true, attribution: "agent", details });
  }

  function setMode(next, ctx) {
    if (!next) clearAll("mode-off");
    enabled = next;
    pi.appendEntry(stateType, { version: 1, enabled });
    ctx.ui.setStatus("pstack", enabled ? "pstack on" : "pstack off");
    pi.sendMessage(modeMessage(), { deliverAs: "steer" });
  }

  function preTransitionClear() {
    clearAll("session-transition");
    planGeneration++;
    helperPlans.clear();
    usedHelperNames.clear();
    planSession = undefined;
    detachTui();
  }

  pi.on("session_start", async (_event, ctx) => {
    restore(ctx);
    if (ctx.agent.kind !== "main" || setupNoticeShown) return;
    const configuration = await readConfiguration();
    if (configuration.status !== "valid-schema") {
      setupNoticeShown = true;
      ctx.ui.notify(configuration.error, "warning");
    }
  });
  pi.on("session_switch", (_event, ctx) => restore(ctx));
  pi.on("session_branch", (_event, ctx) => restore(ctx));
  pi.on("session_tree", (_event, ctx) => restore(ctx));
  pi.on("session_before_switch", () => preTransitionClear());
  pi.on("session_before_branch", () => preTransitionClear());
  pi.on("session_before_tree", () => preTransitionClear());
  pi.on("session_shutdown", () => preTransitionClear());
  pi.on("before_agent_start", (_event, ctx) => {
    if (ctx.agent.kind !== "main") return;
    return { message: modeMessage() };
  });
  pi.on("auto_compaction_start", () => {
    compacting = true;
  });
  pi.on("session_before_compact", () => {
    if (compacting) return;
    clearAll("manual-compaction");
  });
  pi.on("auto_compaction_end", (_event, ctx) => {
    compacting = false;
    if (ctx?.agent?.kind === "main") tryDeliver(ctx, "compaction-end");
  });
  pi.on("session_compact", (_event, ctx) => {
    compacting = false;
    if (ctx?.agent?.kind === "main") tryDeliver(ctx, "session-compact");
  });
  pi.on("context", (event) => {
    const messages = event?.messages;
    if (!Array.isArray(messages) || messages.length === 0) return undefined;
    let changed = false;
    const next = [];
    for (const msg of messages) {
      if (!msg || msg.role !== "custom" || msg.customType !== scheduleTickType) {
        next.push(msg);
        continue;
      }
      const details = msg.details;
      if (!details || typeof details !== "object") {
        next.push(msg);
        continue;
      }
      if (details.ownerToken !== ownerToken) {
        changed = true;
        continue;
      }
      if (details.ownerEpoch !== ownerEpoch) {
        changed = true;
        continue;
      }
      const members = Array.isArray(details.members) ? details.members : null;
      if (!members) {
        const generations = details.generations;
        const ids = Array.isArray(details.scheduleIds) ? details.scheduleIds : Object.keys(generations ?? {});
        if (ids.length === 0) {
          next.push(msg);
          continue;
        }
        const anyLive = ids.some((id) => {
          const live = schedules.get(id);
          if (!live) return false;
          if (generations && typeof generations === "object" && generations[id] !== undefined) {
            return generations[id] === live.generation;
          }
          return true;
        });
        if (!anyLive) {
          changed = true;
          continue;
        }
        next.push(msg);
        continue;
      }
      const liveMembers = members.filter((member) => {
        if (!member || typeof member.id !== "string") return false;
        const live = schedules.get(member.id);
        return !!live && live.generation === member.generation;
      });
      if (liveMembers.length === 0) {
        changed = true;
        continue;
      }
      if (liveMembers.length === members.length) {
        next.push(msg);
        continue;
      }
      changed = true;
      const body = liveMembers.map((member) => `[${member.id} every ${member.everyMs}ms]\n${member.prompt}`).join("\n\n");
      const generations = {};
      for (const member of liveMembers) generations[member.id] = member.generation;
      next.push({
        ...msg,
        content: body,
        details: { ...details, generations, scheduleIds: liveMembers.map((member) => member.id), members: liveMembers },
      });
    }
    if (changed) return { messages: next };
    return undefined;
  });
  pi.on("agent_end", (event, ctx) => {
    if (!event || event.willContinue === true) return;
    if (ctx?.agent?.kind !== "main") return;
    const abort = newestAssistantAbort(event.messages);
    if (abort && isUserInterrupt(abort)) {
      clearAll("user-interrupt");
      return;
    }
    const anyDue = [...schedules.values()].some((item) => item.due);
    if (!anyDue) return;
    if (tryDeliver(ctx, "agent_end")) return;
    ensureDeferred(ctx);
  });

  pi.registerTool({
    name: "pstack_mode",
    label: "Pstack mode",
    description: "Read or change this main session's pstack mode. Use on/off only for an explicit user mode request, including a natural-language opt-out. Never enable it to override the user's opt-out; scoped workers follow their coordinator.",
    parameters: z.object({ action: z.enum(["status", "on", "off"]) }),
    async execute(_id, { action }, _signal, _onUpdate, ctx) {
      if (ctx.agent.kind !== "main") {
        return {
          isError: true,
          content: [{ type: "text", text: "Pstack mode belongs to the coordinator. Follow this worker's scoped assignment." }],
        };
      }
      if (action !== "status") setMode(action === "on", ctx);
      return {
        content: [{ type: "text", text: `Pstack is ${enabled ? "on" : "off"} for this session.` }],
        details: { enabled },
      };
    },
  });

  pi.registerTool({
    name: "pstack_schedule",
    label: "Pstack schedule",
    description: "Start, stop, or report live-process-only interval schedules in this main session. Set unused id, everyMs, and prompt fields to null when the wire requires every field; null means omitted. Start requires all three non-null values. Null id on status lists all schedules and on stop stops all schedules. Schedules are ephemeral, fire first after everyMs, coalesce while busy, deliver idle-only via nextTurn triggerTurn, and never survive shutdown or restart. Idle RPC aborts are not observable. Clients stop explicitly. Cancellation cannot recall already submitted or started work.",
    parameters: z.object({
      action: z.enum(["start", "stop", "status"]),
      id: z.string().trim().min(1).max(scheduleIdMax).nullable().optional(),
      everyMs: z.number().int().nullable().optional(),
      prompt: z.string().min(1).nullable().optional(),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (ctx.agent.kind !== "main") {
        return {
          isError: true,
          content: [{ type: "text", text: "Schedules belong to the coordinator. Follow this worker's scoped assignment." }],
        };
      }
      const id = params.id ?? undefined;
      const everyMs = params.everyMs ?? undefined;
      const prompt = params.prompt ?? undefined;
      if (params.action === "start") {
        if (id === undefined || everyMs === undefined || prompt === undefined) {
          return {
            isError: true,
            content: [{ type: "text", text: "Start requires id, everyMs, and prompt." }],
          };
        }
        const result = startSchedule(ctx, id, everyMs, prompt);
        if (!result.ok) {
          return { isError: true, content: [{ type: "text", text: result.error }] };
        }
        return {
          content: [{ type: "text", text: result.deduped ? `Schedule ${result.id} already active. Deadline preserved.` : `Schedule ${result.id} started.` }],
          details: result.status,
        };
      }
      if (params.action === "stop") {
        if (id !== undefined) {
          const parsed = parseScheduleId(id);
          if (!parsed.ok) return { isError: true, content: [{ type: "text", text: parsed.error }] };
          clearOne(parsed.id, "explicit-stop");
          return {
            content: [{ type: "text", text: `Schedule ${parsed.id} stopped. Unsent due state cleared.` }],
            details: scheduleStatus(parsed.id),
          };
        }
        clearAll("explicit-stop-all");
        return {
          content: [{ type: "text", text: "All schedules stopped. Unsent due state cleared." }],
          details: scheduleStatus(),
        };
      }
      if (id !== undefined) {
        const parsed = parseScheduleId(id);
        if (!parsed.ok) return { isError: true, content: [{ type: "text", text: parsed.error }] };
        return { content: [{ type: "text", text: `Schedule ${parsed.id} status.` }], details: scheduleStatus(parsed.id) };
      }
      return { content: [{ type: "text", text: "Schedule status." }], details: scheduleStatus() };
    },
  });

  pi.registerCommand("pstack", {
    description: "Pstack: status, on, off, models, schedule, update, update check, or help. Mode changes persist in this session.",
    handler: async (args, ctx) => {
      const action = args.trim() || "status";
      if (action === "on" || action === "off") {
        if (ctx.agent.kind !== "main") {
          announce("Pstack mode belongs to the coordinator. Follow this worker's scoped assignment.", { enabled });
          return;
        }
        setMode(action === "on", ctx);
        announce(`Pstack is ${enabled ? "on" : "off"} for this session.`, { enabled });
        return;
      }
      if (action === "status") {
        const configuration = await readConfiguration();
        announce(`Pstack is ${enabled ? "on" : "off"}. ${aliases.size} installed skill aliases.\nConfiguration: ${configuration.status} at ${configurationPath}.\n${configuration.error ?? "Schema validity does not prove model availability or authentication."}`, {
          enabled, packageRoot, configurationPath, configurationStatus: configuration.status,
          ...(configuration.error ? { error: configuration.error } : {}), aliases: [...aliases.keys()],
        });
        return;
      }
      if (action === "models") {
        try {
          const catalog = ctx.models.list();
          const availableModels = catalog.map(model => ({
            provider: model.provider, id: model.id,
            supportedEfforts: model.thinking?.efforts ?? [],
          }));
          const loaded = await readConfiguration();
          if (loaded.status !== "valid-schema") {
            const result = {
              configurationPath, configurationStatus: loaded.status,
              availableModels, error: loaded.error,
            };
            announce(JSON.stringify(result, null, 2), result);
            return;
          }
          const configuration = loaded.configuration;
          const authenticated = new Set(catalog.map(model => `${model.provider}/${model.id}`));
          const cache = new Map();
          const familyBySelector = new Map();
          const missing = new Set();
          const roles = roleNames.map(role => ({
            role,
            choices: (Array.isArray(configuration.roles[role]) ? configuration.roles[role] : [configuration.roles[role]]).map(selector => {
              const normalized = selector === "auto" || selector === "inherit-parent" ? "@default" : selector;
              let resolved = cache.get(normalized);
              if (!resolved) {
                const model = ctx.models.resolve(normalized);
                const identity = model && `${model.provider}/${model.id}`;
                resolved = {
                  selector: normalized, model: identity,
                  available: identity !== undefined && authenticated.has(identity),
                  supportedEfforts: model?.thinking?.mode === "effort" ? model.thinking.efforts : undefined,
                };
                cache.set(normalized, resolved);
                if (model) familyBySelector.set(normalized, ctx.models.family(model));
              }
              if (!resolved.available) missing.add(normalized);
              return resolved;
            }),
          }));
          const panels = roleNames.filter(role => panelRoles[role] === true).map(role => {
            const choice = configuration.roles[role];
            const entries = Array.isArray(choice) ? choice : [choice];
            const families = new Set(entries.map(selector => {
              const normalized = selector === "auto" || selector === "inherit-parent" ? "@default" : selector;
              return familyBySelector.get(normalized);
            }).filter(family => family !== undefined));
            return { role, count: entries.length, distinctFamilies: families.size };
          });
          const retired = Object.keys(configuration.roles).filter(role => !roleNames.includes(role));
          const result = {
            configurationPath, configurationStatus: loaded.status, availableModels,
            budget: configuration.budget, roles, panels, retired, missing: [...missing],
            effortProof: "Verify actual effort via child resolvedModel and resolvedThinkingLevel. resolve() identity alone never proves selected effort.",
          };
          announce(JSON.stringify(result, null, 2), result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          announce(`Pstack model preflight failed: ${message}`, { error: message });
        }
        return;
      }
      const normalized = action.replace(/\s+/g, " ");
      if (normalized === "schedule" || normalized.startsWith("schedule ")) {
        if (ctx.agent.kind !== "main") {
          announce("Schedules belong to the coordinator. Follow this worker's scoped assignment.", { enabled });
          return;
        }
        const parts = normalized.split(" ");
        const sub = parts[1];
        if (sub === "start") {
          const startMatch = args.match(/^\s*schedule\s+start\s+(\S+)\s+(\S+)([\s\S]*)$/);
          const id = startMatch?.[1];
          const msRaw = startMatch?.[2];
          let prompt = startMatch?.[3] ?? "";
          if (prompt.length > 0 && /\s/.test(prompt[0])) prompt = prompt.slice(1);
          if (!id || !msRaw || !prompt.trim()) {
            announce("Use /pstack schedule start <id> <everyMs> <prompt>. Start requires mode on. First wake fires after everyMs.", { requested: action });
            return;
          }
          const result = startSchedule(ctx, id, Number(msRaw), prompt);
          if (!result.ok) {
            announce(result.error, { error: result.error, requested: action });
            return;
          }
          announce(result.deduped ? `Schedule ${result.id} already active. Deadline preserved.` : `Schedule ${result.id} started. First wake after interval.`, result.status);
          return;
        }
        if (sub === "stop") {
          if (parts[2]) {
            const parsed = parseScheduleId(parts[2]);
            if (!parsed.ok) {
              announce(parsed.error, { error: parsed.error, requested: action });
              return;
            }
            clearOne(parsed.id, "explicit-stop");
            announce(`Schedule ${parsed.id} stopped. Unsent due state cleared.`, scheduleStatus(parsed.id));
            return;
          }
          clearAll("explicit-stop-all");
          announce("All schedules stopped. Unsent due state cleared.", scheduleStatus());
          return;
        }
        if (sub === "status") {
          if (parts[2]) {
            const parsed = parseScheduleId(parts[2]);
            if (!parsed.ok) {
              announce(parsed.error, { error: parsed.error, requested: action });
              return;
            }
            const status = scheduleStatus(parsed.id);
            announce(`Schedule ${parsed.id} status. Live-process-only.`, status);
            return;
          }
          announce("Schedule status. Live-process-only. Timers never survive shutdown or restart.", scheduleStatus());
          return;
        }
        announce("Use /pstack schedule start <id> <everyMs> <prompt>, /pstack schedule stop [id], or /pstack schedule status [id].", { requested: action });
        return;
      }
      if (normalized === "update" || normalized === "update check" || normalized.startsWith("update ")) {
        if (ctx.agent.kind !== "main") {
          announce("Pstack update belongs to the coordinator. Follow this worker's scoped assignment.", { enabled });
          return;
        }
        if (normalized !== "update" && normalized !== "update check") {
          announce("Use /pstack update to run the bounded update workflow or /pstack update check to compare only. Extra arguments are not accepted.", { requested: action });
          return;
        }
        const mode = normalized === "update" ? "apply" : "check";
        let body;
        try {
          body = await readFile(updateReferencePath, "utf8");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          announce(`Pstack update reference unreadable at ${updateReferencePath}: ${message}`, { error: message, referencePath: updateReferencePath });
          return;
        }
        pi.sendUserMessage(
          `The user invoked /pstack ${normalized}.\n\n${body}\n\nUpdate request: ${JSON.stringify({ mode })}\n\n[Reference directory: ${updateReferenceDir}]\nResolve relative assets against that directory. Native OMP tool contracts and authorization remain binding.`,
          { attribution: "agent" },
        );
        return;
      }
      announce("Use /pstack status, /pstack on, /pstack off, /pstack models, /pstack schedule start|stop|status, /pstack update, or /pstack update check. Fresh main sessions default on; workers stay off. /poteto-mode enables the mode and invokes the full router; /skill:<name> is the native alternative for any installed skill.", { requested: action });
    },
  });

  const root = join(packageRoot, "skills");
  for (const directory of await readdir(root, { withFileTypes: true })) {
    if (!directory.isDirectory() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(directory.name)) continue;
    const file = join(root, directory.name, "SKILL.md");
    try {
      await access(file);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (aliases.has(directory.name)) throw new Error(`Duplicate pstack alias: ${directory.name}`);
    aliases.set(directory.name, file);
    pi.registerCommand(directory.name, {
      description: `Invoke installed pstack skill ${directory.name}.`,
      handler: async (args, ctx) => {
        if (directory.name === "poteto-mode" && ctx.agent.kind === "main") setMode(true, ctx);
        const source = await readFile(file, "utf8");
        const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
        pi.sendUserMessage(
          `The user invoked the installed pstack skill ${directory.name}.\n\n${body}\n\n[Skill file: ${file}]\n[Skill directory: ${join(root, directory.name)}]\nResolve relative assets against that directory. Pass this actual Skill file path to scoped delegates that need this skill. Native OMP tool contracts and authorization remain binding.\n${args.trim() ? `\nRequested task:\n${args}` : ""}`,
          { attribution: "agent" },
        );
      },
    });
  }
}
