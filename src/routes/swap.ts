import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { provider, ensureContractDeployed } from "../contracts";

export const swapRouter = Router();

const USDT_ADDRESS = process.env.USDT_ADDRESS || "";
const SWAP_ADDRESS = process.env.SWAP_ADDRESS || "";

const USDT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

const SWAP_ABI = [
  "function rate() view returns (uint256)",
  "function swapActive() view returns (bool)",
  "function usdtBalance() view returns (uint256)",
  "function adrpBalance() view returns (uint256)",
  "function getEstimate(uint256) view returns (uint256)",
];

function getSwapContract() {
  if (!SWAP_ADDRESS) throw new Error("SWAP_ADDRESS not set");
  return new ethers.Contract(SWAP_ADDRESS, SWAP_ABI, provider);
}

function getUsdtContract() {
  if (!USDT_ADDRESS) throw new Error("USDT_ADDRESS not set");
  return new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
}

/**
 * GET /api/swap/status
 * Returns swap contract status: rate, active, liquidity.
 */
swapRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const swap = getSwapContract();
    await ensureContractDeployed(SWAP_ADDRESS, "TokenSwap");
    const [rateRaw, active, usdtBal, adrpBal] = await Promise.all([
      swap.rate(),
      swap.swapActive(),
      swap.usdtBalance(),
      swap.adrpBalance(),
    ]);

    // rate is USDT micro-units per 1 ADRP, convert to human
    const rateFormatted = (Number(rateRaw) / 1e6).toFixed(6);

    res.json({
      active,
      rate: rateRaw.toString(),
      rateFormatted,
      usdtLiquidity: (Number(usdtBal) / 1e6).toFixed(2),
      adrpCollected: ethers.formatEther(adrpBal),
      swapAddress: SWAP_ADDRESS,
      usdtAddress: USDT_ADDRESS,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/swap/estimate/:amount
 * Preview USDT output for a given ADRP amount (in ether units).
 */
swapRouter.get("/estimate/:amount", async (req: Request, res: Response) => {
  try {
    const { amount } = req.params;
    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      res.status(400).json({ error: "Amount must be a positive number" });
      return;
    }

    const swap = getSwapContract();
    await ensureContractDeployed(SWAP_ADDRESS, "TokenSwap");
    const amountWei = ethers.parseEther(String(amount));
    const usdtOut = await swap.getEstimate(amountWei);

    res.json({
      adrpIn: amount,
      usdtOut: (Number(usdtOut) / 1e6).toFixed(6),
      usdtOutRaw: usdtOut.toString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/swap/usdt-balance/:address
 * Returns USDT balance for a given address.
 */
swapRouter.get("/usdt-balance/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      res.status(400).json({ error: "Invalid Ethereum address" });
      return;
    }

    const usdt = getUsdtContract();
    await ensureContractDeployed(USDT_ADDRESS, "MockUSDT");
    const bal = await usdt.balanceOf(address);

    res.json({
      address,
      balance: (Number(bal) / 1e6).toFixed(6),
      balanceRaw: bal.toString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
