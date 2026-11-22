# Starting prompt for Claude Code (cloud)

Paste the whole block into a new Claude Code session on that repo.

```
You are building Settled, a real product (web app + Telegram bot) for the Telegraph Protocol Hackathon Season II, Apps & Agents track, missions 15 and 9.

Repo: https://github.com/london160771/Settled

Before writing any code:
1. Read CLAUDE.md, then PRD.md, then PROJECT_STATE.md, in full. PRD.md is the source of truth. CLAUDE.md is your rulebook.
2. Check the repo state yourself: git status, git log, and what files already exist.

Then work through the PRD phases (PRD §14) in order, starting from the first phase not marked Passed in PROJECT_STATE.md. For each phase:
- Build only that phase's scope, with the smallest change that meets its acceptance criteria.
- Run its checks (lint, tests, build, and any live check it names) and fix until they pass.
- Confirm each acceptance criterion against the PRD.
- Update PROJECT_STATE.md, commit as "Phase N: <result>", and push.
- Give me the short report from CLAUDE.md, then go straight on to the next phase. Don't wait for me.

Stop only when the next step needs me to do something by hand (secrets, .env values, MongoDB Atlas, wallet seed, Sepolia ETH or test USDC, BotFather token, SMTP, network settings, or a choice the PRD marks as mine). Before stopping: finish and push everything that doesn't need me, write a simple step-by-step guide in docs/manual/NN-name.md, mark "Blocked on" in PROJECT_STATE.md, push, and tell me in plain words what to do and which guide to open. If a later phase can be built without the manual task, build it first and stop only when nothing more can be done.

Hard rules: never deploy; never commit or print secrets; never claim something works unless you ran it; label anything mocked or replayed; pay Telegraph only on Ethereum Sepolia and handle bug #228 exactly as CLAUDE.md says; no scope creep (new ideas go to ROADMAP.md).

Stop after Phase 10 (P0 done). Do not start Phases 11–12 until I say so.

Start now with Phase 0.
```
