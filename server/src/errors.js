// Stable reason codes (PRD §5). Shape: { code, message, retryable, nextAction }.
export const REASONS = {
  CAP_EXCEEDED: {
    status: 402,
    retryable: false,
    nextAction: 'Raise your monthly cap or wait for next month.',
  },
  DECISION_CAP_EXCEEDED: {
    status: 402,
    retryable: false,
    nextAction: 'Raise your per-decision cap.',
  },
  DUPLICATE_CLAIM: { status: 409, retryable: false, nextAction: 'Open the existing case instead.' },
  EVIDENCE_CONFLICT: {
    status: 422,
    retryable: true,
    nextAction: 'Check again later for fresh evidence.',
  },
  NEEDS_MORE_PROOF: { status: 422, retryable: true, nextAction: 'Check again later.' },
  UNTRUSTED_INSTRUCTION: {
    status: 422,
    retryable: false,
    nextAction: 'Instructions inside emails are ignored. Review the case yourself.',
  },
  CHARGED_ON_FAILURE: {
    status: 502,
    retryable: true,
    nextAction: 'Counted as spent until reconciled with the Telegraph ledger.',
  },
  MINER_UNAVAILABLE: { status: 503, retryable: true, nextAction: 'Try again in a minute.' },
  INTENT_UNKNOWN: {
    status: 400,
    retryable: false,
    nextAction: 'Use an Intent listed by the node.',
  },
  NOT_ELIGIBLE: {
    status: 422,
    retryable: false,
    nextAction: 'No claim can be made for this case.',
  },
  RECIPIENT_NOT_CONFIRMED: {
    status: 409,
    retryable: false,
    nextAction: 'Confirm the recipient address first.',
  },
  WALLET_UNFUNDED: { status: 402, retryable: true, nextAction: 'Top up your Settled wallet.' },
  BAD_REQUEST: { status: 400, retryable: false, nextAction: 'Fix the request and try again.' },
  UNAUTHORIZED: { status: 401, retryable: false, nextAction: 'Sign in.' },
  NOT_FOUND: { status: 404, retryable: false, nextAction: 'Check the link.' },
  RATE_LIMITED: { status: 429, retryable: true, nextAction: 'Slow down and try again.' },
  LIMIT_REACHED: { status: 429, retryable: true, nextAction: 'Try again tomorrow.' },
};

export class AppError extends Error {
  constructor(code, message, extra = {}) {
    super(message || code);
    const r = REASONS[code] || { status: 500, retryable: false, nextAction: '' };
    this.code = code;
    this.status = r.status;
    this.retryable = r.retryable;
    this.nextAction = r.nextAction;
    this.extra = extra;
  }
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      nextAction: this.nextAction,
      ...this.extra,
    };
  }
}
