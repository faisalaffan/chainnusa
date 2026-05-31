import { expect } from "chai";
import { ethers } from "hardhat";
import { AnalysisRegistry } from "../../typechain-types";

describe("AnalysisRegistry (Hardhat)", function () {
  async function deploy() {
    const [owner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AnalysisRegistry");
    const registry = await Factory.deploy();
    await registry.waitForDeployment();
    return { registry, owner };
  }

  it("should set deployer as owner", async function () {
    const { registry, owner } = await deploy();
    expect(await registry.owner()).to.equal(owner.address);
  });

  it("should record an analysis and emit event", async function () {
    const { registry } = await deploy();
    const wallet = ethers.Wallet.createRandom().address;
    const cidBytes = ethers.randomBytes(32);

    const tx = await registry.recordAnalysis(cidBytes, 1, wallet);
    const receipt = await tx.wait();

    // Check event
    const events = await registry.queryFilter(
      registry.filters.AnalysisRecorded(),
      receipt!.blockNumber,
      receipt!.blockNumber,
    );
    expect(events.length).to.equal(1);
    expect(events[0].args.indexedWallet).to.equal(wallet);
    expect(events[0].args.chainId).to.equal(1n);
  });

  it("should increment analysis count", async function () {
    const { registry } = await deploy();
    const wallet = ethers.Wallet.createRandom().address;
    const cidBytes = ethers.randomBytes(32);

    await registry.recordAnalysis(cidBytes, 1, wallet);
    expect(await registry.analysisCount(wallet)).to.equal(1n);
    expect(await registry.totalAnalyses()).to.equal(1n);

    await registry.recordAnalysis(ethers.randomBytes(32), 56, wallet);
    expect(await registry.analysisCount(wallet)).to.equal(2n);
    expect(await registry.totalAnalyses()).to.equal(2n);
  });

  it("should revert with empty CID", async function () {
    const { registry } = await deploy();
    const wallet = ethers.Wallet.createRandom().address;
    await expect(
      registry.recordAnalysis(ethers.ZeroHash, 1, wallet),
    ).to.be.revertedWith("Empty CID");
  });

  it("should revert with zero address", async function () {
    const { registry } = await deploy();
    await expect(
      registry.recordAnalysis(
        ethers.randomBytes(32),
        1,
        ethers.ZeroAddress,
      ),
    ).to.be.revertedWith("Zero address");
  });
});
