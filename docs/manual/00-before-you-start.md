# 00 — Before you start the Claude Code cloud session

Do these once. They take about 15 minutes.

## 1. Create the GitHub repo

1. On GitHub, create a new repo named `settled` (public is best, judges need to see it; private is fine until you submit).
2. Don't add a README, license or .gitignore (the docs already include them).
3. Copy the repo URL, e.g. `https://github.com/<your-username>/settled`.
4. Make sure the Claude GitHub App can access this repo (install it at https://github.com/apps/claude/installations/select_target and include `settled`).

## 2. Set up the cloud environment

In Claude Code on the web, open (or create) the environment you will use for this repo.

1. **Network access:** the build must reach these hosts. Pick "Full" network access, or add them to the allowed list if you use a custom list:
   - `devnode.telegraphprotocol.com` (Telegraph asks and ledger)
   - your Sepolia RPC host (e.g. `ethereum-sepolia-rpc.publicnode.com`, or your Alchemy/Infura host)
   - `api.telegram.org` (bot)
   - `registry.npmjs.org` (packages)
   - `fastdl.mongodb.org` (test database binary)
   - your MongoDB Atlas host and your SMTP host (later)
2. **Environment variables:** leave them empty for now. The agent will stop and tell you exactly which ones to add, and when (guides 01, 02, 03).

## 3. Start the session

1. Start a new Claude Code session on the `settled` repo.
2. Paste the starting prompt (STARTING_PROMPT.md) with your repo URL filled in.
3. Leave it running. It commits and pushes after each phase and stops only when it needs you.

## How to check it's working

- After a few minutes you should see a commit `Phase 0: …` on GitHub.
- PROJECT_STATE.md on GitHub shows Phase 0 as Passed.
