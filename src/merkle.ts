import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import fs from "fs";
import path from "path";

const TREE_PATH = path.resolve(__dirname, "../data/merkle-tree.json");

let cachedTree: StandardMerkleTree<string[]> | null = null;

export function getMerkleTree(): StandardMerkleTree<string[]> {
  if (cachedTree) return cachedTree;

  if (!fs.existsSync(TREE_PATH)) {
    throw new Error("Merkle tree file not found. Run generate-merkle script first.");
  }

  const raw = JSON.parse(fs.readFileSync(TREE_PATH, "utf-8"));
  cachedTree = StandardMerkleTree.load(raw);
  return cachedTree;
}

export function reloadTree(): void {
  cachedTree = null;
}

export function getProofForAddress(
  address: string
): { amount: string; proof: string[] } | null {
  const tree = getMerkleTree();
  for (const [i, v] of tree.entries()) {
    if (v[0].toLowerCase() === address.toLowerCase()) {
      return {
        amount: v[1],
        proof: tree.getProof(i),
      };
    }
  }
  return null;
}

export function getAllEntries(): { address: string; amount: string }[] {
  const tree = getMerkleTree();
  const entries: { address: string; amount: string }[] = [];
  for (const [, v] of tree.entries()) {
    entries.push({ address: v[0], amount: v[1] });
  }
  return entries;
}
