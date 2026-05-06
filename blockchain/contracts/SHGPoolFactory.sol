// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./SHGPool.sol";

/**
 * @title SHGPoolFactory
 * @notice Factory contract to deploy new SHGPool instances
 * @dev Creates deterministic SHGPool addresses. Maintains a registry of all deployed pools.
 *      Backend calls createPool() when a new SHG group is formed off-chain.
 */
contract SHGPoolFactory is AccessControl {
    bytes32 public constant BACKEND_ROLE = keccak256("BACKEND_ROLE");

    // ─── Registry ───────────────────────────────────────────────
    address[] public deployedPools;
    mapping(address => bool) public isPool;
    mapping(string => address) public poolByName;  // SHG name → pool address

    address public loanManagerAddress;
    address public backendWallet;

    // ─── Events ─────────────────────────────────────────────────
    event PoolCreated(
        address indexed poolAddress,
        string shgName,
        uint256 quorum,
        uint256 memberCount,
        uint256 timestamp
    );

    /**
     * @param _loanManager   Address of the LoanManager contract
     * @param _backendWallet Backend wallet address (gets BACKEND_ROLE on each pool)
     */
    constructor(address _loanManager, address _backendWallet) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BACKEND_ROLE, _backendWallet);
        loanManagerAddress = _loanManager;
        backendWallet = _backendWallet;
    }

    /**
     * @notice Deploy a new SHGPool contract for a Self-Help Group
     * @param members  Array of member wallet addresses
     * @param quorum   Number of approvals needed (M-of-N)
     * @param name     SHG group name
     * @return pool    Address of the deployed SHGPool
     */
    function createPool(
        address[] calldata members,
        uint256 quorum,
        string calldata name
    ) external onlyRole(BACKEND_ROLE) returns (address pool) {
        require(bytes(name).length > 0, "Name required");
        require(poolByName[name] == address(0), "Pool name already exists");

        SHGPool newPool = new SHGPool(members, quorum, name, backendWallet);
        pool = address(newPool);

        deployedPools.push(pool);
        isPool[pool] = true;
        poolByName[name] = pool;

        emit PoolCreated(pool, name, quorum, members.length, block.timestamp);
    }

    /**
     * @notice Get total number of deployed pools
     */
    function poolCount() external view returns (uint256) {
        return deployedPools.length;
    }

    /**
     * @notice Get all deployed pool addresses
     */
    function getAllPools() external view returns (address[] memory) {
        return deployedPools;
    }

    /**
     * @notice Update the LoanManager address (admin only)
     */
    function setLoanManager(address _loanManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        loanManagerAddress = _loanManager;
    }

    /**
     * @notice Update the backend wallet (admin only)
     */
    function setBackendWallet(address _backendWallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        backendWallet = _backendWallet;
    }
}
