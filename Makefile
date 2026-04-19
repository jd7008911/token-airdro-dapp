# ─────────────────────────────────────────────────────────────
# Token Airdrop DApp – Makefile
# ─────────────────────────────────────────────────────────────

.PHONY: install install-rpc install-web \
        dev dev-rpc dev-web \
        node deploy deploy-local deploy-sepolia \
        compile test generate-merkle \
        build build-rpc build-web \
        clean help

# ── Install ───────────────────────────────────────────────────
install: install-rpc install-web ## Install all dependencies

install-rpc: ## Install RPC backend dependencies
	cd rpc && npm install

install-web: ## Install web frontend dependencies
	cd web && npm install

# ── Development ───────────────────────────────────────────────
dev: ## Run both apps (hardhat node + RPC backend + web frontend)
	@echo "Starting Hardhat node, RPC backend, and Web frontend..."
	$(MAKE) -j3 node dev-rpc dev-web

dev-rpc: ## Run the RPC backend (Express API)
	cd rpc && npm run dev

dev-web: ## Run the web frontend (Vite)
	cd web && npm run dev

# ── Hardhat ───────────────────────────────────────────────────
node: ## Start a local Hardhat node
	cd rpc && npm run node

compile: ## Compile Solidity contracts
	cd rpc && npm run compile

test: ## Run contract tests
	cd rpc && npm run test

deploy-local: ## Deploy contracts to local Hardhat network
	cd rpc && npm run deploy:local

deploy-swap: ## Deploy swap contracts (MockUSDT + TokenSwap) locally
	cd rpc && npm run deploy:swap

deploy-sepolia: ## Deploy contracts to Sepolia testnet
	cd rpc && npm run deploy:sepolia

generate-merkle: ## Generate the Merkle tree from airdrop list
	cd rpc && npm run generate-merkle

# ── Build ─────────────────────────────────────────────────────
build: build-rpc build-web ## Build both apps for production

build-rpc: ## Build the RPC backend
	cd rpc && npm run build

build-web: ## Build the web frontend
	cd web && npm run build

# ── Cleanup ───────────────────────────────────────────────────
clean: ## Remove node_modules and build artifacts
	rm -rf rpc/node_modules rpc/dist web/node_modules web/dist

# ── Help ──────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
