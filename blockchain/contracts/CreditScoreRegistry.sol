// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CreditScoreRegistry
 * @notice Append-only on-chain credit score history per member wallet
 * @dev Only authorized ML_ORACLE_ROLE (backend) can write scores. Public read.
 *      Score range: 300–900 (uint16-safe). Each entry is timestamped.
 *      Used by LoanManager to query borrower creditworthiness.
 */
contract CreditScoreRegistry is AccessControl {
    bytes32 public constant ML_ORACLE_ROLE = keccak256("ML_ORACLE_ROLE");

    struct ScoreEntry {
        uint16 score;           // 300–900 scale
        string riskBand;        // "LOW" / "MEDIUM" / "HIGH"
        uint256 timestamp;
        bytes32 modelVersion;   // Hash of the ML model version
    }

    // member address → historical scores (append-only)
    mapping(address => ScoreEntry[]) private scoreHistory;

    // Latest score per member (quick lookup)
    mapping(address => ScoreEntry) public latestScore;

    // Track total entries for analytics
    uint256 public totalEntries;

    event ScoreRecorded(
        address indexed member,
        uint16 score,
        string riskBand,
        bytes32 modelVersion,
        uint256 timestamp
    );

    /**
     * @param _admin  Admin address (deployer)
     * @param _oracle ML oracle / backend address that writes scores
     */
    constructor(address _admin, address _oracle) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ML_ORACLE_ROLE, _oracle);
    }

    /**
     * @notice Record a new credit score for a member
     * @param member      Wallet address of the SHG member
     * @param score       Credit score (300-900)
     * @param riskBand    "LOW", "MEDIUM", or "HIGH"
     * @param modelVer    Model version hash
     */
    function recordScore(
        address member,
        uint16 score,
        string calldata riskBand,
        bytes32 modelVer
    ) external onlyRole(ML_ORACLE_ROLE) {
        require(score >= 300 && score <= 900, "Score out of range");

        ScoreEntry memory entry = ScoreEntry({
            score: score,
            riskBand: riskBand,
            timestamp: block.timestamp,
            modelVersion: modelVer
        });

        scoreHistory[member].push(entry);
        latestScore[member] = entry;
        totalEntries++;

        emit ScoreRecorded(member, score, riskBand, modelVer, block.timestamp);
    }

    /**
     * @notice Get credit score history for a member
     */
    function getScoreHistory(address member)
        external
        view
        returns (ScoreEntry[] memory)
    {
        return scoreHistory[member];
    }

    /**
     * @notice Get number of score entries for a member
     */
    function getScoreCount(address member) external view returns (uint256) {
        return scoreHistory[member].length;
    }

    /**
     * @notice Get the latest score for a member (convenience)
     */
    function getLatestScore(address member) external view returns (uint16 score, string memory riskBand) {
        ScoreEntry storage entry = latestScore[member];
        return (entry.score, entry.riskBand);
    }
}
