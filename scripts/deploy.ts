import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // ── 1. Deploy AirdropToken ──────────────────────────────────────────
  const tokenName = "AirdropToken";
  const tokenSymbol = "ADRP";
  const initialMint = ethers.parseEther("100000000"); // 100 M tokens

  const TokenFactory = await ethers.getContractFactory("AirdropToken");
  const token = await TokenFactory.deploy(tokenName, tokenSymbol, initialMint);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("AirdropToken deployed to:", tokenAddress);

  // ── 2. Deploy TokenAirdrop ──────────────────────────────────────────
  const AirdropFactory = await ethers.getContractFactory("TokenAirdrop");
  const airdrop = await AirdropFactory.deploy(tokenAddress);
  await airdrop.waitForDeployment();
  const airdropAddress = await airdrop.getAddress();
  console.log("TokenAirdrop deployed to:", airdropAddress);

  // ── 3. Fund the Airdrop contract with tokens ───────────────────────
  const fundAmount = ethers.parseEther("50000000"); // 50 M tokens for airdrop
  const tx = await token.transfer(airdropAddress, fundAmount);
  await tx.wait();
  console.log(`Transferred ${ethers.formatEther(fundAmount)} tokens to Airdrop contract`);

  // ── 4. Output deployment info ──────────────────────────────────────
  console.log("\n========================================");
  console.log("  Deployment Summary");
  console.log("========================================");
  console.log(`  Token:   ${tokenAddress}`);
  console.log(`  Airdrop: ${airdropAddress}`);
  console.log("========================================\n");
  console.log("Add these to your .env:");
  console.log(`TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`AIRDROP_ADDRESS=${airdropAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
