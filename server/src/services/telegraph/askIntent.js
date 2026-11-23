// The ONE function that calls Telegraph (PRD §7). Everything else goes through here.
// reserve → ask → parse receipt → settle or mark charged → store Receipt → release unused.
import { randomUUID } from 'node:crypto';
import { Receipt } from '../../models/index.js';
import { AppError } from '../../errors.js';
import { reserve, settle, release } from '../budget/index.js';
import { signerFor } from '../wallet/index.js';
import { paidAsk, TelegraphHttpError } from './http.js';
import { getIntentSchema } from './intents.js';

export const MIN_BUDGET_UUSDC = 10000;
export const MAX_BUDGET_UUSDC = 260000;

function chargedFrom(body, receipt, quoted) {
  const rows = body?.fulfillment?.payments;
  if (Array.isArray(rows) && rows.length)
    return rows.reduce((s, p) => s + Number(p.amount_uusdc || 0), 0);
  if (receipt?.amount_uusdc != null && Number(receipt.amount_uusdc) > 0)
    return Number(receipt.amount_uusdc);
  // No receipt header (seen live on QUESTION_ANSWERING_GENERAL, which the ledger still billed):
  // count the quoted price, never 0. Reconcile corrects it against the ledger later.
  return quoted;
}

function receiptDoc({
  userId,
  caseId,
  askId,
  intent,
  body,
  receipt,
  costUusdc,
  status,
  httpStatus,
}) {
  return {
    userId,
    caseId,
    askId,
    intent: body?.intent || receipt?.intent || intent,
    minerId: body?.miner_id ?? receipt?.miner ?? null,
    minerName: body?.miner_name ?? null,
    costUusdc,
    durationMs: body?.duration_ms ?? null,
    receiptHash: receipt?.receipt_hash || undefined,
    txHash: receipt?.tx_hash || null,
    epochId: receipt?.epoch_id ?? null,
    chain: receipt?.chain || null,
    rail: receipt?.rail || 'escrow',
    signalHash: body?.signal_hash || null,
    result: body?.result ?? null,
    fieldStatus: body?.field_status ?? null,
    httpStatus,
    status,
  };
}

/**
 * @returns {{ receipt, result, body, askId, extraReceipts }}
 */
export async function askIntent({
  config,
  userId,
  caseId = null,
  intent,
  params,
  query,
  budgetUusdc = MIN_BUDGET_UUSDC,
  minerId = null,
  decisionKey = null,
  retryOnce = true,
  deps = {},
}) {
  const fetchImpl = deps.fetchImpl || fetch;
  if (
    !Number.isInteger(budgetUusdc) ||
    budgetUusdc < MIN_BUDGET_UUSDC ||
    budgetUusdc > MAX_BUDGET_UUSDC
  ) {
    throw new AppError(
      'BAD_REQUEST',
      `max_budget_usdc must be ${MIN_BUDGET_UUSDC}-${MAX_BUDGET_UUSDC} uusdc`,
    );
  }
  await getIntentSchema(config.telegraphBaseUrl, intent, fetchImpl);
  const account = deps.signer || (await signerFor(config, userId));
  const body = { intent };
  if (params) body.params = params;
  if (query) body.query = query;
  // A direct ask names its miner, so it gets no budget (Telegraph docs); routed asks always do.
  if (!minerId) body.max_budget_usdc = budgetUusdc;
  const path = minerId ? `/engine/v1/ask/${encodeURIComponent(minerId)}` : '/engine/v1/ask';

  let attempts = 0;
  for (;;) {
    attempts += 1;
    const askId = randomUUID();
    const reservation = await reserve({ userId, amountUusdc: budgetUusdc, decisionKey, askId });
    let r;
    try {
      r = await paidAsk({
        baseUrl: config.telegraphBaseUrl,
        path,
        body,
        account,
        fetchImpl,
        maxPaymentUusdc: budgetUusdc,
      });
    } catch (err) {
      await release(reservation._id);
      if (err instanceof TelegraphHttpError) throw new AppError('MINER_UNAVAILABLE', err.message);
      throw new AppError('MINER_UNAVAILABLE', `Telegraph unreachable: ${err.message}`);
    }

    if (r.status === 200) {
      const charged = Math.min(chargedFrom(r.body, r.receipt, r.quotedUusdc), budgetUusdc);
      await settle(reservation._id, charged);
      const rows = r.body?.fulfillment?.payments || [];
      const firstCost = rows.length
        ? Math.min(Number(rows[0].amount_uusdc || 0), charged)
        : charged;
      const main = await Receipt.create(
        receiptDoc({
          userId,
          caseId,
          askId,
          intent,
          body: r.body,
          receipt: r.receipt,
          costUusdc: firstCost,
          status: 'settled',
          httpStatus: 200,
        }),
      );
      // Extra paid rows of a multi-miner ask, keyed on their own receipt_hash.
      const extra = [];
      for (const p of rows.slice(1)) {
        if (!p.receipt_hash || p.receipt_hash === main.receiptHash) continue;
        extra.push(
          await Receipt.create({
            userId,
            caseId,
            askId,
            intent: p.intent || intent,
            minerId: p.miner,
            costUusdc: Number(p.amount_uusdc || 0),
            receiptHash: p.receipt_hash,
            rail: 'escrow',
            status: 'settled',
            httpStatus: 200,
          }),
        );
      }
      return {
        receipt: main,
        extraReceipts: extra,
        result: r.body?.result ?? null,
        body: r.body,
        askId,
      };
    }

    if (!r.paid) {
      // Refused before payment: nothing charged.
      await release(reservation._id);
      const err = r.body?.error;
      if (err === 'no_input_schema')
        throw new AppError('INTENT_UNKNOWN', r.body.message || 'Unknown intent');
      if (err === 'no_compatible_miner' || r.status === 503 || r.status === 429) {
        throw new AppError('MINER_UNAVAILABLE', r.body?.message || err || `HTTP ${r.status}`);
      }
      throw new AppError('BAD_REQUEST', r.body?.message || err || `HTTP ${r.status}`, {
        problems: r.body?.problems,
      });
    }

    if (r.status === 402) {
      // Payment refused (e.g. insufficient escrow). Not charged.
      await release(reservation._id);
      throw new AppError('WALLET_UNFUNDED', r.body?.reason || 'Escrow balance too low');
    }
    if (r.status === 422 || r.status === 400) {
      await release(reservation._id);
      throw new AppError('BAD_REQUEST', r.body?.error || `HTTP ${r.status}`);
    }

    // Bug #228: a paid ask that failed (5xx / network) may still charge. Count it as spent.
    await settle(reservation._id, r.quotedUusdc);
    await Receipt.create(
      receiptDoc({
        userId,
        caseId,
        askId,
        intent,
        body: r.body,
        receipt: r.receipt,
        costUusdc: r.quotedUusdc,
        status: 'charged_on_failure',
        httpStatus: r.status,
      }),
    );
    if (retryOnce && attempts < 2) continue; // retry at most once, never loop
    throw new AppError(
      'CHARGED_ON_FAILURE',
      `Paid ask failed (HTTP ${r.status}); counted as spent`,
      { askId, minerId: r.body?.miner_id },
    );
  }
}
