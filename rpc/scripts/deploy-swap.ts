import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying swap contracts with account:", deployer.address);

  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
  if (!TOKEN_ADDRESS) throw new Error("TOKEN_ADDRESS not set in .env");

  // ── 1. Deploy MockUSDT ──────────────────────────────────────────────
  const USDTFactory = await ethers.getContractFactory("MockUSDT");
  const usdt = await USDTFactory.deploy();
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log("MockUSDT deployed to:", usdtAddress);

  // ── 2. Deploy TokenSwap ─────────────────────────────────────────────
  // Rate: 500_000 = 0.50 USDT per 1 ADRP token
  const SWAP_RATE = 500_000; // 0.50 USDT (6 decimals)

  const SwapFactory = await ethers.getContractFactory("TokenSwap");
  const swap = await SwapFactory.deploy(TOKEN_ADDRESS, usdtAddress, SWAP_RATE);
  await swap.waitForDeployment();
  const swapAddress = await swap.getAddress();
  console.log("TokenSwap deployed to:", swapAddress);

  // ── 3. Fund the Swap contract with USDT ─────────────────────────────
  const fundAmount = 10_000_000n * 10n ** 6n; // 10 M USDT
  const fundTx = await usdt.transfer(swapAddress, fundAmount);
  await fundTx.wait();
  console.log("Transferred 10,000,000 USDT to Swap contract");

  // ── 4. Output ───────────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("  Swap Deployment Summary");
  console.log("========================================");
  console.log(`  MockUSDT:  ${usdtAddress}`);
  console.log(`  TokenSwap: ${swapAddress}`);
  console.log(`  Rate:      1 ADRP = 0.50 USDT`);
  console.log("========================================\n");
  console.log("Add these to your .env:");
  console.log(`USDT_ADDRESS=${usdtAddress}`);
  console.log(`SWAP_ADDRESS=${swapAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
