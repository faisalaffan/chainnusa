// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AnalysisRegistry
 * @notice On-chain registry for wallet analysis proofs.
 * Stores CID of analysis JSON pinned to IPFS.
 * Emits event so frontend can index analysis history per address.
 */
contract AnalysisRegistry is Ownable {
    struct AnalysisRecord {
        bytes32 cidBytes;
        uint256 timestamp;
        uint256 chainId;
        address indexedWallet;
        address analyst; // who submitted (could be wallet or relayer)
    }

    /// @notice analysisId → record
    mapping(bytes32 => AnalysisRecord) public records;
    /// @notice wallet → analysis count
    mapping(address => uint256) public analysisCount;
    /// @notice wallet → analysisIds[]
    mapping(address => bytes32[]) public analysesByWallet;
    /// @notice total analyses recorded
    uint256 public totalAnalyses;

    event AnalysisRecorded(
        bytes32 indexed analysisId,
        address indexed indexedWallet,
        bytes32 cidBytes,
        uint256 chainId,
        address analyst,
        uint256 timestamp
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Record an analysis result on-chain.
     * @param cidBytes The IPFS CID (32-byte hash portion of CIDv1).
     * @param chainId Chain where the analyzed wallet operates.
     * @param indexedWallet The wallet address being analyzed.
     * @return analysisId Unique ID for this analysis record.
     */
    function recordAnalysis(
        bytes32 cidBytes,
        uint256 chainId,
        address indexedWallet
    ) external returns (bytes32 analysisId) {
        require(cidBytes != bytes32(0), "Empty CID");
        require(indexedWallet != address(0), "Zero address");

        analysisId = keccak256(
            abi.encodePacked(block.chainid, indexedWallet, cidBytes, block.timestamp, msg.sender)
        );

        records[analysisId] = AnalysisRecord({
            cidBytes: cidBytes,
            timestamp: block.timestamp,
            chainId: chainId,
            indexedWallet: indexedWallet,
            analyst: msg.sender
        });

        analysesByWallet[indexedWallet].push(analysisId);
        unchecked {
            analysisCount[indexedWallet]++;
            totalAnalyses++;
        }

        emit AnalysisRecorded(
            analysisId, indexedWallet, cidBytes, chainId, msg.sender, block.timestamp
        );
    }

    /**
     * @notice Get all analysis IDs for a wallet.
     */
    function getAnalysesForWallet(address wallet) external view returns (bytes32[] memory) {
        return analysesByWallet[wallet];
    }

    /**
     * @notice Get count of analyses for a wallet.
     */
    function getAnalysisCount(address wallet) external view returns (uint256) {
        return analysisCount[wallet];
    }
}
