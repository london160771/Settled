// Usage: node server/scripts/reconcile.js [--apply]
// Prints, per wallet, our receipts total vs the Telegraph ledger and the difference.
// --apply marks charged_on_failure receipts as reconciled when the ledger shows they were not billed.
import 'dotenv/config';
import mongoose from 'mongoose';
import { loadConfig } from '../src/config/index.js';
import { connectDb } from '../src/db.js';
import { reconcileAll } from '../src/services/telegraph/reconcile.js';

const config = loadConfig();
await connectDb(config.mongoUri);
const rows = await reconcileAll(config, { apply: process.argv.includes('--apply') });
for (const r of rows) {
  const flag = r.differenceUusdc === 0 ? 'OK ' : 'DIFF';
  console.log(
    `${flag} ${r.address} ours=${r.oursSettledUusdc}+${r.oursChargedOnFailureUusdc}(failed) ledger=${r.ledgerBilledUusdc} diff=${r.differenceUusdc}${r.reconciled.length ? ` reconciled=${r.reconciled.length}` : ''}`,
  );
}
if (!rows.length) console.log('No wallets yet.');
await mongoose.disconnect();
