// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReportSBT
 * @notice Soulbound NFT (non-transferable) representing an on-chain wallet analysis report.
 * Bound to a specific analysisId and wallet address.
 * Cannot be transferred — permanent credential.
 */
contract ReportSBT is ERC721, Ownable {
    uint256 private _nextTokenId;

    /// @notice tokenId → analysisId
    mapping(uint256 => bytes32) public tokenAnalysis;
    /// @notice tokenId → IPFS CID bytes
    mapping(uint256 => bytes32) public tokenCid;
    /// @notice wallet → has minted (only 1 SBT per analysis ID)
    mapping(address => mapping(bytes32 => bool)) public hasMinted;

    error SoulboundTokenCannotTransfer();
    error AlreadyMinted(address wallet, bytes32 analysisId);

    event ReportMinted(
        uint256 indexed tokenId,
        address indexed to,
        bytes32 indexed analysisId,
        bytes32 cidBytes,
        uint256 timestamp
    );

    constructor() ERC721("ChainNusa Report SBT", "cREPORT") Ownable(msg.sender) {}

    /**
     * @notice Mint a soulbound report token to a wallet.
     * @param to Recipient wallet (typically the analyzed address).
     * @param analysisId Analysis ID from AnalysisRegistry.
     * @param cidBytes IPFS CID of the analysis JSON.
     * @return tokenId The minted token ID.
     */
    function mint(
        address to,
        bytes32 analysisId,
        bytes32 cidBytes
    ) external onlyOwner returns (uint256 tokenId) {
        require(to != address(0), "Zero address");
        require(analysisId != bytes32(0), "Empty analysisId");
        if (hasMinted[to][analysisId]) revert AlreadyMinted(to, analysisId);

        tokenId = ++_nextTokenId;
        _mint(to, tokenId);

        tokenAnalysis[tokenId] = analysisId;
        tokenCid[tokenId] = cidBytes;
        hasMinted[to][analysisId] = true;

        emit ReportMinted(tokenId, to, analysisId, cidBytes, block.timestamp);
    }

    /**
     * @notice Get the current token ID counter.
     */
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    // ---- Soulbound enforcement ----

    /**
     * @dev Override _update to block transfers (allow only mint/burn).
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Allow mint (from=0) and burn (to=0), block everything else
        if (from != address(0) && to != address(0)) {
            revert SoulboundTokenCannotTransfer();
        }
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Block standard transfer functions explicitly.
     */
    function transferFrom(address, address, uint256) public pure override {
        revert SoulboundTokenCannotTransfer();
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert SoulboundTokenCannotTransfer();
    }

    // ---- View helpers ----

    /**
     * @notice Get the token URI pointing to IPFS (via gateway).
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        bytes32 cid = tokenCid[tokenId];
        return string(abi.encodePacked("ipfs://", _cidToString(cid)));
    }

    function _cidToString(bytes32 cid) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            str[i * 2] = hexChars[uint8(cid[i] >> 4)];
            str[i * 2 + 1] = hexChars[uint8(cid[i] & 0x0f)];
        }
        return string(str);
    }
}
