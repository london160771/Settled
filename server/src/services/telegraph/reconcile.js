// Compare our Receipts with the Telegraph ledger, per wallet.
// Ledger billed = charged (in roots) + unbilled (not yet in a root).
// Escrow failures are never billed by the node, so charged_on_failure receipts that the ledger
// does not show can be marked `reconciled` and their cost given back to the user's budget.
import { Receipt, Wallet, User } from '../../models/index.js';
import { getEscrowBalance } from '../wallet/index.js';

export async function reconcileWallet(config, wallet, { apply = false, fetchImpl = fetch } = {}) {
  const ledger = await getEscrowBalance(config, wallet.address, fetchImpl);
  const receipts = await Receipt.find({ userId: wallet.userId, replayed: { $ne: true } }).lean();
  const settled = receipts
    .filter((r) => r.status === 'settled')
    .reduce((s, r) => s + r.costUusdc, 0);
  const cof = receipts.filter((r) => r.status === 'charged_on_failure');
  const cofTotal = cof.reduce((s, r) => s + r.costUusdc, 0);
  const ledgerBilled = ledger.chargedUusdc + ledger.unbilledUusdc;
  const ours = settled + cofTotal;
  const report = {
    address: wallet.address,
    oursSettledUusdc: settled,
    oursChargedOnFailureUusdc: cofTotal,
    ledgerBilledUusdc: ledgerBilled,
    differenceUusdc: ours - ledgerBilled,
    reconciled: [],
  };
  // Only when the ledger shows we were billed exactly the settled asks: the failures were free.
  if (apply && cof.length && ledgerBilled === settled) {
    const user = await User.findById(wallet.userId);
    for (const r of cof) {
      const done = await Receipt.updateOne(
        { _id: r._id, status: 'charged_on_failure' },
        { $set: { status: 'reconciled' } },
      );
      if (done.modifiedCount && user.budget.month === r.createdAt.toISOString().slice(0, 7)) {
        await User.updateOne({ _id: user._id }, { $inc: { 'budget.spentUusdc': -r.costUusdc } });
      }
      report.reconciled.push(r._id.toString());
    }
  }
  return report;
}

export async function reconcileAll(config, opts) {
  const wallets = await Wallet.find().lean();
  const out = [];
  for (const w of wallets) out.push(await reconcileWallet(config, w, opts));
  return out;
}
