// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MultiSigWallet} from "../../src/multisig/MultiSigWallet.sol";
import {MultiSigGovernor} from "../../src/governance/MultiSigGovernor.sol";
import {AnalysisRegistry} from "../../src/AnalysisRegistry.sol";
import {ReportSBT} from "../../src/ReportSBT.sol";

contract MultiSigGovernorIntegrationTest is Test {
    MultiSigWallet public wallet;
    MultiSigGovernor public governor;
    AnalysisRegistry public registry;
    ReportSBT public sbt;

    address public owner1 = address(0x1);
    address public owner2 = address(0x2);
    address public owner3 = address(0x3);

    function setUp() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        wallet = new MultiSigWallet(owners, 2);
        registry = new AnalysisRegistry();
        sbt = new ReportSBT();
        governor = new MultiSigGovernor(address(wallet), address(registry), address(sbt));

        // Governor needs to be an owner to call submitTransaction internally
        wallet.addOwner(address(governor));

        // Transfer ownership of ReportSBT to governor so it can mint
        sbt.transferOwnership(address(wallet));
    }

    function test_FullFlow_Governance_RecordAnalysis() public {
        bytes32 cid = bytes32(uint256(0xdead));
        uint256 chainId = 1;
        address analyzedWallet = address(0x50);

        // 1. Owner1 proposes recordAnalysis via governor
        vm.prank(owner1);
        uint256 txIndex = governor.proposeRecordAnalysis(cid, chainId, analyzedWallet);

        // 2. Only 1 of 2 confirmed — cannot execute
        vm.prank(owner1);
        vm.expectRevert(MultiSigWallet.NotEnoughConfirmations.selector);
        wallet.executeTransaction(txIndex);

        // 3. Owner2 confirms
        vm.prank(owner2);
        wallet.confirmTransaction(txIndex);

        // 4. Execute — recordAnalysis is called on registry
        vm.prank(owner1);
        wallet.executeTransaction(txIndex);

        // 5. Verify: analysis was recorded
        assertEq(registry.analysisCount(analyzedWallet), 1);
        assertEq(registry.totalAnalyses(), 1);

        bytes32[] memory analyses = registry.getAnalysesForWallet(analyzedWallet);
        assertEq(analyses.length, 1);
    }

    function test_FullFlow_Governance_MintSBT() public {
        bytes32 analysisId = bytes32(uint256(0xabcd));
        bytes32 cid = bytes32(uint256(0x7890));
        address recipient = address(0x60);

        // 1. Owner1 proposes mint SBT
        vm.prank(owner1);
        uint256 txIndex = governor.proposeMintSBT(recipient, analysisId, cid);

        // 2. Owner2 confirms
        vm.prank(owner2);
        wallet.confirmTransaction(txIndex);

        // 3. Execute
        vm.prank(owner3);
        wallet.executeTransaction(txIndex);

        // 4. Verify: SBT minted to recipient
        assertEq(sbt.balanceOf(recipient), 1);
        assertEq(sbt.tokenAnalysis(1), analysisId);
        assertEq(sbt.tokenCid(1), cid);
    }

    function test_FullFlow_Governance_CannotMintTwice() public {
        bytes32 analysisId = bytes32(uint256(0x1111));
        bytes32 cid = bytes32(uint256(0x2222));
        address recipient = address(0x70);

        // Mint first
        vm.prank(owner1);
        uint256 tx1 = governor.proposeMintSBT(recipient, analysisId, cid);
        vm.prank(owner2);
        wallet.confirmTransaction(tx1);
        vm.prank(owner1);
        wallet.executeTransaction(tx1);

        // Try mint again same (should revert)
        vm.prank(owner1);
        uint256 tx2 = governor.proposeMintSBT(recipient, analysisId, cid);
        vm.prank(owner2);
        wallet.confirmTransaction(tx2);

        vm.prank(owner1);
        vm.expectRevert(); // AlreadyMinted
        wallet.executeTransaction(tx2);
    }
}
