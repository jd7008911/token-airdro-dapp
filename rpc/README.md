# RPC – Backend & Smart Contracts

Smart contracts (Solidity) and Express API server for the Token Airdrop DApp.

## Stack

| Component | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.24, OpenZeppelin 5 |
| Toolchain | Hardhat, TypeChain |
| API Server | Express, ethers.js v6, TypeScript |
| Security | Helmet, CORS whitelist, express-rate-limit |

---

## Features

### Smart Contracts (`contracts/`)

| # | Feature | Description |
|---|---|---|
| C-1 | ERC-20 Token | `AirdropToken` – mintable, burnable, capped at 1 B supply. Owner-only minting. |
| C-2 | Merkle Airdrop | `TokenAirdrop` – distributes tokens using OpenZeppelin `MerkleProof`. Double-claim protection via `hasClaimed` mapping. |
| C-3 | Airdrop Lifecycle | Owner can start, pause, resume, and close the airdrop. Configurable claim deadline. |
| C-4 | Merkle Root Update | Owner can update the Merkle root without redeploying. |
| C-5 | Unclaimed Withdrawal | Owner can withdraw remaining tokens after pausing the airdrop. |
| C-6 | Reentrancy Guard | Claim function protected by OpenZeppelin `ReentrancyGuard`. |
| C-7 | Eligibility View | On-chain `isEligible()` for read-only proof verification. |

### Backend API (`src/`)

| # | Feature | Description |
|---|---|---|
| B-1 | Token Info | `GET /api/token/info` – returns name, symbol, decimals, total supply. |
| B-2 | Token Balance | `GET /api/token/balance/:address` – returns ERC-20 balance for any address. |
| B-3 | Airdrop Status | `GET /api/airdrop/status` – returns on-chain active flag, deadline, total claimed, remaining balance, Merkle root. |
| B-4 | Merkle Proof | `GET /api/airdrop/proof/:address` – returns eligibility, claim status, amount, and proof array. |
| B-5 | Claim Check | `GET /api/airdrop/claimed/:address` – returns whether an address has already claimed. |
| B-6 | Entry List | `GET /api/airdrop/entries` – returns the full distribution list (admin use). |
| B-7 | Health Check | `GET /api/health` – liveness probe. |
| B-8 | Security | Helmet headers, CORS whitelist, rate limiting (100 req/min). |
| B-9 | Merkle Generation | `generate-merkle.ts` script – builds a Merkle tree from a JSON airdrop list, saves it, and optionally starts the airdrop on-chain. |

---

## User Stories

### US-1 – Airdrop Lifecycle (Owner)
**As the** contract owner,  
**I want to** start, pause, resume, and close the airdrop,  
**so that** I have full control over the distribution window.

**Acceptance Criteria**  
- `startAirdrop` sets the Merkle root, activates the airdrop, and sets the deadline.  
- `pauseAirdrop` prevents new claims; `resumeAirdrop` re-enables them.  
- `withdrawUnclaimed` transfers remaining tokens to the owner after pausing.

### US-2 – Double-Claim Prevention
**As the** system,  
**I want to** prevent any address from claiming more than once,  
**so that** the token distribution is fair and tamper-proof.

**Acceptance Criteria**  
- A second `claim()` call from the same address reverts with "Already claimed".

### US-3 – Merkle Proof API
**As the** frontend,  
**I want to** request a Merkle proof for any address,  
**so that** eligible users can build a valid claim transaction.

**Acceptance Criteria**  
- `GET /api/airdrop/proof/:address` returns `{ eligible, claimed, amount, proof }`.  
- Invalid addresses return `400`.

---

## UAT Test Cases

### TC-01 – Home Page Loads Stats via API

| Field | Value |
|---|---|
| **Precondition** | Backend running, contracts deployed, airdrop started. |
| **Steps** | 1. `GET /api/token/info`. 2. `GET /api/airdrop/status`. |
| **Expected** | Token name = "AirdropToken", symbol = "ADRP", total supply = "100000000.0". Airdrop active = true, balance = "50000000.0". |

### TC-02 – Merkle Proof for Eligible Address

| Field | Value |
|---|---|
| **Precondition** | Merkle tree generated with sample entries. |
| **Steps** | 1. `GET /api/airdrop/proof/<eligible_address>`. |
| **Expected** | `{ eligible: true, claimed: false, amount: "...", proof: [...] }`. |

