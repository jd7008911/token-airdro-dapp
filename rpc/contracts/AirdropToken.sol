// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AirdropToken
 * @notice ERC-20 token used for the DeFi airdrop distribution.
 *         The owner can mint tokens; total supply is capped.
 */
contract AirdropToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion tokens

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialMint_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        require(initialMint_ <= MAX_SUPPLY, "Exceeds max supply");
        _mint(msg.sender, initialMint_);
    }

    /**
     * @notice Mint new tokens (owner only). Respects MAX_SUPPLY cap.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }
}
