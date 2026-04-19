# Token Airdrop DApp

A full-stack decentralised application for distributing ERC-20 tokens via a Merkle-tree airdrop. Users connect a wallet, verify eligibility, and claim tokens on-chain. Admins manage the airdrop lifecycle through both smart-contract owner functions and a web dashboard.

---

## Projects

| Directory | Description | README |
|---|---|---|
| [`rpc/`](rpc/) | Solidity smart contracts, Hardhat toolchain, Express API server | [rpc/README.md](rpc/README.md) |
| [`web/`](web/) | Vue 3 frontend – wallet connection, claim flow, admin dashboard | [web/README.md](web/README.md) |

---

## Architecture

| Layer | Directory | Stack |
|---|---|---|
| Smart Contracts | `rpc/contracts/` | Solidity 0.8.24, OpenZeppelin 5, Hardhat |
| Backend API | `rpc/src/` | Express, ethers.js v6, TypeScript |
| Frontend | `web/` | Vue 3, Vite, Pinia, ethers.js v6 |

---

## Quick Start

```bash
# 1. Install dependencies
cd rpc && npm install
cd ../web && npm install

# 2. Start local blockchain
cd ../rpc
npx hardhat node                        # terminal 1

# 3. Deploy contracts
npx hardhat run scripts/deploy.ts --network localhost   # terminal 2

# 4. Copy printed addresses into rpc/.env
#    TOKEN_ADDRESS=0x...
#    AIRDROP_ADDRESS=0x...

# 5. Generate Merkle tree & start airdrop
npx hardhat run scripts/generate-merkle.ts --network localhost

# 6. Start backend API
npm run dev                             # terminal 2 (port 3001)

# 7. Start frontend
cd ../web && npm run dev                # terminal 3 (port 5173)
```

Open **http://localhost:5173** in a browser with MetaMask pointed at `http://127.0.0.1:8545` (chain ID 31337).

---

## Running Tests

```bash
cd rpc
npx hardhat test
```

---

## Documentation

- **[rpc/README.md](rpc/README.md)** – Contract features (C-1 → C-7), API features (B-1 → B-9), user stories, and 13 UAT test cases covering smart-contract and API behaviour.
- **[web/README.md](web/README.md)** – Frontend features (F-1 → F-8), user stories, and 11 UAT test cases covering wallet connection, claim flow, admin dashboard, and edge cases.
