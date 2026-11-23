# 03 — Telegram bot token (BotFather)

**What and why:** the Settled bot needs its own Telegram bot and token. Only you can create it (it is tied to your Telegram account). The bot code is built and tested; it stays off until the token is set.

## Steps

1. In Telegram, open **@BotFather** and send `/newbot`.
2. Name: `Settled` (or `Settled Claims`).
3. Username: must end in `bot`. Try `SettledClaimsBot`, `SettledProofBot` or `GetSettledBot` (pick one that is free; this is your choice).
4. BotFather replies with a token like `123456:ABC…`. Keep it secret. Do not paste it in chat.
5. (Optional) In BotFather: `/setdescription` → "Proof first. Then the claim. Settled buys proof from Telegraph miners and drafts your delay claim. Testnet."
6. Open [Project settings](#project-settings/environment) → Cloud environment → gear next to the selected environment.
7. Add an environment variable `TELEGRAM_BOT_TOKEN` with the token.
8. (Only for production, when you deploy) also add `TELEGRAM_WEBHOOK_SECRET` with any long random string. Locally and in the cloud session the bot uses long polling and does not need it.
9. Save. A new session picks it up.

## How to check it worked

- The agent starts the server (`npm run dev`), you send `/start` to your bot, and it replies "Welcome to Settled…".
- Send `BA75 2026-11-20 LHR LOS`: it replies "Case added…" with a **Check now** button.

## What to tell the agent when done

```
TELEGRAM_BOT_TOKEN is set (bot handle @<your_bot_username>). Done, continue (run the live /start check).
```