### TC-03 – Merkle Proof for Ineligible Address

| Field | Value |
|---|---|
| **Precondition** | Backend running. |
| **Steps** | 1. `GET /api/airdrop/proof/<address_not_in_tree>`. |
| **Expected** | `{ eligible: false }`. |

### TC-04 – Invalid Address in API

| Field | Value |
|---|---|
| **Precondition** | Backend running. |
| **Steps** | 1. `GET /api/airdrop/proof/not-an-address`. |
| **Expected** | Returns `400` with `{ "error": "Invalid Ethereum address" }`. |

### TC-05 – API Rate Limiting

| Field | Value |
|---|---|
| **Precondition** | Backend running. |
| **Steps** | 1. Send > 100 requests to any endpoint within 60 seconds. |
| **Expected** | First 100 return `200`. Subsequent return `429 Too Many Requests`. |

### TC-06 – Token Balance Query

| Field | Value |
|---|---|
| **Precondition** | Contracts deployed. |
| **Steps** | 1. `GET /api/token/balance/<deployer_address>`. |
| **Expected** | Returns deployer's remaining balance (50,000,000 after funding airdrop). |

### TC-07 – Claim On-Chain (Happy Path)

| Field | Value |
|---|---|
| **Precondition** | Airdrop active, eligible address, valid proof. |
| **Steps** | 1. Call `claim(amount, proof)` from the eligible address. |
| **Expected** | Transaction succeeds. `hasClaimed` returns true. Token balance increases. |

### TC-08 – Double Claim On-Chain Revert

| Field | Value |
|---|---|
| **Precondition** | Address has already claimed. |
| **Steps** | 1. Call `claim()` again with the same address, amount, and proof. |
| **Expected** | Transaction reverts with "Already claimed". |

### TC-09 – Claim When Airdrop Paused

| Field | Value |
|---|---|
| **Precondition** | Owner has called `pauseAirdrop()`. |
| **Steps** | 1. Call `claim()` from an eligible address. |
| **Expected** | Transaction reverts with "Airdrop not active". |

### TC-10 – Claim After Deadline

| Field | Value |
|---|---|
| **Precondition** | Deadline has elapsed (use `evm_increaseTime`). |
| **Steps** | 1. Call `claim()` from an eligible address. |
| **Expected** | Transaction reverts with "Claim window closed". |

### TC-11 – Withdraw Unclaimed (Owner)

| Field | Value |
|---|---|
| **Precondition** | Airdrop paused. Unclaimed tokens remain. |
| **Steps** | 1. Owner calls `withdrawUnclaimed(ownerAddress)`. |
| **Expected** | All remaining tokens transferred to owner. Contract balance = 0. |

### TC-12 – Withdraw Unclaimed Revert (Active Airdrop)

| Field | Value |
|---|---|
| **Precondition** | Airdrop is active. |
| **Steps** | 1. Owner calls `withdrawUnclaimed(ownerAddress)`. |
| **Expected** | Transaction reverts with "Airdrop still active". |

### TC-13 – Non-Owner Cannot Start Airdrop

| Field | Value |
|---|---|
| **Precondition** | Connected with a non-owner address. |
| **Steps** | 1. Call `startAirdrop()`. |
| **Expected** | Transaction reverts with `OwnableUnauthorizedAccount`. |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start local Hardhat node
npx hardhat node                                          # terminal 1

# 3. Compile & deploy contracts
npx hardhat compile
npx hardhat run scripts/deploy.ts --network localhost     # terminal 2

# 4. Copy printed addresses into .env
#    TOKEN_ADDRESS=0x...
#    AIRDROP_ADDRESS=0x...

# 5. Generate Merkle tree & start airdrop on-chain
npx hardhat run scripts/generate-merkle.ts --network localhost

# 6. Start the API server
npm run dev                                               # port 3001
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `SEPOLIA_RPC_URL` | RPC endpoint (default `http://127.0.0.1:8545` for local) |
| `TOKEN_ADDRESS` | Deployed AirdropToken address |
| `AIRDROP_ADDRESS` | Deployed TokenAirdrop address |
| `PORT` | API server port (default `3001`) |
| `PRIVATE_KEY` | Deployer key (Sepolia only) |

## Running Tests

```bash
npx hardhat test
```
