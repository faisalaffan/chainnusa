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

        // Transfer ownership of ReportSBT to governor so it can mint
        sbt.transferOwnership(address(governor));
    }
}
