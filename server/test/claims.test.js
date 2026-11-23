import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';
import { startDb, stopDb, clearDb, testConfig } from './helpers.js';
import { createUser } from '../src/services/users.js';
import { addFlightCase } from '../src/services/cases.js';
import {
  createDraft,
  setRecipient,
  sendClaim,
  markSent,
  markOutcome,
  getProof,
  editDraft,
} from '../src/services/claims/index.js';
import { Decision, Receipt, Case, Claim } from '../src/models/index.js';

const config = testConfig({
  DEMO_INBOX_EMAIL: 'demo-inbox@example.com',
  WEB_URL: 'https://settled.test',
});
beforeAll(startDb, 120000);
afterAll(stopDb);
beforeEach(clearDb);

async function owedCase({ user, unbacked = false, outcome = 'Owed' } = {}) {
  const u = user || (await createUser(config, { email: 'ada@example.com', claimFromName: 'Ada' }));
  const c = await addFlightCase(u._id, {
    flightNumber: 'BA75',
    date: '2026-11-20',
    from: 'LHR',
    to: 'LOS',
    bookingRef: 'XYZ123',
  });
  const mk = (minerId, i) => ({
    userId: u._id,
    caseId: c._id,
    askId: `a${i}`,
    intent: 'TRAVEL_DISRUPTION_GENERAL',
    minerId,
    minerName: `Miner ${minerId}`,
    costUusdc: 10000,
    receiptHash: `0x${String(i).repeat(64).slice(0, 64)}`,
    epochId: 40,
    status: 'settled',
  });
  const r1 = await Receipt.create(mk('m1', 1));
  const r2 = unbacked
    ? await Receipt.create({
        userId: u._id,
        caseId: c._id,
        askId: 'a2',
        intent: 'TRAVEL_DISRUPTION_GENERAL',
        costUusdc: 10000,
        status: 'charged_on_failure',
      })
    : await Receipt.create(mk('m2', 2));
  await Decision.create({
    caseId: c._id,
    outcome,
    amountEur: outcome === 'Owed' ? 600 : null,
    reasons: ['r'],
    facts: { delayMinutes: 220, distanceKm: 5004 },
    factRefs: [{ fact: 'delayMinutes', value: 220, receiptIds: [r1._id, r2._id] }],
    rulesVersion: 'eu261-simple-1',
  });
  await Case.updateOne({ _id: c._id }, { $set: { status: outcome } });
  return { u, c, r1, r2 };
}

const jsonTransport = () => {
  const t = nodemailer.createTransport({ jsonTransport: true });
  t.sent = [];
  const orig = t.sendMail.bind(t);
  t.sendMail = async (m) => (t.sent.push(m), orig(m));
  return t;
};

describe('invariant 2: proof behind every fact', () => {
  it('draft carries every receipt hash and the proof link', async () => {
    const { u, c, r1, r2 } = await owedCase();
    const claim = await createDraft(config, u._id, c._id);
    expect(claim.draftText).toContain(r1.receiptHash);
    expect(claim.draftText).toContain(r2.receiptHash);
    expect(claim.draftText).toContain(`https://settled.test/proof/${c.publicId}`);
    expect(claim.draftText).toMatch(/220 minutes late/);
    expect(claim.draftText).toMatch(/600 EUR/);
    expect((await Case.findById(c._id)).status).toBe('DraftReady');
  });
  it('a fact backed by a receipt without receipt_hash blocks the draft', async () => {
    const { u, c } = await owedCase({ unbacked: true });
    await expect(createDraft(config, u._id, c._id)).rejects.toMatchObject({
      code: 'NEEDS_MORE_PROOF',
    });
    expect(await Claim.countDocuments()).toBe(0);
  });
  it('no draft when not owed', async () => {
    const { u, c } = await owedCase({ outcome: 'NotOwed' });
    await expect(createDraft(config, u._id, c._id)).rejects.toMatchObject({ code: 'NOT_ELIGIBLE' });
  });
});

