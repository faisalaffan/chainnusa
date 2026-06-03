// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AnalysisRegistry} from "../src/AnalysisRegistry.sol";
import {ReportSBT} from "../src/ReportSBT.sol";

/**
 * @title Deploy
 * @notice Deploy AnalysisRegistry + ReportSBT to selected chain.
 * Usage:
 *   forge script script/Deploy.s.sol:Deploy --rpc-url <network> --broadcast --verify
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerKey == 0) {
            deployerKey = vm.envOr("PRIVATE_KEY", uint256(0));
        }
        require(deployerKey != 0, "Set DEPLOYER_PRIVATE_KEY or PRIVATE_KEY env var, or pass --private-key via forge");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        AnalysisRegistry registry = new AnalysisRegistry();
        console2.log("AnalysisRegistry deployed at:", address(registry));

        ReportSBT sbt = new ReportSBT();
        console2.log("ReportSBT deployed at:", address(sbt));

        // Transfer ownership of ReportSBT to deployer for clarity
        sbt.transferOwnership(deployer);

        vm.stopBroadcast();
    }
}
