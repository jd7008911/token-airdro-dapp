import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";

// Load .env from rpc root (local dev only; Railway injects env vars directly)
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config(); // Also check cwd for .env

import { airdropRouter } from "./routes/airdrop";
import { tokenRouter } from "./routes/token";
import { swapRouter } from "./routes/swap";

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ── Routes ───────────────────────────────────────────────────────────
app.use("/api/airdrop", airdropRouter);
app.use("/api/token", tokenRouter);
app.use("/api/swap", swapRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// ── Start ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[rpc] Server running on http://localhost:${PORT}`);
});
