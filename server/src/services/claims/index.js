// Claims: draft (only from receipt-backed facts), recipient confirm, send, status.
// Invariant 2: no unbacked fact in a draft. Invariant 4: nothing is sent without the user's
// explicit confirm naming the recipient. There is no auto-send path.
import nodemailer from 'nodemailer';
import { Case, Claim, Decision, Receipt, User } from '../../models/index.js';
import { AppError } from '../../errors.js';
import { getAirport } from '../flights/airports.js';
import { getVendor } from '../sla/vendors.js';

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '');

export function proofUrl(config, publicId) {
  return `${config.webUrl.replace(/\/$/, '')}/proof/${publicId}`;
}

// Every fact used in the draft must point to at least one stored, settled receipt with a hash.
export async function backedFacts(decision) {
  const out = {};
  for (const ref of decision.factRefs || []) {
    const ids = ref.receiptIds || [];
    const receipts = ids.length
      ? await Receipt.find({
          _id: { $in: ids },
          receiptHash: { $exists: true, $ne: null },
          status: { $in: ['settled', 'reconciled'] },
        }).lean()
      : [];
    if (!receipts.length || receipts.length !== ids.length) {
      throw new AppError(
        'NEEDS_MORE_PROOF',
        `Fact "${ref.fact}" has no paid receipt behind it; no draft.`,
      );
    }
    out[ref.fact] = { value: ref.value, receipts };
  }
  return out;
}

function receiptLines(facts) {
  const all = Object.entries(facts).flatMap(([fact, f]) => f.receipts.map((r) => ({ fact, r })));
  return all.map(
    ({ fact, r }) =>
      `- ${fact}: ${r.intent}, miner ${r.minerName || r.minerId}, receipt ${r.receiptHash}, ${new Date(r.createdAt).toISOString()}`,
  );
}

export function slaDraftText({ c, decision, facts, user, url }) {
  const v = getVendor(c.vendor);
  const f = decision.facts || {};
  const ask =
    f.creditUsd != null
      ? `a service credit of ${f.creditPct}% of my monthly fee (${f.creditUsd} USD of ${f.monthlyFeeUsd} USD)`
      : `a service credit of ${f.creditPct}% of my monthly fee for ${c.period}`;
  return [
    `Dear ${v?.name || c.vendor} support / billing team,`,
    '',
    `Your service level agreement promises ${f.targetPct}% monthly uptime. In ${c.period} the measured uptime was ${facts.uptimePct.value}%, based on your own public status page incident history.`,
    '',
    `Under the service credit terms of my agreement, I am requesting ${ask}.`,
    '',
    `The uptime figures were checked by independent data providers on the Telegraph network, and a second provider confirmed the breach. Each check has a receipt you can verify here: ${url}`,
    '',
    'Please confirm the credit or reply with your decision within 14 days.',
    '',
    'Kind regards,',
    user.claimFromName || user.displayName || '',
    '',
    '---',
    'Receipts (Telegraph, testnet):',
    ...receiptLines(facts),
  ].join('\n');
}

export function draftText({ c, decision, facts, user, url }) {
  if (c.type === 'sla') return slaDraftText({ c, decision, facts, user, url });
  const dep = getAirport(c.from);
  const arr = getAirport(c.to);
  const route = `${dep?.name || c.from} (${c.from}) to ${arr?.name || c.to} (${c.to})`;
  const what = facts.cancelled
    ? 'was cancelled'
    : `arrived ${facts.delayMinutes.value} minutes late (${Math.floor(facts.delayMinutes.value / 60)}h${String(facts.delayMinutes.value % 60).padStart(2, '0')}m)`;
  const lines = [
    `Dear ${c.flightNumber.slice(0, 2)} customer relations team,`,
    '',
    `I was a passenger on flight ${c.flightNumber} on ${c.date}, from ${route}. The flight ${what}.`,
    '',
    `Under Regulation (EC) 261/2004 (and the UK version of it), a delay of 3 hours or more at arrival on a flight of this distance (${decision.facts?.distanceKm} km) gives a right to compensation of ${decision.amountEur} EUR. I am asking you to pay ${decision.amountEur} EUR.`,
  ];
  if (c.bookingRef) lines.push('', `My booking reference is ${c.bookingRef}.`);
  lines.push(
    '',
    `The facts above were checked by independent data providers on the Telegraph network. Each check has a receipt you can verify here: ${url}`,
    '',
    'Please reply with the payment details or your decision within 14 days.',
    '',
    'Kind regards,',
    user.claimFromName || user.displayName || '',
    '',
    '---',
    'Receipts (Telegraph, testnet):',
  );
  lines.push(...receiptLines(facts));
  return lines.join('\n');
}

