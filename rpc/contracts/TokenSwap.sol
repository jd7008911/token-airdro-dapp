// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenSwap
 * @notice Simple fixed-rate swap: ADRP ↔ USDT.
 *         - Rate is expressed as USDT per 1 whole ADRP token (6-decimal precision).
 *         - Owner funds the contract with USDT and can update the rate.
 *         - Users approve ADRP, then call swapADRPForUSDT.
 */
contract TokenSwap is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable adrp;   // 18 decimals
    IERC20 public immutable usdt;   // 6 decimals

    // Rate: USDT micro-units per 1 whole ADRP token (1e18 wei).
    // e.g. rate = 500_000 means 1 ADRP = 0.50 USDT
    uint256 public rate;

    bool public swapActive;

    event RateUpdated(uint256 newRate);
    event SwapExecuted(address indexed user, uint256 adrpIn, uint256 usdtOut);
    event SwapActivated();
    event SwapDeactivated();
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    constructor(address adrp_, address usdt_, uint256 rate_) Ownable(msg.sender) {
        require(adrp_ != address(0) && usdt_ != address(0), "Invalid token address");
        require(rate_ > 0, "Rate must be > 0");
        adrp = IERC20(adrp_);
        usdt = IERC20(usdt_);
        rate = rate_;
        swapActive = true;
    }

    // ── Owner actions ──────────────────────────────────────────────────

    function setRate(uint256 newRate) external onlyOwner {
        require(newRate > 0, "Rate must be > 0");
        rate = newRate;
        emit RateUpdated(newRate);
    }

    function activate() external onlyOwner {
        swapActive = true;
        emit SwapActivated();
    }

    function deactivate() external onlyOwner {
        swapActive = false;
        emit SwapDeactivated();
    }

    function withdraw(address token_, address to) external onlyOwner {
        uint256 bal = IERC20(token_).balanceOf(address(this));
        require(bal > 0, "Nothing to withdraw");
        IERC20(token_).safeTransfer(to, bal);
        emit Withdrawn(token_, to, bal);
    }

    // ── Swap ───────────────────────────────────────────────────────────

    /**
     * @notice Swap ADRP tokens for USDT at the current rate.
     * @param adrpAmount Amount of ADRP (in wei, 18 decimals) to swap.
     */
    function swapADRPForUSDT(uint256 adrpAmount) external nonReentrant {
        require(swapActive, "Swap not active");
        require(adrpAmount > 0, "Amount must be > 0");

        // Calculate USDT output: adrpAmount (18 dec) * rate (6 dec) / 1e18
        uint256 usdtOut = (adrpAmount * rate) / 1e18;
        require(usdtOut > 0, "Output too small");
        require(usdt.balanceOf(address(this)) >= usdtOut, "Insufficient USDT liquidity");

        // Transfer ADRP from user to this contract
        adrp.safeTransferFrom(msg.sender, address(this), adrpAmount);

        // Transfer USDT to user
        usdt.safeTransfer(msg.sender, usdtOut);

        emit SwapExecuted(msg.sender, adrpAmount, usdtOut);
    }

    // ── Views ──────────────────────────────────────────────────────────

    /**
     * @notice Preview how much USDT you would get for a given ADRP amount.
     */
    function getEstimate(uint256 adrpAmount) external view returns (uint256) {
        return (adrpAmount * rate) / 1e18;
    }

    function usdtBalance() external view returns (uint256) {
        return usdt.balanceOf(address(this));
    }

    function adrpBalance() external view returns (uint256) {
        return adrp.balanceOf(address(this));
    }
}
