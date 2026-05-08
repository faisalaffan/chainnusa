// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {AnalysisRegistry} from "../src/AnalysisRegistry.sol";

contract AnalysisRegistryTest is Test {
    AnalysisRegistry public registry;
    address public analyst = address(0x1);
    address public wallet = address(0x2);

    function setUp() public {
        vm.prank(analyst);
        registry = new AnalysisRegistry();
    }

    function test_RecordAnalysis() public {
        bytes32 cid = bytes32(uint256(0x1234));
        uint256 chainId = 1;
        bytes32 expectedId = keccak256(
            abi.encodePacked(block.chainid, wallet, cid, block.timestamp, analyst)
        );

        vm.prank(analyst);
        bytes32 actualId = registry.recordAnalysis(cid, chainId, wallet);

        assertEq(actualId, expectedId);
        assertEq(registry.analysisCount(wallet), 1);
        assertEq(registry.totalAnalyses(), 1);

        (bytes32 storedCid, uint256 ts, uint256 storedChain, address storedWallet, address storedAnalyst) =
            registry.records(actualId);
        assertEq(storedCid, cid);
        assertEq(storedChain, chainId);
        assertEq(storedWallet, wallet);
        assertEq(storedAnalyst, analyst);
    }

    function test_RevertOnEmptyCid() public {
        vm.prank(analyst);
        vm.expectRevert("Empty CID");
        registry.recordAnalysis(bytes32(0), 1, wallet);
    }

    function test_RevertOnZeroAddress() public {
        vm.prank(analyst);
        vm.expectRevert("Zero address");
        registry.recordAnalysis(bytes32(uint256(0x1)), 1, address(0));
    }

    function test_GetAnalysesForWallet() public {
        vm.startPrank(analyst);
        registry.recordAnalysis(bytes32(uint256(0x1)), 1, wallet);
        registry.recordAnalysis(bytes32(uint256(0x2)), 56, wallet);
        vm.stopPrank();

        bytes32[] memory analyses = registry.getAnalysesForWallet(wallet);
        assertEq(analyses.length, 2);
        assertEq(registry.getAnalysisCount(wallet), 2);
    }

    function test_MultipleWallets() public {
        address wallet2 = address(0x3);
        vm.startPrank(analyst);
        registry.recordAnalysis(bytes32(uint256(0x1)), 1, wallet);
        registry.recordAnalysis(bytes32(uint256(0x2)), 1, wallet2);
        registry.recordAnalysis(bytes32(uint256(0x3)), 1, wallet);
        vm.stopPrank();

        assertEq(registry.analysisCount(wallet), 2);
        assertEq(registry.analysisCount(wallet2), 1);
        assertEq(registry.totalAnalyses(), 3);
    }

    function test_EventEmitted() public {
        bytes32 cid = bytes32(uint256(0x42));
        vm.prank(analyst);
        vm.expectEmit(true, true, false, true);
        emit AnalysisRegistry.AnalysisRecorded(bytes32(0), wallet, cid, 1, analyst, block.timestamp);
        registry.recordAnalysis(cid, 1, wallet);
    }
}
