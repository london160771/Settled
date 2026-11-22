// Telegram handlers. They only translate chat ↔ services (no business logic here).
// io = { telegramId, reply(text, { buttons?: [[{ text, data }]] }) }
import { createHash } from 'node:crypto';
import { User, Claim } from '../models/index.js';
import { AppError } from '../errors.js';
import * as auth from '../services/auth.js';
import * as cases from '../services/cases.js';
import * as claims from '../services/claims/index.js';
import * as account from '../services/account.js';
import { createUser } from '../services/users.js';
import { checkCase } from '../services/flights/evidence.js';
import { parseBookingText } from '../services/booking.js';
import { getBudget } from '../services/budget/index.js';
import { paidAsk } from '../services/ask/index.js';

const usdc = (u) => (Number(u) / 1e6).toFixed(2);
const short = (h) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : '—');
const emailTag = (e) => createHash('sha256').update(String(e)).digest('hex').slice(0, 8);
const FLIGHT_MSG =
  /^\s*([A-Z0-9]{2}\s?\d{1,4})\s+(\d{4}-\d{2}-\d{2})(?:\s+([A-Z]{3})(?:\s*[- ]\s*|\s+)([A-Z]{3}))?\s*$/i;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export function receiptLine(r) {
  return `🧾 ${r.intent} · ${r.minerName || r.minerId || 'miner'} · ${(r.costUusdc / 1e6).toFixed(2)} test USDC · ${short(r.receiptHash)}`;
}

