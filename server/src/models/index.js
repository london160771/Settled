// Mongoose models (PRD §6). Money is integer micro-USDC (uusdc).
import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;
const uusdc = { type: Number, default: 0, validate: Number.isInteger };
const def = (name, schema) => models[name] || model(name, schema);

export const CASE_STATUSES = [
  'Watching',
  'CheckingProof',
  'Owed',
  'NotOwed',
  'NeedsMoreProof',
  'EvidenceConflict',
  'DraftReady',
  'Sent',
  'Paid',
  'Rejected',
];

const UserSchema = new Schema(
  {
    email: { type: String, lowercase: true, trim: true, index: { unique: true, sparse: true } },
    passwordHash: String,
    telegramId: { type: String, index: { unique: true, sparse: true } },
    displayName: { type: String, default: '' },
    claimFromName: { type: String, default: '' },
    leaderboardOptIn: { type: Boolean, default: false },
    caps: {
      decisionCapUusdc: { ...uusdc, required: true },
      monthlyCapUusdc: { ...uusdc, required: true },
    },
    // Budget counters, updated only by services/budget with conditional updates.
    budget: {
      month: { type: String, default: '' }, // YYYY-MM (UTC)
      spentUusdc: uusdc,
      reservedUusdc: uusdc,
    },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const WalletSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    address: { type: String, required: true, unique: true },
    hdIndex: { type: Number, required: true, unique: true },
    fundedUusdc: uusdc,
  },
  { timestamps: true },
);

const CounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });

const CaseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['flight', 'sla'], default: 'flight' },
    // SLA cases: vendor key, billing month YYYY-MM, the user's contract terms.
    vendor: String,
    period: String,
    promisedPct: Number,
    monthlyFeeUsd: Number,
    tiers: [{ _id: false, belowPct: Number, creditPct: Number }],
    flightNumber: { type: String, uppercase: true, trim: true },
    date: String, // YYYY-MM-DD
    from: { type: String, uppercase: true },
    to: { type: String, uppercase: true },
    bookingRef: String,
    status: { type: String, enum: CASE_STATUSES, default: 'Watching' },
    publicId: { type: String, unique: true, sparse: true },
    lastCheckedAt: Date,
    isReplayed: { type: Boolean, default: false },
  },
  { timestamps: true },
);
// Invariant 5: one claim per flight (or per vendor + month) per user.
CaseSchema.index(
  { userId: 1, type: 1, flightNumber: 1, date: 1 },
  { unique: true, partialFilterExpression: { type: 'flight' } },
);
CaseSchema.index(
  { userId: 1, type: 1, vendor: 1, period: 1 },
  { unique: true, partialFilterExpression: { type: 'sla' } },
);

const ReceiptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', index: true },
    askId: { type: String, required: true, index: true },
    intent: String,
    minerId: String,
    minerName: String,
    costUusdc: uusdc,
    durationMs: Number,
    receiptHash: { type: String, index: { unique: true, sparse: true } },
    txHash: String,
    epochId: Number,
    chain: String,
    rail: String,
    signalHash: String,
    result: Schema.Types.Mixed,
    fieldStatus: Schema.Types.Mixed,
    rawResultRef: String,
    httpStatus: Number,
    status: { type: String, enum: ['settled', 'charged_on_failure', 'reconciled'], required: true },
    replayed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const ReservationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    decisionKey: String,
    amountUusdc: { ...uusdc, required: true },
    settledUusdc: uusdc,
    state: { type: String, enum: ['held', 'settled', 'released'], default: 'held' },
    askId: String,
  },
  { timestamps: true },
);

// Per-decision spend bucket, so each decision's spend + reserved ≤ decisionCap atomically.
const DecisionBudgetSchema = new Schema({
  _id: String, // decisionKey
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  capUusdc: uusdc,
  usedUusdc: uusdc, // spent + reserved
});

const DecisionSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    outcome: { type: String, enum: ['Owed', 'NotOwed', 'NeedsMoreProof', 'EvidenceConflict'] },
    amountEur: Number,
    amountUsd: Number, // SLA service credit
    reasons: [String],
    warnings: [String],
    facts: Schema.Types.Mixed,
    factRefs: [{ fact: String, value: Schema.Types.Mixed, receiptIds: [Schema.Types.ObjectId] }],
    rulesVersion: String,
    spentUusdc: uusdc,
  },
  { timestamps: true },
);

const ClaimSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    decisionId: { type: Schema.Types.ObjectId, ref: 'Decision' },
    draftText: String,
    subject: String,
    recipientEmail: String,
    recipientConfirmedAt: Date,
    sentAt: Date,
    sentVia: { type: String, enum: ['smtp', 'mailto', null], default: null },
    paidAmountEur: Number,
    status: {
      type: String,
      enum: ['DraftReady', 'Sent', 'Paid', 'Rejected'],
      default: 'DraftReady',
    },
    proofUrl: String,
  },
  { timestamps: true },
);

const LinkCodeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    code: { type: String, required: true, unique: true },
    purpose: { type: String, enum: ['telegram', 'weblogin'], required: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: true },
);

const AskLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: String, // price | weather | search | ask
    question: String,
    intent: String,
    answer: Schema.Types.Mixed,
    receiptId: { type: Schema.Types.ObjectId, ref: 'Receipt' },
    costUusdc: uusdc,
    errorCode: String,
  },
  { timestamps: true },
);

export const User = def('User', UserSchema);
export const Wallet = def('Wallet', WalletSchema);
export const Counter = def('Counter', CounterSchema);
export const Case = def('Case', CaseSchema);
export const Receipt = def('Receipt', ReceiptSchema);
export const Reservation = def('Reservation', ReservationSchema);
export const DecisionBudget = def('DecisionBudget', DecisionBudgetSchema);
export const Decision = def('Decision', DecisionSchema);
export const Claim = def('Claim', ClaimSchema);
export const LinkCode = def('LinkCode', LinkCodeSchema);
export const AskLog = def('AskLog', AskLogSchema);
