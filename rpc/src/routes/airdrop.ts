import { Router, Request, Response } from "express";
import { getAirdropContract } from "../contracts";
import { getProofForAddress, getAllEntries } from "../merkle";
import { ethers } from "ethers";

export const airdropRouter = Router();

/**
 * GET /api/airdrop/status
 * Returns on-chain airdrop status.
 */
airdropRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const contract = getAirdropContract();
    const [active, deadline, totalClaimed, balance, root] = await Promise.all([
      contract.airdropActive(),
      contract.claimDeadline(),
      contract.totalClaimed(),
      contract.airdropBalance(),
      contract.merkleRoot(),
    ]);

    res.json({
      active,
      deadline: deadline.toString(),
      totalClaimed: ethers.formatEther(totalClaimed),
      balance: ethers.formatEther(balance),
      merkleRoot: root,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/airdrop/proof/:address
 * Returns the Merkle proof and amount for a given address.
 */
airdropRouter.get("/proof/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      res.status(400).json({ error: "Invalid Ethereum address" });
      return;
    }

    const result = getProofForAddress(address);
    if (!result) {
      res.json({ eligible: false });
      return;
    }

    // Check on-chain claim status
    const contract = getAirdropContract();
    const claimed = await contract.hasClaimed(address);

    res.json({
      eligible: true,
      claimed,
      amount: result.amount,
      amountFormatted: ethers.formatEther(result.amount),
      proof: result.proof,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/airdrop/entries
 * Returns all airdrop entries (for admin dashboard).
 */
airdropRouter.get("/entries", async (_req: Request, res: Response) => {
  try {
    const entries = getAllEntries();
    const formatted = entries.map((e) => ({
      address: e.address,
      amount: e.amount,
      amountFormatted: ethers.formatEther(e.amount),
    }));
    res.json({ count: formatted.length, entries: formatted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/airdrop/claimed/:address
 * Check if an address has already claimed.
 */
airdropRouter.get("/claimed/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      res.status(400).json({ error: "Invalid Ethereum address" });
      return;
    }
    const contract = getAirdropContract();
    const claimed = await contract.hasClaimed(address);
    res.json({ address, claimed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
