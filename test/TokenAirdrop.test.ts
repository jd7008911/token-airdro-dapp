import { expect } from "chai";
import { ethers } from "hardhat";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import type { AirdropToken, TokenAirdrop } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("TokenAirdrop", function () {
  let token: AirdropToken;
  let airdrop: TokenAirdrop;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;
  let tree: StandardMerkleTree<string[]>;

  const ALICE_AMOUNT = ethers.parseEther("1000");
  const BOB_AMOUNT = ethers.parseEther("2000");

  beforeEach(async () => {
    [owner, alice, bob, carol] = await ethers.getSigners();

    // Deploy token
    const TokenFactory = await ethers.getContractFactory("AirdropToken");
    token = (await TokenFactory.deploy("AirdropToken", "ADRP", ethers.parseEther("1000000"))) as unknown as AirdropToken;
    await token.waitForDeployment();

    // Deploy airdrop
    const AirdropFactory = await ethers.getContractFactory("TokenAirdrop");
    airdrop = (await AirdropFactory.deploy(await token.getAddress())) as unknown as TokenAirdrop;
    await airdrop.waitForDeployment();

    // Fund airdrop contract
    await token.transfer(await airdrop.getAddress(), ethers.parseEther("100000"));

    // Build Merkle tree
    const values = [
      [alice.address, ALICE_AMOUNT.toString()],
      [bob.address, BOB_AMOUNT.toString()],
    ];
    tree = StandardMerkleTree.of(values, ["address", "uint256"]);
  });

  describe("startAirdrop", () => {
    it("should set Merkle root and activate", async () => {
      await airdrop.startAirdrop(tree.root, 86400);
      expect(await airdrop.merkleRoot()).to.equal(tree.root);
      expect(await airdrop.airdropActive()).to.be.true;
    });

    it("should revert for non-owner", async () => {
      await expect(
        airdrop.connect(alice).startAirdrop(tree.root, 86400)
      ).to.be.revertedWithCustomError(airdrop, "OwnableUnauthorizedAccount");
    });
  });

  describe("claim", () => {
    beforeEach(async () => {
      await airdrop.startAirdrop(tree.root, 0); // no deadline
    });

    it("should allow Alice to claim with valid proof", async () => {
      const proof = getProof(tree, alice.address);
      await expect(airdrop.connect(alice).claim(ALICE_AMOUNT, proof))
        .to.emit(airdrop, "Claimed")
        .withArgs(alice.address, ALICE_AMOUNT);

      expect(await token.balanceOf(alice.address)).to.equal(ALICE_AMOUNT);
      expect(await airdrop.hasClaimed(alice.address)).to.be.true;
    });

    it("should allow Bob to claim with valid proof", async () => {
      const proof = getProof(tree, bob.address);
      await airdrop.connect(bob).claim(BOB_AMOUNT, proof);
      expect(await token.balanceOf(bob.address)).to.equal(BOB_AMOUNT);
    });

    it("should revert double claim", async () => {
      const proof = getProof(tree, alice.address);
      await airdrop.connect(alice).claim(ALICE_AMOUNT, proof);
      await expect(
        airdrop.connect(alice).claim(ALICE_AMOUNT, proof)
      ).to.be.revertedWith("Already claimed");
    });

    it("should revert for ineligible address", async () => {
      const proof = getProof(tree, alice.address);
      await expect(
        airdrop.connect(carol).claim(ALICE_AMOUNT, proof)
      ).to.be.revertedWith("Invalid proof");
    });

    it("should revert with wrong amount", async () => {
      const proof = getProof(tree, alice.address);
      await expect(
        airdrop.connect(alice).claim(ethers.parseEther("9999"), proof)
      ).to.be.revertedWith("Invalid proof");
    });
  });

  describe("isEligible", () => {
    beforeEach(async () => {
      await airdrop.startAirdrop(tree.root, 0);
    });

    it("should return true for valid entry", async () => {
      const proof = getProof(tree, alice.address);
      expect(await airdrop.isEligible(alice.address, ALICE_AMOUNT, proof)).to.be.true;
    });

    it("should return false after claiming", async () => {
      const proof = getProof(tree, alice.address);
      await airdrop.connect(alice).claim(ALICE_AMOUNT, proof);
      expect(await airdrop.isEligible(alice.address, ALICE_AMOUNT, proof)).to.be.false;
    });
  });

  describe("pause / resume / withdraw", () => {
    beforeEach(async () => {
      await airdrop.startAirdrop(tree.root, 0);
    });

    it("should pause and prevent claims", async () => {
      await airdrop.pauseAirdrop();
      const proof = getProof(tree, alice.address);
      await expect(
        airdrop.connect(alice).claim(ALICE_AMOUNT, proof)
      ).to.be.revertedWith("Airdrop not active");
    });

    it("should resume and allow claims", async () => {
      await airdrop.pauseAirdrop();
      await airdrop.resumeAirdrop();
      const proof = getProof(tree, alice.address);
      await airdrop.connect(alice).claim(ALICE_AMOUNT, proof);
      expect(await token.balanceOf(alice.address)).to.equal(ALICE_AMOUNT);
    });

    it("should withdraw unclaimed tokens", async () => {
      await airdrop.pauseAirdrop();
      const balance = await token.balanceOf(await airdrop.getAddress());
      await airdrop.withdrawUnclaimed(owner.address);
      expect(await token.balanceOf(owner.address)).to.equal(
        ethers.parseEther("900000") + balance
      );
    });
  });
});

// ── Helper ──────────────────────────────────────────────────────────────
function getProof(
  tree: StandardMerkleTree<string[]>,
  address: string
): string[] {
  for (const [i, v] of tree.entries()) {
    if (v[0].toLowerCase() === address.toLowerCase()) {
      return tree.getProof(i);
    }
  }
  throw new Error(`Address ${address} not found in tree`);
}
