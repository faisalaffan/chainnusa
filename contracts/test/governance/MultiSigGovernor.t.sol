// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MultiSigWallet} from "../../src/multisig/MultiSigWallet.sol";
import {MultiSigGovernor} from "../../src/governance/MultiSigGovernor.sol";
import {AnalysisRegistry} from "../../src/AnalysisRegistry.sol";
import {ReportSBT} from "../../src/ReportSBT.sol";

contract MultiSigGovernorTest is Test {
    MultiSigWallet public wallet;
    MultiSigGovernor public governor;
    AnalysisRegistry public registry;
    ReportSBT public sbt;

    address public owner1 = address(0x1);
    address public owner2 = address(0x2);
    address public owner3 = address(0x3);
    address public stranger = address(0x99);

    function setUp() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        wallet = new MultiSigWallet(owners, 2);

        registry = new AnalysisRegistry();
        sbt = new ReportSBT();

        governor = new MultiSigGovernor(address(wallet), address(registry), address(sbt));

        // Add governor as wallet owner so it can submit transactions on behalf of owners
        wallet.addOwner(address(governor));

        // Transfer ownership of ReportSBT to governor so it can mint
        sbt.transferOwnership(address(governor));
    }

    function test_ProposeRecordAnalysis() public {
        bytes32 cid = bytes32(uint256(0x1234));
        address analyzedWallet = address(0x50);

        vm.prank(owner1);
        uint256 txIndex = governor.proposeRecordAnalysis(cid, 1, analyzedWallet);

        // Proposal created in MultiSigWallet
        assertEq(wallet.getTransactionCount(), 1);
        (address to, uint256 value, , bool executed, ) = wallet.getTransaction(txIndex);
        assertEq(to, address(registry));
        assertEq(value, 0);
        assertFalse(executed);
    }

    function test_ProposeRecordAnalysis_RevertIf_NotOwner() public {
        bytes32 cid = bytes32(uint256(0x1234));
        vm.prank(stranger);
        vm.expectRevert(MultiSigGovernor.NotWalletOwner.selector);
        governor.proposeRecordAnalysis(cid, 1, address(0x50));
    }
}
