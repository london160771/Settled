# 02 — Email sending (SMTP) and the demo inbox

**What and why:** Settled can send the claim email for the user (after they confirm the address). That needs an SMTP account. Without it, Settled still works: it opens a `mailto:` link and the user sends from their own mail app, then marks it sent. Judge/demo accounts can only send to one inbox you own (`DEMO_INBOX_EMAIL`).

This is optional for the build. Do it before recording the video if you want "Send" to really send.

## Steps

1. Pick a provider (your choice, PRD open question). Easiest options:
   - **Resend** (free tier): create an account, verify a sending domain or use their test sender, create an SMTP password. Host `smtp.resend.com`, port `465`, user `resend`.
   - **Gmail app password:** turn on 2-step verification, then create an app password at myaccount.google.com → Security → App passwords. Host `smtp.gmail.com`, port `465`, user = your Gmail address.
2. Make a separate inbox for demos (for example a new Gmail address). This is `DEMO_INBOX_EMAIL`.
3. Open [Project settings](#project-settings/environment) → Cloud environment → gear next to the selected environment.
4. Add these environment variables (values never go in the repo):
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM` (for example `Settled <claims@yourdomain>`; must be allowed by the provider)
   - `DEMO_INBOX_EMAIL`
5. If you use a custom network allow-list, add your SMTP host (e.g. `smtp.resend.com` or `smtp.gmail.com`).
6. Save. A new session picks the variables up.

## How to check it worked

- The agent sends one test claim from a demo account to `DEMO_INBOX_EMAIL`. You should see it in that inbox with the subject `Compensation claim: …`.
- Real users only get emails to the address they typed and confirmed.

## What to tell the agent when done

```
SMTP and DEMO_INBOX_EMAIL are set. Done, continue (send the Phase 5 test email to the demo inbox).
```