export function createHandlers(config, deps = {}) {
  const awaitingRecipient = new Map(); // telegramId → claimId

  async function userFor(io) {
    return User.findOne({ telegramId: String(io.telegramId) });
  }
  async function needUser(io) {
    const u = await userFor(io);
    if (!u) {
      await io.reply('Send /start first.');
      return null;
    }
    return u;
  }
  const fail = (io, err) =>
    io.reply(
      err instanceof AppError
        ? `⛔ ${err.code}: ${err.message}${err.nextAction ? `\n${err.nextAction}` : ''}`
        : '⛔ Something went wrong. Try again.',
    );

  async function start(io, code) {
    const tid = String(io.telegramId);
    if (code) {
      try {
        const uid = await auth.consumeLinkCode(code, 'telegram');
        await User.updateMany(
          { telegramId: tid, _id: { $ne: uid } },
          { $unset: { telegramId: 1 } },
        );
        await User.updateOne({ _id: uid }, { $set: { telegramId: tid } });
        return io.reply(
          '✅ Linked to your Settled web account. Send a flight like `BA75 2026-11-20 LHR LOS`.',
        );
      } catch (e) {
        return fail(io, e);
      }
    }
    let u = await userFor(io);
    if (!u) {
      u = await auth.afterCreate(
        config,
        await createUser(config, { telegramId: tid, displayName: io.name || '' }),
      );
      return io.reply(
        'Welcome to Settled. Proof first. Then the claim.\n\nSend a late flight like `BA75 2026-11-20 LHR LOS`, or forward the booking email. I buy proof from Telegraph miners (testnet, capped), decide if you are owed money, and draft the claim. Nothing is sent without your yes.\n\nAlready on the web? Use Settings → Telegram to get a link code.',
      );
    }
    return io.reply(
      'You are set up. Send a flight like `BA75 2026-11-20 LHR LOS`. /claims /wallet /cap /web',
    );
  }

  async function caseAdded(io, c, warning) {
    const lines = [
      `✈️ Case added: ${c.flightNumber} on ${c.date}${c.from && c.to ? ` (${c.from} → ${c.to})` : ''}.`,
    ];
    if (warning) lines.push(`⚠️ ${warning.code}: ${warning.message}`);
    if (!c.from || !c.to)
      lines.push('Tip: add the airports on the web so I can work out the distance.');
    return io.reply(lines.join('\n'), { buttons: [[{ text: 'Check now', data: `ck:${c._id}` }]] });
  }

  async function text(io, msg, { forwarded = false } = {}) {
    const u = await needUser(io);
    if (!u) return;
    const pending = awaitingRecipient.get(String(io.telegramId));
    if (pending && EMAIL.test(msg.trim())) {
      awaitingRecipient.delete(String(io.telegramId));
      try {
        const claim = await claims.setRecipient(config, u._id, pending, msg.trim());
        return io.reply(`Send the claim to ${claim.recipientEmail}?`, {
          buttons: [
            [
              {
                text: `Send to ${claim.recipientEmail}`,
                data: `cf:${claim._id}:${emailTag(claim.recipientEmail)}`,
              },
              { text: 'Cancel', data: `nn:${claim._id}` },
            ],
          ],
        });
      } catch (e) {
        return fail(io, e);
      }
    }
    const m = FLIGHT_MSG.exec(msg);
    try {
      if (m && !forwarded) {
        const c = await cases.addFlightCase(u._id, {
          flightNumber: m[1].replace(/\s/g, ''),
          date: m[2],
          from: m[3],
          to: m[4],
        });
        return caseAdded(io, c);
      }
      const parsed = parseBookingText(msg); // data only
      if (!parsed.flightNumber || !parsed.date) {
        return io.reply(
          parsed.untrusted
            ? `⚠️ ${parsed.untrusted.code}: ${parsed.untrusted.message}\nI could not find a flight in it.`
            : 'I did not find a flight. Send it like `BA75 2026-11-20 LHR LOS`.',
        );
      }
      const c = await cases.addFlightCase(u._id, parsed);
      return caseAdded(io, c, parsed.untrusted);
    } catch (e) {
      return fail(io, e);
    }
  }

  async function callback(io, data) {
    const u = await needUser(io);
    if (!u) return;
    const [kind, id, tag] = String(data).split(':');
    try {
      if (kind === 'ck') {
        const budget = await getBudget(u._id);
        await io.reply(
          `🔎 Checking proof (cap ${usdc(Math.min(budget.decisionCapUusdc, budget.remainingUusdc))} test USDC)…`,
        );
        const d = await checkCase(config, id, {
          ...(deps.telegraph || {}),
          onReceipt: (r) => io.reply(receiptLine(r)),
        });
        const c = await cases.getCase(u._id, id);
        const delay = d.facts?.delayMinutes;
        const head =
          delay != null
            ? `Your flight ${c.flightNumber} landed ${Math.floor(delay / 60)}h${String(delay % 60).padStart(2, '0')}m late.`
            : `Decision for ${c.flightNumber}:`;
        const body = [
          head,
          `Decision: ${d.outcome}${d.amountEur ? ` · ${d.amountEur} EUR` : ''}`,
          ...d.reasons.map((r) => `• ${r}`),
          ...(d.warnings || []).map((w) => `⚠️ ${w}`),
        ].join('\n');
        if (d.outcome !== 'Owed') return io.reply(body);
        const claim = await claims.createDraft(config, u._id, id);
        await io.reply(body);
        return io.reply(`📝 Draft ready:\n\n${claim.draftText.slice(0, 3500)}`, {
          buttons: [
            [
              { text: 'Send', data: `sd:${claim._id}` },
              { text: 'Edit', data: `ed:${claim._id}` },
              { text: 'Not now', data: `nn:${claim._id}` },
            ],
          ],
        });
      }
      if (kind === 'sd') {
        const claim = await Claim.findOne({ _id: id, userId: u._id });
        if (!claim) throw new AppError('NOT_FOUND', 'Claim not found');
        if (!claim.recipientEmail) {
          awaitingRecipient.set(String(io.telegramId), String(claim._id));
          return io.reply("What is the airline's claims email address? Reply with it.");
        }
        return io.reply(`Send the claim to ${claim.recipientEmail}?`, {
          buttons: [
            [
              {
                text: `Send to ${claim.recipientEmail}`,
                data: `cf:${claim._id}:${emailTag(claim.recipientEmail)}`,
              },
              { text: 'Cancel', data: `nn:${claim._id}` },
            ],
          ],
        });
      }
      if (kind === 'cf') {
        const claim = await Claim.findOne({ _id: id, userId: u._id }).lean();
        if (!claim?.recipientEmail || emailTag(claim.recipientEmail) !== tag)
          throw new AppError('RECIPIENT_NOT_CONFIRMED', 'The address changed. Tap Send again.');
        const out = await claims.sendClaim(
          config,
          u._id,
          id,
          { confirmRecipient: claim.recipientEmail },
          deps.mail || {},
        );
        if (out.via === 'smtp')
          return io.reply(
            `✅ Sent to ${claim.recipientEmail}. I will show it as Sent on the web too.`,
          );
        return io.reply(
          `Email sending is not set up on this server. Open the draft on the web to send it from your mail app: ${config.webUrl}/cases/${claim.caseId}`,
        );
      }
      if (kind === 'ed')
        return io.reply(
          `Edit the draft on the web: ${config.webUrl}/cases/${(await Claim.findById(id).lean())?.caseId}`,
        );
      if (kind === 'nn') return io.reply('OK, not now. It stays in /claims.');
    } catch (e) {
      return fail(io, e);
    }
  }

  async function listClaims(io) {
    const u = await needUser(io);
    if (!u) return;
    const list = await cases.listCases(u._id);
    if (!list.length)
      return io.reply('No claims yet. Send a flight like `BA75 2026-11-20 LHR LOS`.');
    return io.reply(
      list
        .slice(0, 15)
        .map((c) => `• ${c.flightNumber} ${c.date} — ${c.status}`)
        .join('\n'),
    );
  }

  async function wallet(io) {
    const u = await needUser(io);
    if (!u) return;
    const w = await account.walletView(config, u._id, deps.telegraph || {});
    const b = w.budget;
    return io.reply(
      [
        `Wallet (Ethereum Sepolia testnet, custodial): ${w.address}`,
        `Escrow balance: ${w.escrow ? usdc(w.escrow.availableUusdc) : 'unavailable'} test USDC`,
        `Spent this month: ${usdc(b.spentUusdc)} / cap ${usdc(b.monthlyCapUusdc)} (reserved ${usdc(b.reservedUusdc)})`,
        `Per decision cap: ${usdc(b.decisionCapUusdc)}`,
      ].join('\n'),
    );
  }

  async function cap(io, arg) {
    const u = await needUser(io);
    if (!u) return;
    const v = Number(arg);
    if (!arg || !Number.isFinite(v) || v <= 0)
      return io.reply('Usage: /cap 1.50  (monthly cap in test USDC)');
    try {
      const nu = await account.updateSettings(u._id, { monthlyCapUusdc: Math.round(v * 1e6) });
      return io.reply(`Monthly cap set to ${usdc(nu.caps.monthlyCapUusdc)} test USDC.`);
    } catch (e) {
      return fail(io, e);
    }
  }

  async function web(io) {
    const u = await needUser(io);
    if (!u) return;
    const code = await auth.createLinkCode(u._id, 'weblogin');
    return io.reply(
      `Open this within 10 minutes to sign in on the web (one use): ${config.appUrl}/api/auth/link/${code}`,
    );
  }

  async function ask(io, kind, input) {
    const u = await needUser(io);
    if (!u) return;
    if (!String(input || '').trim())
      return io.reply(
        `Usage: /${kind} <${kind === 'price' ? 'token, e.g. ETH' : kind === 'weather' ? 'city' : 'question'}>`,
      );
    try {
      const out = await paidAsk(config, u._id, kind, input, deps.telegraph || {});
      return io.reply(`${out.answer}\n\n${receiptLine(out.receipt)}`);
    } catch (e) {
      return fail(io, e);
    }
  }

  return { start, text, callback, listClaims, wallet, cap, web, ask, awaitingRecipient };
}
