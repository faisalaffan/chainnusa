// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MultiSigWallet} from "../src/multisig/MultiSigWallet.sol";
import {MultiSigGovernor} from "../src/governance/MultiSigGovernor.sol";

/**
 * @title DeployMultiSig
 * @notice Deploy MultiSigWallet + MultiSigGovernor, wire up with existing AnalysisRegistry & ReportSBT.
 *
 * Usage:
 *   export DEPLOYER_PRIVATE_KEY=<key>
 *   export MULTISIG_OWNERS="0xOwner1,0xOwner2,0xOwner3"  # comma-separated addresses
 *   export MULTISIG_THRESHOLD=2
 *   export ANALYSIS_REGISTRY=<existing-deployed-address>
 *   export REPORT_SBT=<existing-deployed-address>
 *
 *   forge script script/DeployMultiSig.s.sol:DeployMultiSig \
 *     --rpc-url arbitrum_sepolia \
 *     --broadcast \
 *     --verify
 */
contract DeployMultiSig is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        string memory ownersRaw = vm.envString("MULTISIG_OWNERS");
        address[] memory owners = parseAddresses(ownersRaw);

        uint256 threshold = vm.envUint("MULTISIG_THRESHOLD");

        address existingRegistry = vm.envAddress("ANALYSIS_REGISTRY");
        address existingSBT = vm.envAddress("REPORT_SBT");

        vm.startBroadcast(deployerKey);

        // 1. Deploy MultiSigWallet
        MultiSigWallet wallet = new MultiSigWallet(owners, threshold);
        console2.log("MultiSigWallet deployed at:", address(wallet));

        // 2. Deploy MultiSigGovernor
        MultiSigGovernor governor = new MultiSigGovernor(
            address(wallet),
            existingRegistry,
            existingSBT
        );
        console2.log("MultiSigGovernor deployed at:", address(governor));

        // 3. Add governor as owner of wallet (needed for submitTransaction internally)
        wallet.addOwner(address(governor));

        console2.log("---");
        console2.log("Next steps:");
        console2.log("1. Transfer AnalysisRegistry ownership to wallet (not governor):");
        console2.log(
            "   cast send %s 'transferOwnership(address)' %s --rpc-url <network>",
            existingRegistry,
            address(wallet)
        );
        console2.log("2. Transfer ReportSBT ownership to wallet (not governor):");
        console2.log(
            "   cast send %s 'transferOwnership(address)' %s --rpc-url <network>",
            existingSBT,
            address(wallet)
        );

        vm.stopBroadcast();
    }

    function parseAddresses(string memory csv) internal pure returns (address[] memory) {
        bytes memory csvBytes = bytes(csv);
        uint256 count = 1;
        for (uint256 i = 0; i < csvBytes.length; i++) {
            if (csvBytes[i] == ',') count++;
        }

        address[] memory addrs = new address[](count);
        uint256 last = 0;
        uint256 idx = 0;
        for (uint256 i = 0; i <= csvBytes.length; i++) {
            if (i == csvBytes.length || csvBytes[i] == ',') {
                bytes memory segment = new bytes(i - last);
                for (uint256 j = last; j < i; j++) {
                    segment[j - last] = csvBytes[j];
                }
                addrs[idx] = address(uint160(vm.parseUint(string(segment))));
                idx++;
                last = i + 1;
            }
        }
        return addrs;
    }
}
