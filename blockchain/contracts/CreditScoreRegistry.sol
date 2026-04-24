// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CreditScoreRegistry
 * @notice Immutable on-chain credit score history per member wallet
 * @dev Only authorized ML Oracle can write scores. Public read for transparency.
 */
contract CreditScoreRegistry is AccessControl {
    bytes32 public constant ML_ORACLE_ROLE = keccak256("ML_ORACLE_ROLE");

    struct ScoreEntry {
        uint256 score;       // 300–900 scale
        string riskBand;     // LOW / MEDIUM / HIGH
        uint256 timestamp;
        bytes32 modelVersion;
    }

    // member address → historical scores
    mapping(address => ScoreEntry[]) private scoreHistory;

    // Latest score per member (for quick lookup)
    mapping(address => ScoreEntry) public latestScore;

    event ScoreRecorded(
        address indexed member,
        uint256 score,
        string riskBand,
        uint256 timestamp
    );

    constructor(address admin, address oracle) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ML_ORACLE_ROLE, oracle);
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
        uint256 score,
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

        emit ScoreRecorded(member, score, riskBand, block.timestamp);
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
}