export async function createDraft(config, userId, caseId) {
  const c = await Case.findOne({ _id: caseId, userId });
  if (!c) throw new AppError('NOT_FOUND', 'Case not found');
  const existing = await Claim.findOne({ caseId: c._id });
  if (existing) return existing; // one claim per case
  const decision = await Decision.findOne({ caseId: c._id }).sort({ createdAt: -1 }).lean();
  if (!decision || decision.outcome !== 'Owed') {
    throw new AppError(
      'NOT_ELIGIBLE',
      `No claim: latest decision is ${decision?.outcome || 'missing'}.`,
    );
  }
  const facts = await backedFacts(decision);
  if (
    c.type === 'sla'
      ? !facts.uptimePct || !facts.breachCorroborated
      : !facts.delayMinutes && !facts.cancelled
  )
    throw new AppError('NEEDS_MORE_PROOF', 'The key fact has no paid receipt behind it.');
  const user = await User.findById(userId).lean();
  const url = proofUrl(config, c.publicId);
  try {
    const claim = await Claim.create({
      caseId: c._id,
      userId,
      decisionId: decision._id,
      subject:
        c.type === 'sla'
          ? `SLA service credit request: ${getVendor(c.vendor)?.name || c.vendor}, ${c.period}`
          : `Compensation claim: ${c.flightNumber} on ${c.date} (EU261)`,
      draftText: draftText({ c, decision, facts, user, url }),
      proofUrl: url,
      recipientEmail: user.isDemo ? config.demoInboxEmail : undefined,
    });
    await Case.updateOne({ _id: c._id }, { $set: { status: 'DraftReady' } });
    return claim;
  } catch (e) {
    if (e.code === 11000)
      throw new AppError('DUPLICATE_CLAIM', 'A claim for this case already exists.');
    throw e;
  }
}

async function ownClaim(userId, claimId) {
  const claim = await Claim.findOne({ _id: claimId, userId });
  if (!claim) throw new AppError('NOT_FOUND', 'Claim not found');
  return claim;
}

export async function editDraft(userId, claimId, { draftText: text, subject }) {
  const claim = await ownClaim(userId, claimId);
  if (claim.status !== 'DraftReady')
    throw new AppError('BAD_REQUEST', 'Only drafts can be edited.');
  if (typeof text === 'string') claim.draftText = text.slice(0, 20000);
  if (typeof subject === 'string') claim.subject = subject.slice(0, 300);
  return claim.save();
}

// Step 1: the user enters the recipient. Nothing is sent. Clears any earlier confirmation.
export async function setRecipient(config, userId, claimId, email) {
  const claim = await ownClaim(userId, claimId);
  const user = await User.findById(userId).lean();
  const addr = String(email || '')
    .trim()
    .toLowerCase();
  if (!EMAIL.test(addr)) throw new AppError('BAD_REQUEST', 'That email address looks wrong.');
  if (user.isDemo && addr !== String(config.demoInboxEmail || '').toLowerCase()) {
    throw new AppError('BAD_REQUEST', 'Demo accounts can only send to the demo inbox.');
  }
  claim.recipientEmail = addr;
  claim.recipientConfirmedAt = null;
  return claim.save();
}

export function mailtoLink(claim) {
  return `mailto:${encodeURIComponent(claim.recipientEmail)}?subject=${encodeURIComponent(claim.subject)}&body=${encodeURIComponent(claim.draftText)}`;
}

// Step 2: the user taps "Send to <address>". confirmRecipient must name the stored address.
export async function sendClaim(config, userId, claimId, { confirmRecipient } = {}, deps = {}) {
  const claim = await ownClaim(userId, claimId);
  if (claim.status !== 'DraftReady')
    throw new AppError('BAD_REQUEST', `Claim is already ${claim.status}.`);
  const to = claim.recipientEmail;
  if (!to || !confirmRecipient || String(confirmRecipient).trim().toLowerCase() !== to) {
    throw new AppError(
      'RECIPIENT_NOT_CONFIRMED',
      'Confirm the exact recipient address before sending.',
    );
  }
  const user = await User.findById(userId).lean();
  if (user.isDemo && to !== String(config.demoInboxEmail || '').toLowerCase()) {
    throw new AppError('RECIPIENT_NOT_CONFIRMED', 'Demo accounts can only send to the demo inbox.');
  }
  claim.recipientConfirmedAt = new Date();
  const transport =
    deps.transport ||
    (config.smtp
      ? nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.port === 465,
          auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
        })
      : null);
  if (!transport) {
    await claim.save();
    return { claim, via: 'mailto', mailto: mailtoLink(claim) }; // user sends it, then marks it sent
  }
  await transport.sendMail({
    from: config.smtp?.from || 'settled@localhost',
    to,
    replyTo: user.email || undefined,
    subject: claim.subject,
    text: claim.draftText,
  });
  claim.status = 'Sent';
  claim.sentAt = new Date();
  claim.sentVia = 'smtp';
  await claim.save();
  await Case.updateOne({ _id: claim.caseId }, { $set: { status: 'Sent' } });
  return { claim, via: 'smtp' };
}

