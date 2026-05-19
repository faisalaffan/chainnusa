// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MultiSigWallet} from "../../src/multisig/MultiSigWallet.sol";

contract MultiSigWalletFuzzTest is Test {
    MultiSigWallet public wallet;
    address public owner1 = address(0x1);
    address public owner2 = address(0x2);
    address public owner3 = address(0x3);

    function setUp() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;
        wallet = new MultiSigWallet(owners, 2);
        vm.deal(address(wallet), 100 ether);
    }

    /// forge-config: default.fuzz.runs = 500
    function testFuzz_Submit_AnyCalldata(address to, uint96 value) public {
        vm.assume(to != address(0));

        bytes memory data = abi.encode(value);
        vm.prank(owner1);
        uint256 idx = wallet.submitTransaction(to, value, data);

        (address storedTo, uint256 storedValue, bytes memory storedData,,) =
            wallet.getTransaction(idx);
        assertEq(storedTo, to);
        assertEq(storedValue, value);
        assertEq(storedData, data);
    }

    /// forge-config: default.fuzz.runs = 200
    function testFuzz_Required_ValidRange(uint8 required, uint8 ownerCount) public {
        vm.assume(ownerCount >= 1 && ownerCount <= 10);
        vm.assume(required >= 1 && required <= ownerCount);

        address[] memory owners = new address[](ownerCount);
        for (uint8 i = 0; i < ownerCount; i++) {
            owners[i] = address(uint160(uint256(keccak256(abi.encode(i)))));
        }

        MultiSigWallet w = new MultiSigWallet(owners, required);
        assertEq(w.required(), required);
        assertEq(w.getOwners().length, ownerCount);
    }

    /// forge-config: default.fuzz.runs = 200
    function testFuzz_Execute_ETHTransfer(uint96 value) public {
        vm.assume(value > 0 && value <= 100 ether);

        vm.prank(owner1);
        wallet.submitTransaction(owner2, value, "");

        vm.prank(owner2);
        wallet.confirmTransaction(0);

        uint256 balBefore = owner2.balance;
        wallet.executeTransaction(0);
        assertEq(owner2.balance, balBefore + value);
    }

    /// forge-config: default.fuzz.runs = 200
    function testFuzz_RevokeAndReconfirm(uint96 value) public {
        vm.assume(value <= 100 ether);

        vm.prank(owner1);
        wallet.submitTransaction(owner2, value, "");

        // Owner1 revokes his auto-confirmation
        vm.prank(owner1);
        wallet.revokeConfirmation(0);
        (,,, bool executed, uint256 count) = wallet.getTransaction(0);
        assertFalse(executed);
        assertEq(count, 0);

        // Owner1 re-confirms, owner2 confirms
        vm.prank(owner1);
        wallet.confirmTransaction(0);
        vm.prank(owner2);
        wallet.confirmTransaction(0);

        // Execute
        wallet.executeTransaction(0);
        (,,, bool execed,) = wallet.getTransaction(0);
        assertTrue(execed);
    }
}
