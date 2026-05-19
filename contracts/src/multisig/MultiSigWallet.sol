// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MultiSigWallet
 * @notice N-of-M multi-signature wallet. Requires `required` out of `owners` approvals
 *         before a transaction can be executed.
 */
contract MultiSigWallet {
    // ---- Custom Errors ----
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
    error CannotRemoveLastOwner();

    // ---- Storage ----
    address[] public owners;
    uint256 public required;
    mapping(address => bool) public isOwner;

    // ---- Events ----
    event WalletCreated(address[] owners, uint256 required);
    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event OwnerAdded(address indexed newOwner);
    event OwnerRemoved(address indexed removedOwner);
    event RequirementChanged(uint256 newRequired);

    // ---- Modifiers ----
    modifier onlyOwner_() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

    // ---- Constructor ----
    constructor(address[] memory _owners, uint256 _required) {
        if (_owners.length == 0) revert InvalidOwner();
        if (_required == 0 || _required > _owners.length) revert InvalidRequired();

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            if (owner == address(0)) revert InvalidOwner();
            if (isOwner[owner]) revert DuplicateOwner();
            isOwner[owner] = true;
            owners.push(owner);
        }

        required = _required;
        emit WalletCreated(_owners, _required);
    }

    // ---- View Functions ----
    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    // ---- Receive Function ----
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }
}
