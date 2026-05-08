// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {ReportSBT} from "../src/ReportSBT.sol";

contract ReportSBTTest is Test {
    ReportSBT public sbt;
    address public owner = address(0x1);
    address public user = address(0x2);
    address public other = address(0x3);

    function setUp() public {
        vm.prank(owner);
        sbt = new ReportSBT();
    }

    function test_Mint() public {
        bytes32 analysisId = bytes32(uint256(0x100));
        bytes32 cid = bytes32(uint256(0xabc));

        vm.prank(owner);
        uint256 tokenId = sbt.mint(user, analysisId, cid);

        assertEq(sbt.ownerOf(tokenId), user);
        assertEq(sbt.tokenAnalysis(tokenId), analysisId);
        assertEq(sbt.tokenCid(tokenId), cid);
        assertTrue(sbt.hasMinted(user, analysisId));
    }

    function test_CannotMintSameAnalysisTwice() public {
        bytes32 analysisId = bytes32(uint256(0x100));
        bytes32 cid = bytes32(uint256(0xabc));

        vm.startPrank(owner);
        sbt.mint(user, analysisId, cid);
        vm.expectRevert(abi.encodeWithSelector(ReportSBT.AlreadyMinted.selector, user, analysisId));
        sbt.mint(user, analysisId, cid);
        vm.stopPrank();
    }

    function test_OnlyOwnerCanMint() public {
        vm.prank(other);
        vm.expectRevert();
        sbt.mint(user, bytes32(uint256(0x1)), bytes32(uint256(0x1)));
    }

    function test_CannotTransfer() public {
        vm.prank(owner);
        uint256 tokenId = sbt.mint(user, bytes32(uint256(0x1)), bytes32(uint256(0x1)));

        vm.prank(user);
        vm.expectRevert(ReportSBT.SoulboundTokenCannotTransfer.selector);
        sbt.transferFrom(user, other, tokenId);
    }

    function test_CannotSafeTransfer() public {
        vm.prank(owner);
        uint256 tokenId = sbt.mint(user, bytes32(uint256(0x1)), bytes32(uint256(0x1)));

        vm.prank(user);
        vm.expectRevert(ReportSBT.SoulboundTokenCannotTransfer.selector);
        sbt.safeTransferFrom(user, other, tokenId);
    }

    function test_CanBurn() public {
        vm.prank(owner);
        uint256 tokenId = sbt.mint(user, bytes32(uint256(0x1)), bytes32(uint256(0x1)));

        vm.prank(user);
        sbt.burn(tokenId);
        vm.expectRevert();
        sbt.ownerOf(tokenId);
    }

    function test_TokenURI() public {
        vm.prank(owner);
        uint256 tokenId = sbt.mint(user, bytes32(uint256(0x1)), bytes32(uint256(0xabc)));
        string memory uri = sbt.tokenURI(tokenId);
        assertTrue(bytes(uri).length > 0);
    }

    function test_EventEmitted() public {
        bytes32 analysisId = bytes32(uint256(0x100));
        bytes32 cid = bytes32(uint256(0xabc));
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit ReportSBT.ReportMinted(1, user, analysisId, cid, block.timestamp);
        sbt.mint(user, analysisId, cid);
    }

    function testFuzz_Mint(uint96 seed, address recipient) public {
        vm.assume(recipient != address(0));
        vm.assume(recipient.code.length == 0);
        bytes32 analysisId = bytes32(uint256(seed));
        bytes32 cid = bytes32(uint256(seed) ^ uint256(0xFFFF));

        vm.prank(owner);
        uint256 tokenId = sbt.mint(recipient, analysisId, cid);
        assertEq(sbt.ownerOf(tokenId), recipient);
    }
}
