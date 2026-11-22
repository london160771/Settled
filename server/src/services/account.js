// Wallet page + settings data.
import { User, Wallet, Receipt } from '../models/index.js';
import { AppError } from '../errors.js';
import { getBudget } from './budget/index.js';
import { ensureWallet, getEscrowBalance, topUp } from './wallet/index.js';
import { getDiamondAddress } from './wallet/diamond.js';

export const TOPUP_UUSDC = 1000000;
export const DEMO_TOPUP_UUSDC = 500000;
export const TOPUP_ONLY_BELOW_UUSDC = 200000;

export async function walletView(config, userId, deps = {}) {
  const w = await ensureWallet(config, userId);
  let escrow = null;
  let escrowError = null;
  try {
    escrow = await getEscrowBalance(config, w.address, deps.fetchImpl);
  } catch (e) {
    escrowError = e.message;
  }
  return {
    address: w.address,
    network: 'Ethereum Sepolia (testnet)',
    custody: 'custodial-testnet',
    explorerUrl: `https://sepolia.etherscan.io/address/${w.address}`,
    escrow,
    escrowError,
    budget: await getBudget(userId),
    fundedUusdc: w.fundedUusdc,
  };
}

export async function requestTopUp(config, userId, deps = {}) {
  const user = await User.findById(userId).lean();
  const w = await ensureWallet(config, userId);
  const bal = await getEscrowBalance(config, w.address, deps.fetchImpl);
  if (bal.availableUusdc >= TOPUP_ONLY_BELOW_UUSDC) {
    throw new AppError(
      'BAD_REQUEST',
      'Your wallet still has enough test USDC. Top-up is for empty wallets.',
    );
  }
  const diamond = deps.diamond || (await getDiamondAddress(config, deps.fetchImpl));
  return topUp(config, userId, user.isDemo ? DEMO_TOPUP_UUSDC : TOPUP_UUSDC, {
    diamond,
    fund: deps.fund,
  });
}

export async function updateSettings(userId, body) {
  const set = {};
  if (typeof body.displayName === 'string') set.displayName = body.displayName.trim().slice(0, 60);
  if (typeof body.claimFromName === 'string')
    set.claimFromName = body.claimFromName.trim().slice(0, 80);
  if (typeof body.leaderboardOptIn === 'boolean') set.leaderboardOptIn = body.leaderboardOptIn;
  for (const k of ['decisionCapUusdc', 'monthlyCapUusdc']) {
    if (body[k] == null) continue;
    const v = Number(body[k]);
    if (!Number.isInteger(v) || v < 10000 || v > 100000000)
      throw new AppError(
        'BAD_REQUEST',
        `${k} must be an integer between 10000 and 100000000 uusdc.`,
      );
    set[`caps.${k}`] = v;
  }
  if (set['caps.decisionCapUusdc'] && set['caps.decisionCapUusdc'] > 260000) {
    throw new AppError(
      'BAD_REQUEST',
      'Per-decision cap cannot exceed 260000 uusdc (0.26) on testnet.',
    );
  }
  return User.findByIdAndUpdate(userId, { $set: set }, { returnDocument: 'after' });
}

export const listReceipts = (userId) =>
  Receipt.find({ userId }).sort({ createdAt: -1 }).limit(200).lean();
export const walletOf = (userId) => Wallet.findOne({ userId }).lean();
