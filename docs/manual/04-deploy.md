# 04 — Deploy (you do this; the agent never deploys)

**What and why:** put Settled online for judges: the API + bot on Render, the web app on Vercel, data on MongoDB Atlas. About 30–45 minutes.

## A. MongoDB Atlas

1. Create a free M0 cluster at cloud.mongodb.com.
2. Database Access → add a user with a strong password.
3. Network Access → allow `0.0.0.0/0` (Render has no fixed IP on the free plan).
4. Connect → Drivers → copy the URI. Add a database name: `…mongodb.net/settled?retryWrites=true&w=majority`. This is `MONGODB_URI`.

## B. API + bot on Render

1. render.com → New → **Web Service** → connect the `Settled` GitHub repo (branch `main` after you merge the PR).
2. Runtime: Node. Root directory: leave empty.
3. Build command: `npm ci --include=dev && npm run build -w web` (with `NODE_ENV=production`, plain `npm ci` skips Vite). Also set env `NODE_VERSION` = `22`.
4. Start command: `npm start -w server`
5. Instance: Starter is best (the free plan sleeps, which stops the bot webhook and the worker).
6. Environment variables (names from `.env.example`):
   - `NODE_ENV` = `production`
   - `MONGODB_URI` (from A4), `JWT_SECRET` (long random)
   - `MASTER_MNEMONIC` (same testnet seed as guide 01)
   - `APP_URL` = your Render URL, e.g. `https://settled-api.onrender.com`
   - `WEB_URL` = your Vercel URL (step C), e.g. `https://settled.vercel.app`
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (long random)
   - `DEMO_INBOX_EMAIL`, and `SMTP_*` if you set up guide 02
   - optional: `SEPOLIA_RPC_URL`, `JUDGE_DAILY_RUN_LIMIT`
7. Deploy. Check `https://<render-url>/api/health` shows `{"ok":true,…}`. The bot switches to webhook mode by itself in production.

## C. Web on Vercel

1. vercel.com → Add New → Project → import the repo.
2. Root directory: `web`. Framework: Vite. Build: `npm run build`. Output: `dist`.
3. `web/vercel.json` (committed; points at `https://settled-5mmc.onrender.com`) sends `/api` to Render so cookies stay first-party. If your Render URL changes, edit it:

   ```
   { "rewrites": [ { "source": "/api/(.*)", "destination": "https://<render-url>/api/$1" }, { "source": "/(.*)", "destination": "/index.html" } ] }
   ```
4. Deploy. Put the Vercel URL in Render's `WEB_URL` and redeploy Render.

Simpler alternative: skip Vercel. Render already serves the built web app from the same URL (set `WEB_URL` = `APP_URL`).

## D. After deploy

1. Run once from your machine with the production `.env`: `node server/scripts/seed-judge.js` (checks funding works).
2. Open `<WEB_URL>/judge` → Start → Run the demo → Run the attacks.
3. In Telegram send `/start` to your bot.
4. Put the links in README "Try it" and the submission.

## How to check it worked

- `/api/health` is ok, `/judge` reaches "Draft ready", the bot answers `/start`, Receipts show real `receipt_hash` values.

## What to tell the agent when done

```
Deployed: web <url>, API <url>, bot @<handle>. Update README links and evidence index.
```
