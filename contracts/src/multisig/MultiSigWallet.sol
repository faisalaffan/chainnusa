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

    // ---- Transaction Storage ----
    struct Transaction {
        address to;
        uint96 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
    }

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public isConfirmed;

    event SubmitTransaction(
        address indexed owner,
        uint256 indexed txIndex,
        address indexed to,
        uint256 value,
        bytes data
    );

    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);

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

    // ---- Transaction Functions ----
    function submitTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlyOwner_ returns (uint256 txIndex) {
        txIndex = transactions.length;
        transactions.push(
            Transaction({
                to: to,
                value: uint96(value),
                data: data,
                executed: false,
                numConfirmations: 1
            })
        );
        isConfirmed[txIndex][msg.sender] = true;

        emit SubmitTransaction(msg.sender, txIndex, to, value, data);
    }

    function confirmTransaction(
        uint256 txIndex
    ) external onlyOwner_ {
        if (txIndex >= transactions.length) revert TxNotExist();
        if (transactions[txIndex].executed) revert TxAlreadyExecuted();
        if (isConfirmed[txIndex][msg.sender]) revert TxAlreadyConfirmed();

        isConfirmed[txIndex][msg.sender] = true;
        unchecked {
            transactions[txIndex].numConfirmations++;
        }

        emit ConfirmTransaction(msg.sender, txIndex);
    }

    function revokeConfirmation(
        uint256 txIndex
    ) external onlyOwner_ {
        if (txIndex >= transactions.length) revert TxNotExist();
        if (transactions[txIndex].executed) revert TxAlreadyExecuted();
        if (!isConfirmed[txIndex][msg.sender]) revert NotConfirmed();

        isConfirmed[txIndex][msg.sender] = false;
        unchecked {
            transactions[txIndex].numConfirmations--;
        }

        emit RevokeConfirmation(msg.sender, txIndex);
    }

    // ---- Owner Management Functions ----

    function addOwner(address newOwner) external {
        if (newOwner == address(0)) revert InvalidOwner();
        if (isOwner[newOwner]) revert DuplicateOwner();

        isOwner[newOwner] = true;
        owners.push(newOwner);

        emit OwnerAdded(newOwner);
    }

    function removeOwner(address owner) external {
        if (!isOwner[owner]) revert OwnerNotFound();
        if (owners.length == 1) revert CannotRemoveLastOwner();

        isOwner[owner] = false;

        // Remove from array — order doesn't matter, swap and pop
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                owners.pop();
                break;
            }
        }

        if (required > owners.length) revert InvalidRequired();

        emit OwnerRemoved(owner);
    }

    function changeRequirement(uint256 newRequired) external {
        if (newRequired == 0 || newRequired > owners.length) revert InvalidRequired();
        required = newRequired;
        emit RequirementChanged(newRequired);
    }

    function executeTransaction(
        uint256 txIndex
    ) external {
        if (txIndex >= transactions.length) revert TxNotExist();
        Transaction storage t = transactions[txIndex];

        if (t.executed) revert TxAlreadyExecuted();
        if (t.numConfirmations < required) revert NotEnoughConfirmations();

        // Checks-Effects-Interactions pattern
        t.executed = true;

        (bool success, bytes memory returnData) = t.to.call{value: t.value}(t.data);
        if (!success) {
            // Propagate the revert reason from the internal call
            if (returnData.length > 0) {
                assembly {
                    revert(add(returnData, 32), mload(returnData))
                }
            } else {
                revert ExecutionFailed();
            }
        }

        emit ExecuteTransaction(msg.sender, txIndex);
    }

    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getTransaction(
        uint256 txIndex
    )
        external
        view
        returns (address to, uint256 value, bytes memory data, bool executed, uint256 numConfirmations)
    {
        if (txIndex >= transactions.length) revert TxNotExist();
        Transaction storage t = transactions[txIndex];
        return (t.to, t.value, t.data, t.executed, t.numConfirmations);
    }

    // ---- Receive Function ----
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }
}
