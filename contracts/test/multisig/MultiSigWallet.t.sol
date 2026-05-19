// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MultiSigWallet} from "../../src/multisig/MultiSigWallet.sol";

contract MultiSigWalletTest is Test {
    MultiSigWallet public wallet;

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
    }

    function test_Deploy_Success() public {
        assertEq(wallet.required(), 2);
        address[] memory owners = wallet.getOwners();
        assertEq(owners.length, 3);
        assertEq(owners[0], owner1);
        assertEq(owners[1], owner2);
        assertEq(owners[2], owner3);
        assertTrue(wallet.isOwner(owner1));
        assertTrue(wallet.isOwner(owner2));
        assertTrue(wallet.isOwner(owner3));
        assertFalse(wallet.isOwner(stranger));
    }

    function test_Deploy_RevertIf_NoOwners() public {
        address[] memory emptyOwners = new address[](0);
        vm.expectRevert(MultiSigWallet.InvalidOwner.selector);
        new MultiSigWallet(emptyOwners, 1);
    }

    function test_Deploy_RevertIf_InvalidRequired_Zero() public {
        address[] memory owners = new address[](2);
        owners[0] = owner1;
        owners[1] = owner2;
        vm.expectRevert(MultiSigWallet.InvalidRequired.selector);
        new MultiSigWallet(owners, 0);
    }

    function test_Deploy_RevertIf_InvalidRequired_TooHigh() public {
        address[] memory owners = new address[](2);
        owners[0] = owner1;
        owners[1] = owner2;
        vm.expectRevert(MultiSigWallet.InvalidRequired.selector);
        new MultiSigWallet(owners, 3);
    }

    function test_Deploy_RevertIf_ZeroAddressOwner() public {
        address[] memory owners = new address[](2);
        owners[0] = owner1;
        owners[1] = address(0);
        vm.expectRevert(MultiSigWallet.InvalidOwner.selector);
        new MultiSigWallet(owners, 2);
    }

    function test_Deploy_RevertIf_DuplicateOwner() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner1; // duplicate
        vm.expectRevert(MultiSigWallet.DuplicateOwner.selector);
        new MultiSigWallet(owners, 2);
    }

    function test_Deposit_EmitsEvent() public {
        vm.deal(stranger, 1 ether);

        vm.prank(stranger);
        vm.expectEmit(true, false, false, true);
        emit MultiSigWallet.Deposit(stranger, 0.5 ether, 0.5 ether);
        (bool ok,) = address(wallet).call{value: 0.5 ether}("");
        assertTrue(ok);
        assertEq(address(wallet).balance, 0.5 ether);
    }

    function test_Deposit_ReceiveFunction() public {
        vm.deal(stranger, 1 ether);

        vm.prank(stranger);
        (bool ok,) = address(wallet).call{value: 0.3 ether}("");
        assertTrue(ok);
        assertEq(address(wallet).balance, 0.3 ether);
    }
}
