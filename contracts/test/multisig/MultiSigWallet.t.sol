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

    // ---- Submit Transaction Tests ----

    function test_Submit_Success() public {
        vm.prank(owner1);
        uint256 txIndex = wallet.submitTransaction(address(0x10), 1 ether, "");
        assertEq(txIndex, 0);
        assertEq(wallet.getTransactionCount(), 1);

        (address to, uint256 value, bytes memory data, bool executed, uint256 numConfirmations) =
            wallet.getTransaction(0);
        assertEq(to, address(0x10));
        assertEq(value, 1 ether);
        assertEq(data, "");
        assertFalse(executed);
        assertEq(numConfirmations, 1); // submitter auto-approves
    }

    function test_Submit_AutoConfirmsBySubmitter() public {
        vm.prank(owner1);
        wallet.submitTransaction(address(0x10), 0, "");
        assertTrue(wallet.isConfirmed(0, owner1));
    }

    function test_Submit_RevertIf_NotOwner() public {
        vm.prank(stranger);
        vm.expectRevert(MultiSigWallet.NotOwner.selector);
        wallet.submitTransaction(address(0x10), 0, "");
    }

    function test_Submit_IncrementsTxIndex() public {
        vm.startPrank(owner1);
        wallet.submitTransaction(address(0x10), 0, "");
        wallet.submitTransaction(address(0x11), 0, "");
        wallet.submitTransaction(address(0x12), 0, "");
        vm.stopPrank();
        assertEq(wallet.getTransactionCount(), 3);
    }

    function test_Submit_WithCalldata() public {
        bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", owner2, 100);
        vm.prank(owner1);
        uint256 txIndex = wallet.submitTransaction(address(0x10), 0, data);
        (,, bytes memory storedData,,) = wallet.getTransaction(txIndex);
        assertEq(storedData, data);
    }

    function test_Deposit_ReceiveFunction() public {
        vm.deal(stranger, 1 ether);

        vm.prank(stranger);
        (bool ok,) = address(wallet).call{value: 0.3 ether}("");
        assertTrue(ok);
        assertEq(address(wallet).balance, 0.3 ether);
    }
}
