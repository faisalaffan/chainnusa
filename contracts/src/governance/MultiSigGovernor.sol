// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MultiSigWallet} from "../multisig/MultiSigWallet.sol";
import {AnalysisRegistry} from "../AnalysisRegistry.sol";
import {ReportSBT} from "../ReportSBT.sol";

/**
 * @title MultiSigGovernor
 * @notice Governance adapter that routes multi-sig proposals to ChainNusa contracts.
 *         Only owners of the linked MultiSigWallet can submit governance proposals.
 *         Proposals are executed through the MultiSigWallet's approve-execute flow.
 */
contract MultiSigGovernor {
    MultiSigWallet public immutable wallet;
    AnalysisRegistry public immutable registry;
    ReportSBT public immutable sbt;

    error NotWalletOwner();
    error ZeroAddress();

    modifier onlyWalletOwner() {
        if (!wallet.isOwner(msg.sender)) revert NotWalletOwner();
        _;
    }

    constructor(address _wallet, address _registry, address _sbt) {
        if (_wallet == address(0) || _registry == address(0) || _sbt == address(0)) {
            revert ZeroAddress();
        }
        wallet = MultiSigWallet(payable(_wallet));
        registry = AnalysisRegistry(_registry);
        sbt = ReportSBT(_sbt);
    }

    /**
     * @notice Submit a proposal to record an analysis on-chain.
     * @return txIndex Index of the proposal in the MultiSigWallet.
     */
    function proposeRecordAnalysis(
        bytes32 cidBytes,
        uint256 chainId,
        address indexedWallet
    ) external onlyWalletOwner returns (uint256 txIndex) {
        bytes memory data = abi.encodeWithSelector(
            AnalysisRegistry.recordAnalysis.selector,
            cidBytes,
            chainId,
            indexedWallet
        );
        txIndex = wallet.submitTransaction(address(registry), 0, data);
    }

    /**
     * @notice Submit a proposal to mint a ReportSBT.
     * @return txIndex Index of the proposal in the MultiSigWallet.
     */
    function proposeMintSBT(
        address to,
        bytes32 analysisId,
        bytes32 cidBytes
    ) external onlyWalletOwner returns (uint256 txIndex) {
        bytes memory data = abi.encodeWithSelector(
            ReportSBT.mint.selector,
            to,
            analysisId,
            cidBytes
        );
        txIndex = wallet.submitTransaction(address(sbt), 0, data);
    }
}
