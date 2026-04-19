// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title TokenAirdrop
 * @notice Merkle-tree based airdrop distributor for ERC-20 tokens.
 *         - Owner sets a Merkle root representing all eligible (address, amount) pairs.
 *         - Eligible users submit a proof to claim their tokens.
 *         - Owner can start / pause / close the airdrop and withdraw unclaimed tokens.
 */
contract TokenAirdrop is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── State ──────────────────────────────────────────────────────────
    IERC20 public immutable token;
    bytes32 public merkleRoot;

    bool public airdropActive;
    uint256 public claimDeadline;
    uint256 public totalClaimed;

    mapping(address => bool) public hasClaimed;

    // ── Events ─────────────────────────────────────────────────────────
    event AirdropStarted(bytes32 indexed merkleRoot, uint256 deadline);
    event AirdropPaused();
    event AirdropResumed();
    event Claimed(address indexed account, uint256 amount);
    event MerkleRootUpdated(bytes32 indexed newRoot);
    event UnclaimedWithdrawn(address indexed to, uint256 amount);

    // ── Constructor ────────────────────────────────────────────────────
    constructor(address token_) Ownable(msg.sender) {
        require(token_ != address(0), "Invalid token address");
        token = IERC20(token_);
    }

    // ── Owner actions ──────────────────────────────────────────────────

    /**
     * @notice Configure and start the airdrop.
     * @param merkleRoot_ Root hash of the Merkle tree.
     * @param duration_   Seconds until the claim window closes (0 = no deadline).
     */
    function startAirdrop(bytes32 merkleRoot_, uint256 duration_) external onlyOwner {
        require(merkleRoot_ != bytes32(0), "Invalid root");
        merkleRoot = merkleRoot_;
        airdropActive = true;
        claimDeadline = duration_ > 0 ? block.timestamp + duration_ : 0;
        emit AirdropStarted(merkleRoot_, claimDeadline);
    }

    function pauseAirdrop() external onlyOwner {
        airdropActive = false;
        emit AirdropPaused();
    }

    function resumeAirdrop() external onlyOwner {
        airdropActive = true;
        emit AirdropResumed();
    }

    function updateMerkleRoot(bytes32 newRoot) external onlyOwner {
        require(newRoot != bytes32(0), "Invalid root");
        merkleRoot = newRoot;
        emit MerkleRootUpdated(newRoot);
    }

    /**
     * @notice Withdraw unclaimed tokens after the airdrop ends.
     */
    function withdrawUnclaimed(address to) external onlyOwner {
        require(!airdropActive, "Airdrop still active");
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "Nothing to withdraw");
        token.safeTransfer(to, balance);
        emit UnclaimedWithdrawn(to, balance);
    }

    // ── Claim ──────────────────────────────────────────────────────────

    /**
     * @notice Claim airdrop tokens by providing a valid Merkle proof.
     * @param amount The amount allocated to msg.sender.
     * @param proof  Merkle proof for (msg.sender, amount).
     */
    function claim(uint256 amount, bytes32[] calldata proof) external nonReentrant {
        require(airdropActive, "Airdrop not active");
        require(claimDeadline == 0 || block.timestamp <= claimDeadline, "Claim window closed");
        require(!hasClaimed[msg.sender], "Already claimed");

        // Verify Merkle proof
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid proof");

        hasClaimed[msg.sender] = true;
        totalClaimed += amount;

        token.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    // ── Views ──────────────────────────────────────────────────────────

    function airdropBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function isEligible(
        address account,
        uint256 amount,
        bytes32[] calldata proof
    ) external view returns (bool) {
        if (hasClaimed[account]) return false;
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(account, amount))));
        return MerkleProof.verify(proof, merkleRoot, leaf);
    }
}
