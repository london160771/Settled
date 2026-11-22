# 01 — Wallet seed and Sepolia ETH (for Gate 0)

**What and why:** Settled pays Telegraph from wallets it derives from one secret seed (`MASTER_MNEMONIC`). The first wallet (the "operator") needs a little Sepolia ETH so it can mint test USDC and load it into users' Telegraph escrow. Without these, no real paid ask can happen.

Network access is already fine: the cloud session reached `devnode.telegraphprotocol.com`, the Sepolia RPC, `api.telegram.org`, npm and the MongoDB binary host. Nothing to change there.

## Steps

1. Make a **new, testnet-only** seed phrase (12 words). Never use a wallet that holds real money. Easiest way: in MetaMask (or Rabby), choose "Create a new wallet" and write down the 12 words.
2. In that wallet, copy the address of **Account 1**. This is the Settled operator address (HD index 0, path `m/44'/60'/0'/0/0`).
3. Send **0.05 Sepolia ETH** to that address. Use any Sepolia faucet (for example Google Cloud Web3 faucet, Alchemy or Infura Sepolia faucet). You do not need test USDC: Settled mints it itself (the test token has a public mint).
4. Open [Project settings](#project-settings/environment) → Cloud environment → the gear next to the selected environment.
5. Add an environment variable named `MASTER_MNEMONIC` with the 12 words, separated by single spaces, no quotes.
6. (Optional) Add `SEPOLIA_RPC_URL` if you want your own RPC (Alchemy/Infura). If you skip it, the public `https://ethereum-sepolia-rpc.publicnode.com` is used.
7. Save. A **new** session picks up the variable.

## How to check it worked

- On https://sepolia.etherscan.io, search the Account 1 address: it should show the ETH you sent.
- In the new session the agent runs `node server/scripts/gate0.js`. It prints the operator address (must match your Account 1), funds a test user with 0.50 test USDC, makes 3 small paid asks (about 0.03 test USDC) and saves receipts to `evidence/gate0/`.

## What to tell the agent when done

Start a new session on this repo (same branch, `claude/project-thread-00viqq`) and say:

```
MASTER_MNEMONIC is set and the operator has Sepolia ETH. Done, continue from PROJECT_STATE.md (finish Phase 1 Gate 0, then carry on).
```
