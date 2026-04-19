import { Router, Request, Response } from "express";
import { getTokenContract } from "../contracts";
import { ethers } from "ethers";

export const tokenRouter = Router();

/**
 * GET /api/token/info
 * Returns basic token metadata from the chain.
 */
tokenRouter.get("/info", async (_req: Request, res: Response) => {
  try {
    const token = getTokenContract();
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      token.name(),
      token.symbol(),
      token.decimals(),
      token.totalSupply(),
    ]);

    res.json({
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: ethers.formatEther(totalSupply),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/token/balance/:address
 * Returns the token balance for a wallet address.
 */
tokenRouter.get("/balance/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      res.status(400).json({ error: "Invalid Ethereum address" });
      return;
    }
    const token = getTokenContract();
    const balance = await token.balanceOf(address);
    res.json({
      address,
      balance: ethers.formatEther(balance),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
