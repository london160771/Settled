// Per-user Settled wallets: HD-derived Ethereum Sepolia address + Telegraph escrow balance.
// Custodial on testnet (labelled in the UI). Keys derived on demand, never stored.
import { Wallet, Counter } from '../../models/index.js';
import { deriveAccount, deriveAddress, OPERATOR_INDEX } from './hd.js';
import { fundEscrowFor } from './chain.js';
import { requireVar } from '../../config/index.js';

async function nextIndex() {
  const c = await Counter.findOneAndUpdate(
    { _id: 'hdIndex' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return OPERATOR_INDEX + 1 + c.seq; // index 0 is the operator; the gate0 test user is 1
}

export async function ensureWallet(config, userId) {
  const existing = await Wallet.findOne({ userId });
  if (existing) return existing;
  const mnemonic = requireVar(config, 'masterMnemonic', 'MASTER_MNEMONIC');
  const hdIndex = await nextIndex();
  return Wallet.create({ userId, hdIndex, address: deriveAddress(mnemonic, hdIndex) });
}

export async function signerFor(config, userId) {
  const w = await Wallet.findOne({ userId }).lean();
  if (!w) throw new Error('wallet not found');
  return deriveAccount(requireVar(config, 'masterMnemonic', 'MASTER_MNEMONIC'), w.hdIndex);
}

// Escrow balance from the Telegraph ledger (what asks may spend).
export async function getEscrowBalance(config, address, fetchImpl = fetch) {
  const res = await fetchImpl(`${config.telegraphBaseUrl}/v1/ledger/account/${address}`);
  if (!res.ok) throw new Error(`ledger ${res.status}`);
  const b = await res.json();
  return {
    availableUusdc: Number(b.available),
    depositedUusdc: Number(b.deposited),
    chargedUusdc: Number(b.charged),
    creditedUusdc: Number(b.credited),
    unbilledUusdc: Number(b.unbilled),
  };
}

// Testnet top-up: operator mints test USDC and deposits it into the user's escrow.
export async function topUp(config, userId, amountUusdc, { diamond, fund = fundEscrowFor } = {}) {
  const w = await ensureWallet(config, userId);
  const operator = deriveAccount(
    requireVar(config, 'masterMnemonic', 'MASTER_MNEMONIC'),
    OPERATOR_INDEX,
  );
  const txs = await fund({
    rpcUrl: config.sepoliaRpcUrl,
    usdc: config.testUsdcAddress,
    diamond,
    operator,
    beneficiary: w.address,
    amountUusdc,
  });
  await Wallet.updateOne({ _id: w._id }, { $inc: { fundedUusdc: amountUusdc } });
  return { address: w.address, amountUusdc, txs };
}
