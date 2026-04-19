import { ethers } from "hardhat";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import * as fs from "fs";
import * as path from "path";

/**
 * Generates a Merkle tree from an airdrop list and starts the airdrop.
 *
 * Usage:  npx hardhat run scripts/generate-merkle.ts --network localhost
 *
 * Reads:  data/airdrop-list.json   — array of [address, amountInEther]
 * Writes: data/merkle-tree.json    — full tree for proof generation
 */
async function main() {
  const dataDir = path.join(__dirname, "..", "data");
  const listPath = path.join(dataDir, "airdrop-list.json");

  if (!fs.existsSync(listPath)) {
    console.log("Creating sample airdrop-list.json …");
    fs.mkdirSync(dataDir, { recursive: true });

    const [, ...accounts] = await ethers.getSigners(); // skip deployer
    const sample = accounts.slice(0, 5).map((a) => [
      a.address,
      "1000", // 1 000 tokens each
    ]);
    fs.writeFileSync(listPath, JSON.stringify(sample, null, 2));
    console.log(`Wrote ${sample.length} entries to ${listPath}`);
  }

  // Read the list
  const rawList: [string, string][] = JSON.parse(
    fs.readFileSync(listPath, "utf-8")
  );

  // Build values array: [address, amountWei]
  const values = rawList.map(([addr, amt]) => [
    addr,
    ethers.parseEther(amt).toString(),
  ]);

  // Build Merkle tree (OpenZeppelin standard)
  const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
  console.log("Merkle Root:", tree.root);

  // Save tree
  const treePath = path.join(dataDir, "merkle-tree.json");
  fs.writeFileSync(treePath, JSON.stringify(tree.dump(), null, 2));
  console.log(`Tree saved to ${treePath}`);

  // Optionally set root on-chain
  const airdropAddr = process.env.AIRDROP_ADDRESS;
  if (airdropAddr) {
    const airdrop = await ethers.getContractAt("TokenAirdrop", airdropAddr);
    const tx = await airdrop.startAirdrop(
      tree.root,
      60 * 60 * 24 * 30 // 30-day claim window
    );
    await tx.wait();
    console.log("Airdrop started on-chain with 30-day window.");
  } else {
    console.log("Set AIRDROP_ADDRESS in .env to auto-start the airdrop.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
