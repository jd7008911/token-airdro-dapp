# Web – Frontend

Vue 3 single-page application for the Token Airdrop DApp. Users connect a wallet, check eligibility, and claim tokens. Admins view distribution status.

## Stack

| Component | Technology |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Router | Vue Router 4 |
| State | Pinia |
| Blockchain | ethers.js v6 (browser provider / MetaMask) |
| Build | Vite 5, TypeScript 5 |

---

## Features

| # | Feature | Description |
|---|---|---|
| F-1 | Wallet Connect | MetaMask integration via Pinia store. Detects account and chain changes in real time. |
| F-2 | Home Dashboard | Displays token metadata, airdrop balance, status badge (Active / Inactive), and total claimed. |
| F-3 | Eligibility Check | User enters the Claim page, clicks "Check Eligibility", and the app fetches the Merkle proof from the API. |
| F-4 | Token Claim | One-click on-chain claim transaction. Displays TX hash and refreshes eligibility after confirmation. |
| F-5 | Claim Guards | UI shows distinct states: not connected, not eligible, already claimed, eligible. |
| F-6 | Admin Dashboard | Table of all distribution entries with address and amount. Airdrop status cards (active, deadline, claimed, remaining). |
| F-7 | Disconnect | User can disconnect wallet; listeners are cleaned up. |
| F-8 | API Proxy | Vite proxies `/api` to the backend so no CORS issues in dev. |

---

## Pages

| Route | View | Description |
|---|---|---|
| `/` | HomeView | Token stats, airdrop status, "How It Works" steps. |
| `/claim` | ClaimView | Connect wallet → check eligibility → claim tokens. |
| `/admin` | AdminView | Status cards + full distribution entry table. |

---

## User Stories

### US-1 – Wallet Connection
**As a** token recipient,  
**I want to** connect my MetaMask wallet,  
**so that** the DApp can identify my address and check my eligibility.

**Acceptance Criteria**  
- A "Connect Wallet" button is visible when no wallet is connected.  
- Clicking it opens the MetaMask popup.  
- After approval, the navbar shows the truncated address and a green connected badge.  
- If MetaMask is not installed, an error message is displayed.

### US-2 – Eligibility Check
**As a** token recipient,  
**I want to** check whether my address is included in the airdrop,  
**so that** I know if I can claim tokens.

**Acceptance Criteria**  
- On the Claim page, a "Check Eligibility" button appears after connecting.  
- If eligible: displays allocated token amount and a "Claim Now" button.  
- If not eligible: displays a "Not Eligible" message.  
- If already claimed: displays an "Already Claimed" message with the amount.

### US-3 – Token Claim
**As an** eligible recipient,  
**I want to** claim my airdrop tokens in a single transaction,  
**so that** the tokens are transferred to my wallet.

**Acceptance Criteria**  
- Clicking "Claim Now" sends an on-chain transaction with the correct amount and Merkle proof.  
- A spinner is shown while the transaction is pending.  
- After confirmation, the UI updates to "Already Claimed".  
- The transaction hash is displayed on screen.

### US-4 – Home Dashboard
**As a** visitor,  
**I want to** see the overall airdrop statistics on the home page,  
**so that** I understand the token and distribution status at a glance.

**Acceptance Criteria**  
- Home page loads token name, symbol, total supply, airdrop balance, status, and total claimed.  
- Values are formatted with locale-appropriate number separators.  
- If the backend is unreachable, the page still renders with placeholder dashes.

### US-5 – Admin Dashboard
**As an** admin,  
**I want to** view the full distribution list and airdrop status,  
**so that** I can monitor the airdrop progress.

**Acceptance Criteria**  
- Admin page shows status cards: active/inactive, deadline, total claimed, remaining balance.  
- A table lists every entry with address and formatted token amount.  
- The entry count badge reflects the total number of entries.

### US-6 – Wallet Disconnect
**As a** connected user,  
**I want to** disconnect my wallet,  
**so that** my session is cleared and the DApp no longer holds my address.

**Acceptance Criteria**  
- A "Disconnect" button appears when connected.  
- Clicking it clears the address and reverts the navbar to the "Connect Wallet" state.  
- Account and chain change listeners are removed.

---

## UAT Test Cases

### TC-01 – Connect Wallet (Happy Path)

