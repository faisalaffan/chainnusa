// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MultiSigWallet
 * @notice N-of-M multi-signature wallet. Requires `required` out of `owners` approvals
 *         before a transaction can be executed.
 */
contract MultiSigWallet {
    error NotOwner();
    error TxNotExist();
    error TxAlreadyExecuted();
    error TxAlreadyConfirmed();
    error NotEnoughConfirmations();
    error NotConfirmed();
    error ExecutionFailed();
    error InvalidOwner();
    error InvalidRequired();
    error DuplicateOwner();
    error OwnerNotFound();
}
