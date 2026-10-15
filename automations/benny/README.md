# benny

benny gives you two hosted automations for slack issue reports. one triages each report. the other reproduces confirmed bugs and may prepare a small draft fix.

the files in this directory are dormant setup and automation sources. they do not appear as slash skills.

hosting and scheduling are named prerequisites, not part of this pack. benny supplies the run prompts, the configuration schema, and the operational files. a real scheduler or automation host runs them. never autostart external automations from setup.

## set it up

1. point your OMP agent at [`FOR_AGENTS.md`](./FOR_AGENTS.md) and name the target repository.
2. let setup merge this whole directory into the target at `.omp/automations/benny/`. it must preserve destination-only files and review conflicts instead of overwriting local edits.
3. let setup confirm the installed pstack skills resolve in project scope for shared dependencies such as `how`, `why`, `tdd`, `unslop`, and the required principle skills.
4. keep user-owned configuration outside the copied pack, for example in `.omp/benny/`. adapt [`configuration.example.yaml`](./templates/configuration.example.yaml) and [`feature-map.example.md`](./skills/reproduce-and-fix-issues/references/feature-map.example.md).
5. commit `.omp/automations/benny/` and any secret-free configuration before enabling either automation.
6. review each new automation draft in the host scheduler, then send a harmless test report and verify every source-channel post stays in the original thread.
