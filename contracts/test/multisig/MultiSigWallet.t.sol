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

    // ---- Confirm Transaction Tests ----

    function test_Confirm_Success() public {
        vm.prank(owner1);
        wallet.submitTransaction(address(0x10), 1 ether, "");

        vm.prank(owner2);
        wallet.confirmTransaction(0);

        assertTrue(wallet.isConfirmed(0, owner2));
        (,,, bool executed, uint256 numConfirmations) = wallet.getTransaction(0);
        assertFalse(executed);
        assertEq(numConfirmations, 2);
    }

    function test_Confirm_RevertIf_NotOwner() public {
        vm.prank(owner1);
        wallet.submitTransaction(address(0x10), 0, "");

        vm.prank(stranger);
        vm.expectRevert(MultiSigWallet.NotOwner.selector);
        wallet.confirmTransaction(0);
    }

    function test_Confirm_RevertIf_AlreadyConfirmed() public {
        vm.prank(owner1);
        wallet.submitTransaction(address(0x10), 0, "");

        vm.prank(owner2);
        wallet.confirmTransaction(0);

        vm.prank(owner2);
        vm.expectRevert(MultiSigWallet.TxAlreadyConfirmed.selector);
        wallet.confirmTransaction(0);
    }

    function test_Confirm_RevertIf_TxNotExist() public {
        vm.prank(owner1);
        vm.expectRevert(MultiSigWallet.TxNotExist.selector);
        wallet.confirmTransaction(99);
    }

    function test_GetConfirmationCount() public {
        vm.prank(owner1);
        wallet.submitTransaction(address(0x10), 0, "");

        (,,, bool executed, uint256 count) = wallet.getTransaction(0);
        assertFalse(executed);
        assertEq(count, 1);

        vm.prank(owner2);
        wallet.confirmTransaction(0);

        (,,, bool executed2, uint256 count2) = wallet.getTransaction(0);
        assertFalse(executed2);
        assertEq(count2, 2);
    }

    // ---- Execute Transaction Tests ----

    function test_Execute_Success_ETHTransfer() public {
        // Fund the wallet
        vm.deal(address(wallet), 2 ether);

        // Owner1 submits a transfer to recipient
        address recipient = address(0x50);
        vm.prank(owner1);
        wallet.submitTransaction(recipient, 1 ether, "");

        // Owner2 confirms
        vm.prank(owner2);
        wallet.confirmTransaction(0);

        uint256 recipientBalBefore = recipient.balance;

        // Anyone can execute once threshold met
        vm.prank(stranger);
        wallet.executeTransaction(0);

        assertEq(recipient.balance, recipientBalBefore + 1 ether);
        (,,, bool executed,) = wallet.getTransaction(0);
        assertTrue(executed);
    }

    function test_Execute_RevertIf_NotEnoughConfirmations() public {
        vm.deal(address(wallet), 1 ether);
        vm.prank(owner1);
        wallet.submitTransaction(address(0x50), 0.5 ether, "");

        // Only 1 of 2 required
        vm.prank(owner1);
        vm.expectRevert(MultiSigWallet.NotEnoughConfirmations.selector);
        wallet.executeTransaction(0);
    }

    function test_Execute_RevertIf_AlreadyExecuted() public {
        vm.deal(address(wallet), 1 ether);
        vm.prank(owner1);
        wallet.submitTransaction(address(0x50), 0.5 ether, "");

        vm.prank(owner2);
        wallet.confirmTransaction(0);

        vm.prank(owner1);
        wallet.executeTransaction(0);

        vm.prank(owner1);
        vm.expectRevert(MultiSigWallet.TxAlreadyExecuted.selector);
        wallet.executeTransaction(0);
    }

    function test_Execute_RevertIf_TxNotExist() public {
        vm.prank(owner1);
        vm.expectRevert(MultiSigWallet.TxNotExist.selector);
        wallet.executeTransaction(99);
    }

    function test_Execute_CanBeCalledByAnyone() public {
        vm.deal(address(wallet), 1 ether);
        vm.prank(owner1);
        wallet.submitTransaction(address(0x50), 0.5 ether, "");

        vm.prank(owner2);
        wallet.confirmTransaction(0);

        // Stranger executes
        vm.prank(stranger);
        wallet.executeTransaction(0);

        (,,, bool executed,) = wallet.getTransaction(0);
        assertTrue(executed);
    }

    function test_Execute_FailedCall_DoesNotMarkExecuted() public {
        vm.deal(address(wallet), 1 ether);
        // Submit tx to send more than balance — will fail
        vm.prank(owner1);
        wallet.submitTransaction(address(0x50), 2 ether, ""); // more than balance

        vm.prank(owner2);
        wallet.confirmTransaction(0);

        vm.prank(owner1);
        // Should revert due to insufficient balance
        vm.expectRevert(MultiSigWallet.ExecutionFailed.selector);
        wallet.executeTransaction(0);

        (,,, bool executed,) = wallet.getTransaction(0);
        assertFalse(executed);
    }

    function test_Execute_WithCalldata() public {
        // Deploy a simple receiver contract
        TestReceiver receiver = new TestReceiver();
        vm.deal(address(wallet), 1 ether);

        bytes memory data = abi.encodeWithSignature("receiveData(uint256)", 42);
        vm.prank(owner1);
        wallet.submitTransaction(address(receiver), 0, data);

        vm.prank(owner2);
        wallet.confirmTransaction(0);

        vm.prank(owner1);
        wallet.executeTransaction(0);

        assertEq(receiver.lastValue(), 42);
    }

    // ---- Revoke Confirmation Tests ----

    function test_Revoke_Success() public {
        vm.prank(owner1);
        wallet.submitTransaction(address(0x10), 1 ether, "");

        assertTrue(wallet.isConfirmed(0, owner1));

        vm.prank(owner1);
        wallet.revokeConfirmation(0);

        assertFalse(wallet.isConfirmed(0, owner1));
        (,,, bool executed, uint256 numConfirmations) = wallet.getTransaction(0);
        assertFalse(executed);
        assertEq(numConfirmations, 0);
    }

    function test_Revoke_RevertIf_NotConfirmed() public {
        vm.prank(owner1);
        wallet.submitTransaction(address(0x10), 0, "");

        vm.prank(owner2);
        vm.expectRevert(MultiSigWallet.NotConfirmed.selector);
        wallet.revokeConfirmation(0);
    }

    function test_Revoke_RevertIf_TxNotExist() public {
        vm.prank(owner1);
        vm.expectRevert(MultiSigWallet.TxNotExist.selector);
        wallet.revokeConfirmation(99);
    }

    function test_Revoke_RevertIf_AlreadyExecuted() public {
        vm.deal(address(wallet), 1 ether);
        vm.prank(owner1);
        wallet.submitTransaction(address(owner1), 1 ether, "");

        vm.prank(owner2);
        wallet.confirmTransaction(0);

        vm.prank(owner1);
        wallet.executeTransaction(0);

        vm.prank(owner2);
        vm.expectRevert(MultiSigWallet.TxAlreadyExecuted.selector);
        wallet.revokeConfirmation(0);
    }

    function test_Revoke_AndReapprove() public {
        vm.prank(owner1);
        wallet.submitTransaction(address(0x10), 1 ether, "");

        vm.prank(owner2);
        wallet.confirmTransaction(0);

        // Owner2 revokes
        vm.prank(owner2);
        wallet.revokeConfirmation(0);
        (,,, bool executed, uint256 count) = wallet.getTransaction(0);
        assertFalse(executed);
        assertEq(count, 1);

        // Owner2 re-approves
        vm.prank(owner2);
        wallet.confirmTransaction(0);
        (,,, bool executed2, uint256 count2) = wallet.getTransaction(0);
        assertFalse(executed2);
        assertEq(count2, 2);
    }

    function test_FullFlow_2of3_Wallet() public {
        // Setup: 2-of-3 wallet, funded with 3 ETH
        vm.deal(address(wallet), 3 ether);
        address alice = owner1;
        address bob = owner2;
        address charlie = owner3;
        address recipient = address(0x50);

        // Alice submits: send 1.5 ETH to recipient
        vm.prank(alice);
        uint256 tx1 = wallet.submitTransaction(recipient, 1.5 ether, "");
        assertEq(tx1, 0);

        // Bob submits: send 0.5 ETH to recipient
        vm.prank(bob);
        uint256 tx2 = wallet.submitTransaction(recipient, 0.5 ether, "");
        assertEq(tx2, 1);

        // Charlie confirms tx1
        vm.prank(charlie);
        wallet.confirmTransaction(0);

        // Execute tx1 (alice + charlie = 2)
        uint256 recipientBalBefore = recipient.balance;
        vm.prank(alice);
        wallet.executeTransaction(0);
        assertEq(recipient.balance, recipientBalBefore + 1.5 ether);

        // Alice confirms tx2
        vm.prank(alice);
        wallet.confirmTransaction(1);

        // Execute tx2 (bob + alice = 2)
        vm.prank(bob);
        wallet.executeTransaction(1);
        assertEq(recipient.balance, recipientBalBefore + 2 ether);

        // Wallet balance should be 1 ETH
        assertEq(address(wallet).balance, 1 ether);
        assertEq(wallet.getTransactionCount(), 2);
    }
}

contract TestReceiver {
    uint256 public lastValue;

    function receiveData(uint256 value) external {
        lastValue = value;
    }

    receive() external payable {}
}
