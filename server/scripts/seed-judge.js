// Create a seeded judge/demo account (funded 0.50 test USDC, seeded flight case) and print
// a one-time web login link. Usage: node server/scripts/seed-judge.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { loadConfig } from '../src/config/index.js';
import { connectDb } from '../src/db.js';
import { judgeSession } from '../src/services/judge.js';
import { createLinkCode } from '../src/services/auth.js';

const config = loadConfig();
await connectDb(config.mongoUri);
const out = await judgeSession(config, null);
const code = await createLinkCode(out.user._id, 'weblogin');
console.log(`Demo account ${out.user._id} created. Seeded case ${out.caseId}.`);
console.log(
  `Funding: ${out.funding?.error ? `not funded (${out.funding.error})` : `${(out.funding.amountUusdc / 1e6).toFixed(2)} test USDC to ${out.funding.address}`}`,
);
console.log(`Sign in (one use, 10 min): ${config.appUrl}/api/auth/link/${code}`);
await mongoose.disconnect();
