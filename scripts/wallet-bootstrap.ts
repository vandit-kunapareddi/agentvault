/**
 * Generates a fresh wallet for the checkpoint to sign real x402 payments
 * with, and prints the address, private key, and the faucet URLs you'll
 * need to fund it on Base Sepolia.
 *
 * The script only prints — nothing is written to disk. Save the private
 * key into Railway's env vars yourself.
 *
 *   npm run wallet:bootstrap
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const key = generatePrivateKey();
const account = privateKeyToAccount(key);

const bar = "=".repeat(60);
console.log(`\n${bar}`);
console.log("AgentVault wallet bootstrap");
console.log(`${bar}\n`);
console.log(`Address:      ${account.address}`);
console.log(`Private key:  ${key}\n`);
console.log("Save the private key somewhere safe — it's the only way to");
console.log("control this wallet. Anyone with it controls the funds.\n");
console.log("Fund the address with Base Sepolia testnet tokens:");
console.log("  ETH (for gas)");
console.log("    https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
console.log("  USDC");
console.log("    https://faucet.circle.com  (select Base Sepolia)\n");
console.log("Then in the Railway checkpoint service, add the env var:");
console.log(`  WALLET_PRIVATE_KEY=${key}\n`);
console.log(
  "Once Railway redeploys, the x402 handler will start signing real",
);
console.log(
  "payments with this key instead of returning a mock receipt.\n",
);
