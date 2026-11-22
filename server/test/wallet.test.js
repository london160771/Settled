import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startDb, stopDb, clearDb, testConfig, TEST_MNEMONIC } from './helpers.js';
import { createUser } from '../src/services/users.js';
import { ensureWallet, signerFor, topUp } from '../src/services/wallet/index.js';
import { deriveAddress } from '../src/services/wallet/hd.js';

const config = testConfig();
beforeAll(startDb, 120000);
afterAll(stopDb);
beforeEach(clearDb);

describe('wallets', () => {
  it('derives distinct addresses per user, never index 0 or 1, and stores no key', async () => {
    const a = await ensureWallet(config, (await createUser(config))._id);
    const b = await ensureWallet(config, (await createUser(config))._id);
    expect(a.address).not.toBe(b.address);
    expect(a.hdIndex).toBeGreaterThan(1);
    expect(a.address).toBe(deriveAddress(TEST_MNEMONIC, a.hdIndex));
    expect(JSON.stringify(a.toObject())).not.toMatch(/privateKey|mnemonic/i);
  });
  it('is idempotent and the signer matches the address', async () => {
    const u = await createUser(config);
    const w1 = await ensureWallet(config, u._id);
    const w2 = await ensureWallet(config, u._id);
    expect(w1.address).toBe(w2.address);
    expect((await signerFor(config, u._id)).address).toBe(w1.address);
  });
  it('top-up funds the user escrow from the operator (index 0)', async () => {
    const u = await createUser(config);
    let call;
    const out = await topUp(config, u._id, 500000, {
      diamond: '0x72a70e949362670bf8bcead24efc5b8f950aa08b',
      fund: async (args) => ((call = args), { deposit: '0xabc' }),
    });
    expect(call.operator.address).toBe(deriveAddress(TEST_MNEMONIC, 0));
    expect(call.beneficiary).toBe(out.address);
    expect(call.amountUusdc).toBe(500000);
  });
  it('fails clearly without MASTER_MNEMONIC', async () => {
    const cfg = testConfig({ MASTER_MNEMONIC: '' });
    await expect(ensureWallet(cfg, (await createUser(cfg))._id)).rejects.toThrow(
      /MASTER_MNEMONIC is not set/,
    );
  });
});