| Field | Value |
|---|---|
| **Precondition** | MetaMask installed, Hardhat network (chain 31337) configured, user has an account. |
| **Steps** | 1. Open `http://localhost:5173`. 2. Click **Connect Wallet** in the navbar. 3. Approve the connection in MetaMask. |
| **Expected** | Navbar shows truncated address (e.g. `0xf39F…2266`) with a green dot. "Disconnect" button appears. |

### TC-02 – Connect Wallet (No MetaMask)

| Field | Value |
|---|---|
| **Precondition** | Browser has no wallet extension installed. |
| **Steps** | 1. Open `http://localhost:5173`. 2. Click **Connect Wallet**. |
| **Expected** | Error message: "MetaMask not detected. Please install MetaMask." |

### TC-03 – Home Page Loads Stats

| Field | Value |
|---|---|
| **Precondition** | Backend running, contracts deployed, airdrop started. |
| **Steps** | 1. Navigate to Home (`/`). |
| **Expected** | Token name = "AirdropToken", symbol = "ADRP", total supply = "100,000,000", airdrop balance = "50,000,000", status badge = "Active". |

### TC-04 – Home Page – Backend Offline

| Field | Value |
|---|---|
| **Precondition** | Backend is stopped. |
| **Steps** | 1. Navigate to Home (`/`). |
| **Expected** | Page renders without crashing. Stat cards display "—" as placeholder values. |

### TC-05 – Check Eligibility (Eligible Address)

| Field | Value |
|---|---|
| **Precondition** | Wallet connected with an address in the Merkle tree (e.g. Hardhat account #1). |
| **Steps** | 1. Navigate to `/claim`. 2. Click **Check Eligibility**. |
| **Expected** | Shows "You're Eligible!" with the allocated amount (e.g. "1,000 tokens") and a "Claim Now" button. |

### TC-06 – Check Eligibility (Ineligible Address)

| Field | Value |
|---|---|
| **Precondition** | Wallet connected with an address NOT in the Merkle tree. |
| **Steps** | 1. Navigate to `/claim`. 2. Click **Check Eligibility**. |
| **Expected** | Shows "Not Eligible" message. No claim button is displayed. |

### TC-07 – Claim Tokens (Happy Path)

| Field | Value |
|---|---|
| **Precondition** | TC-05 passed – eligible address connected, airdrop active. |
| **Steps** | 1. Click **Claim Now**. 2. Confirm the transaction in MetaMask. 3. Wait for confirmation. |
| **Expected** | Spinner appears during TX. After confirmation, UI shows "Already Claimed" with the amount. TX hash is displayed. |

### TC-08 – Double Claim Prevention (UI)

| Field | Value |
|---|---|
| **Precondition** | TC-07 completed – tokens already claimed. |
| **Steps** | 1. On `/claim`, click **Check Eligibility** again. |
| **Expected** | Shows "Already Claimed" state. No "Claim Now" button visible. |

### TC-09 – Admin Dashboard Shows Entries

| Field | Value |
|---|---|
| **Precondition** | Backend running, Merkle tree generated with 5 sample entries. |
| **Steps** | 1. Navigate to `/admin`. |
| **Expected** | Status cards: Active, deadline date, total claimed = "0", remaining = "50,000,000". Table lists 5 entries. Badge shows "5 entries". |

### TC-10 – Disconnect Wallet

| Field | Value |
|---|---|
| **Precondition** | Wallet is connected. |
| **Steps** | 1. Click **Disconnect** in the navbar. |
| **Expected** | Navbar reverts to "Connect Wallet" button. Claim page shows "Please connect your wallet". |

### TC-11 – Account Switch in MetaMask

| Field | Value |
|---|---|
| **Precondition** | Wallet connected. User switches to a different account in MetaMask. |
| **Steps** | 1. Open MetaMask. 2. Switch to a different account. |
| **Expected** | Navbar updates to the new truncated address. Eligibility state resets. |

---

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (requires backend on port 3001)
npm run dev          # http://localhost:5173

# Type check
npx vue-tsc --noEmit

# Production build
npm run build
npm run preview
```

## Environment Variables

Create a `.env` file (optional – defaults work for local dev):

| Variable | Description |
|---|---|
| `VITE_API_BASE` | API base URL (empty = use Vite proxy, default) |
| `VITE_AIRDROP_ADDRESS` | TokenAirdrop contract address (for direct on-chain calls) |
| `VITE_TOKEN_ADDRESS` | AirdropToken contract address |
| `VITE_CHAIN_ID` | Expected chain ID |
