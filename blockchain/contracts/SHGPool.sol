// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SHGPool
 * @notice Multi-signature group wallet for Self-Help Groups (SHGs)
 * @dev M-of-N approval required for loan disbursement
 */
contract SHGPool is ReentrancyGuard, AccessControl, Pausable {
    bytes32 public constant LEADER_ROLE = keccak256("LEADER_ROLE");

    IERC20 public immutable usdc;
    uint256 public quorumThreshold;
    string public shgName;
    uint256 public totalDeposited;

    struct Proposal {
        address borrower;
        uint256 amount;
        uint256 approvalCount;
        bool executed;
        bool cancelled;
        uint256 createdAt;
        mapping(address => bool) hasApproved;
    }

    mapping(bytes32 => Proposal) public proposals;
    bytes32[] public proposalIds;

    // Events
    event FundDeposited(address indexed depositor, uint256 amount);
    event FundWithdrawn(address indexed recipient, uint256 amount);
    event LoanProposed(bytes32 indexed proposalId, address indexed borrower, uint256 amount);
    event LoanApproved(bytes32 indexed proposalId, address indexed approver, uint256 approvalCount);
    event QuorumReached(bytes32 indexed proposalId);
    event LoanExecuted(bytes32 indexed proposalId, address indexed borrower, uint256 amount);

    /**
     * @param _members Array of SHG member addresses
     * @param _quorum  Number of approvals required (e.g. 3 of 5)
     * @param _usdc    USDC token address
     * @param _name    SHG group name
     */
    constructor(
        address[] memory _members,
        uint256 _quorum,
        address _usdc,
        string memory _name
    ) {
        require(_members.length >= _quorum, "Quorum > members");
        require(_quorum > 0, "Quorum must be > 0");

        usdc = IERC20(_usdc);
        quorumThreshold = _quorum;
        shgName = _name;

        _grantRole(DEFAULT_ADMIN_ROLE, _members[0]);
        for (uint256 i = 0; i < _members.length; i++) {
            _grantRole(LEADER_ROLE, _members[i]);
        }
    }

    /**
     * @notice Deposit USDC into the pool
     */
    function depositFunds(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        usdc.transferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        emit FundDeposited(msg.sender, amount);
    }

    /**
     * @notice Propose a loan disbursement (leaders only)
     */
    function proposeLoan(address borrower, uint256 amount)
        external
        onlyRole(LEADER_ROLE)
        whenNotPaused
        returns (bytes32 proposalId)
    {
        require(amount > 0, "Amount must be > 0");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient pool funds");

        proposalId = keccak256(abi.encodePacked(borrower, amount, block.timestamp, msg.sender));
        Proposal storage p = proposals[proposalId];
        p.borrower = borrower;
        p.amount = amount;
        p.createdAt = block.timestamp;
        proposalIds.push(proposalId);

        emit LoanProposed(proposalId, borrower, amount);
    }

    /**
     * @notice Approve a pending loan proposal
     */
    function approveLoan(bytes32 proposalId) external onlyRole(LEADER_ROLE) whenNotPaused {
        Proposal storage p = proposals[proposalId];
        require(!p.executed && !p.cancelled, "Proposal no longer active");
        require(!p.hasApproved[msg.sender], "Already approved");

        p.hasApproved[msg.sender] = true;
        p.approvalCount++;

        emit LoanApproved(proposalId, msg.sender, p.approvalCount);

        if (p.approvalCount >= quorumThreshold) {
            emit QuorumReached(proposalId);
        }
    }

    /**
     * @notice Execute a proposal that has reached quorum
     */
    function executeLoan(bytes32 proposalId) external nonReentrant whenNotPaused {
        Proposal storage p = proposals[proposalId];
        require(!p.executed && !p.cancelled, "Already executed or cancelled");
        require(p.approvalCount >= quorumThreshold, "Quorum not reached");

        p.executed = true;
        usdc.transfer(p.borrower, p.amount);

        emit LoanExecuted(proposalId, p.borrower, p.amount);
    }

    /**
     * @notice Get pool USDC balance
     */
    function poolBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Emergency pause
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
