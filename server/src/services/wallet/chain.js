// On-chain helpers for Ethereum Sepolia: balances, test USDC mint, escrow funding.
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';

export const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function mint(address,uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
]);
export const DIAMOND_ABI = parseAbi(['function depositUSDCFor(address,uint256)']);

export function publicClient(rpcUrl) {
  return createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
}

export async function getBalances({ rpcUrl, usdc, address }) {
  const pc = publicClient(rpcUrl);
  const [eth, usdcBal] = await Promise.all([
    pc.getBalance({ address }),
    pc.readContract({ address: usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }),
  ]);
  return { ethWei: eth, usdcUusdc: usdcBal };
}

// Operator funds a user's Telegraph escrow: mint test USDC to itself (public mint on the
// test token), approve the Diamond, then depositUSDCFor(user). Needs Sepolia ETH for gas.
export async function fundEscrowFor({ rpcUrl, usdc, diamond, operator, beneficiary, amountUusdc }) {
  const pc = publicClient(rpcUrl);
  const wc = createWalletClient({ account: operator, chain: sepolia, transport: http(rpcUrl) });
  const amount = BigInt(amountUusdc);
  const bal = await pc.readContract({
    address: usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [operator.address],
  });
  const txs = {};
  if (bal < amount) {
    txs.mint = await wc.writeContract({
      address: usdc,
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [operator.address, amount * 10n],
    });
    await pc.waitForTransactionReceipt({ hash: txs.mint });
  }
  const allowance = await pc.readContract({
    address: usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [operator.address, diamond],
  });
  if (allowance < amount) {
    txs.approve = await wc.writeContract({
      address: usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [diamond, amount * 10n],
    });
    await pc.waitForTransactionReceipt({ hash: txs.approve });
  }
  txs.deposit = await wc.writeContract({
    address: diamond,
    abi: DIAMOND_ABI,
    functionName: 'depositUSDCFor',
    args: [beneficiary, amount],
  });
  await pc.waitForTransactionReceipt({ hash: txs.deposit });
  return txs;
}