// mailto path: after the user sent it from their own mail app.
export async function markSent(userId, claimId) {
  const claim = await ownClaim(userId, claimId);
  if (claim.status !== 'DraftReady')
    throw new AppError('BAD_REQUEST', `Claim is already ${claim.status}.`);
  if (!claim.recipientConfirmedAt)
    throw new AppError('RECIPIENT_NOT_CONFIRMED', 'Confirm the recipient first.');
  claim.status = 'Sent';
  claim.sentAt = new Date();
  claim.sentVia = 'mailto';
  await claim.save();
  await Case.updateOne({ _id: claim.caseId }, { $set: { status: 'Sent' } });
  return claim;
}

export async function markOutcome(userId, claimId, outcome, { amountEur } = {}) {
  if (!['Paid', 'Rejected'].includes(outcome))
    throw new AppError('BAD_REQUEST', 'Outcome must be Paid or Rejected.');
  const claim = await ownClaim(userId, claimId);
  if (claim.status !== 'Sent')
    throw new AppError('BAD_REQUEST', 'Only sent claims can be marked paid or rejected.');
  claim.status = outcome;
  if (outcome === 'Paid' && Number.isFinite(Number(amountEur)))
    claim.paidAmountEur = Number(amountEur);
  await claim.save();
  await Case.updateOne({ _id: claim.caseId }, { $set: { status: outcome } });
  return claim;
}

// Public proof page data: only what is needed. No email, no booking reference.
export async function getProof(publicId) {
  const c = await Case.findOne({ publicId }).lean();
  if (!c) throw new AppError('NOT_FOUND', 'No proof page here.');
  const decision = await Decision.findOne({ caseId: c._id }).sort({ createdAt: -1 }).lean();
  const ids = (decision?.factRefs || []).flatMap((f) => f.receiptIds || []);
  const receipts = await Receipt.find({ _id: { $in: ids } }).lean();
  return {
    type: c.type || 'flight',
    vendor: c.type === 'sla' ? getVendor(c.vendor)?.name || c.vendor : undefined,
    period: c.period,
    flightNumber: c.flightNumber,
    date: c.date,
    from: c.from,
    to: c.to,
    status: c.status,
    replayed: !!c.isReplayed,
    decision: decision
      ? {
          outcome: decision.outcome,
          amountEur: decision.amountEur,
          amountUsd: decision.amountUsd,
          reasons: decision.reasons,
          warnings: decision.warnings,
          rulesVersion: decision.rulesVersion,
          decidedAt: decision.createdAt,
        }
      : null,
    facts: (decision?.factRefs || []).map((f) => ({
      fact: f.fact,
      value: f.value,
      receiptHashes: receipts
        .filter((r) => (f.receiptIds || []).some((id) => String(id) === String(r._id)))
        .map((r) => r.receiptHash),
    })),
    receipts: receipts.map((r) => ({
      intent: r.intent,
      minerId: r.minerId,
      minerName: r.minerName,
      receiptHash: r.receiptHash,
      shortHash: short(r.receiptHash),
      epochId: r.epochId,
      txHash: r.txHash || null,
      costUusdc: r.costUusdc,
      at: r.createdAt,
      replayed: !!r.replayed,
      verifyUrl:
        r.epochId != null && r.receiptHash
          ? `https://devnode.telegraphprotocol.com/v1/blocks/${r.epochId}/deliveries/${r.receiptHash}`
          : null,
      signalUrl: r.signalHash
        ? `https://devnode.telegraphprotocol.com/engine/v1/signal/${r.signalHash}`
        : null,
    })),
    network: 'Telegraph testnet · Ethereum Sepolia · test USDC',
  };
}