describe('invariant 4: consent before sending', () => {
  it('send without a recipient, or with a different confirm, is refused', async () => {
    const { u, c } = await owedCase();
    const claim = await createDraft(config, u._id, c._id);
    const t = jsonTransport();
    await expect(
      sendClaim(config, u._id, claim._id, { confirmRecipient: 'x@y.com' }, { transport: t }),
    ).rejects.toMatchObject({ code: 'RECIPIENT_NOT_CONFIRMED' });
    await setRecipient(config, u._id, claim._id, 'claims@airline.example');
    await expect(sendClaim(config, u._id, claim._id, {}, { transport: t })).rejects.toMatchObject({
      code: 'RECIPIENT_NOT_CONFIRMED',
    });
    await expect(
      sendClaim(
        config,
        u._id,
        claim._id,
        { confirmRecipient: 'other@airline.example' },
        { transport: t },
      ),
    ).rejects.toMatchObject({ code: 'RECIPIENT_NOT_CONFIRMED' });
    expect(t.sent).toHaveLength(0);
  });
  it('sends by SMTP only after confirm naming the address, with Reply-To the user', async () => {
    const { u, c } = await owedCase();
    const claim = await createDraft(config, u._id, c._id);
    await setRecipient(config, u._id, claim._id, 'Claims@Airline.example');
    const t = jsonTransport();
    const out = await sendClaim(
      config,
      u._id,
      claim._id,
      { confirmRecipient: 'claims@airline.example' },
      { transport: t },
    );
    expect(out.via).toBe('smtp');
    expect(t.sent[0]).toMatchObject({ to: 'claims@airline.example', replyTo: 'ada@example.com' });
    expect((await Case.findById(c._id)).status).toBe('Sent');
    await expect(
      sendClaim(
        config,
        u._id,
        claim._id,
        { confirmRecipient: 'claims@airline.example' },
        { transport: t },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    const paid = await markOutcome(u._id, claim._id, 'Paid', { amountEur: 600 });
    expect(paid.status).toBe('Paid');
  });
  it('without SMTP: mailto link, user marks it sent', async () => {
    const { u, c } = await owedCase();
    const claim = await createDraft(config, u._id, c._id);
    await setRecipient(config, u._id, claim._id, 'claims@airline.example');
    const out = await sendClaim(config, u._id, claim._id, {
      confirmRecipient: 'claims@airline.example',
    });
    expect(out.via).toBe('mailto');
    expect(out.mailto).toMatch(/^mailto:claims%40airline\.example\?subject=/);
    expect(out.claim.status).toBe('DraftReady');
    expect((await markSent(u._id, claim._id)).status).toBe('Sent');
  });
  it('demo accounts can only send to the demo inbox', async () => {
    const demo = await createUser(config, { isDemo: true });
    const { c } = await owedCase({ user: demo });
    const claim = await createDraft(config, demo._id, c._id);
    expect(claim.recipientEmail).toBe('demo-inbox@example.com');
    await expect(
      setRecipient(config, demo._id, claim._id, 'claims@airline.example'),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    const t = jsonTransport();
    await sendClaim(
      config,
      demo._id,
      claim._id,
      { confirmRecipient: 'demo-inbox@example.com' },
      { transport: t },
    );
    expect(t.sent[0].to).toBe('demo-inbox@example.com');
  });
  it('edits only drafts', async () => {
    const { u, c } = await owedCase();
    const claim = await createDraft(config, u._id, c._id);
    expect((await editDraft(u._id, claim._id, { draftText: 'hello' })).draftText).toBe('hello');
  });
});

describe('invariant 5: one claim per flight per user', () => {
  it('second case for the same flight + date is refused', async () => {
    const { u } = await owedCase();
    await expect(
      addFlightCase(u._id, { flightNumber: 'ba 75', date: '2026-11-20' }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_CLAIM' });
  });
  it('parallel drafts create one claim', async () => {
    const { u, c } = await owedCase();
    await Promise.allSettled([1, 2, 3, 4].map(() => createDraft(config, u._id, c._id)));
    expect(await Claim.countDocuments({ caseId: c._id })).toBe(1);
  });
});

describe('proof page', () => {
  it('shows facts and receipts, never the email or booking reference', async () => {
    const { c, r1 } = await owedCase();
    const p = await getProof(c.publicId);
    expect(p.receipts.map((r) => r.receiptHash)).toContain(r1.receiptHash);
    expect(p.facts[0].receiptHashes).toHaveLength(2);
    expect(p.receipts[0].verifyUrl).toMatch(/\/v1\/blocks\/40\/deliveries\/0x/);
    const s = JSON.stringify(p);
    expect(s).not.toContain('ada@example.com');
    expect(s).not.toContain('XYZ123');
  });
});
