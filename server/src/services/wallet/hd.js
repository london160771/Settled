// HD wallet derivation. Keys are derived on demand from MASTER_MNEMONIC + index.
// Private keys are never stored or logged.
import { mnemonicToAccount } from 'viem/accounts';

export const OPERATOR_INDEX = 0;

export function deriveAccount(mnemonic, index) {
  if (!mnemonic) throw new Error('MASTER_MNEMONIC is not set');
  if (!Number.isInteger(index) || index < 0)
    throw new Error('hdIndex must be a non-negative integer');
  return mnemonicToAccount(mnemonic, { addressIndex: index });
}

export function deriveAddress(mnemonic, index) {
  return deriveAccount(mnemonic, index).address;
}
