// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SHGPool
 * @notice Multi-signature group wallet for Self-Help Groups (SHGs) — INR-native
 * @dev No ERC-20 tokens. All amounts are INR in paise (₹25,000 = 2500000 paise).
 *      On-chain = immutable audit trail via events. Off-chain = actual INR accounting.
 *      M-of-N approval required for loan proposals. Backend calls executeLoan
 *      after confirming INR has been disbursed off-chain (double-auth).
 */
contract SHGPool is ReentrancyGuard, AccessControl, Pausable {
    bytes32 public constant LEADER_ROLE = keccak256("LEADER_ROLE");
    bytes32 public constant BACKEND_ROLE = keccak256("BACKEND_ROLE");

    // ─── Pool Identity ──────────────────────────────────────────
    string public shgName;
    uint256 public quorumThreshold;
    address[] public members;
    uint256 public memberCount;

    // ─── Proposal State ─────────────────────────────────────────
    enum ProposalStatus { PENDING, QUORUM_REACHED, EXECUTED, CANCELLED }

    struct Proposal {
        address borrower;
        uint256 amountPaise;        // INR in paise (e.g., 2500000 = ₹25,000)
        uint256 tenureMonths;
        uint256 approvalCount;
        ProposalStatus status;
        uint256 createdAt;
        mapping(address => bool) hasApproved;
    }

    mapping(bytes32 => Proposal) private proposals;
    bytes32[] public proposalIds;

    // ─── Proposal View (for external reads) ────────────────────
    struct ProposalView {
        bytes32 proposalId;
        address borrower;
        uint256 amountPaise;
        uint256 tenureMonths;
        uint256 approvalCount;
        ProposalStatus status;
        uint256 createdAt;
    }

    // ─── Events (audit trail — backend reconciles against these) ─
    event MemberAdded(address indexed member, uint256 timestamp);
    event MemberRemoved(address indexed member, uint256 timestamp);
    event LoanProposed(
        bytes32 indexed proposalId,
        address indexed borrower,
        uint256 amountPaise,
        uint256 tenureMonths,
        uint256 timestamp
    );
    event LoanApproved(
        bytes32 indexed proposalId,
        address indexed approver,
        uint256 approvalCount,
        uint256 timestamp
    );
    event QuorumReached(bytes32 indexed proposalId, uint256 timestamp);
    event LoanExecuted(
        bytes32 indexed proposalId,
        address indexed borrower,
        uint256 amountPaise,
        uint256 timestamp
    );
    event ProposalCancelled(bytes32 indexed proposalId, uint256 timestamp);

    // ─── Errors ─────────────────────────────────────────────────
    error InvalidQuorum(uint256 quorum, uint256 memberCount);
    error ZeroAmount();
    error ZeroTenure();
    error ProposalNotActive(bytes32 proposalId);
    error AlreadyApproved(bytes32 proposalId, address approver);
    error QuorumNotReached(bytes32 proposalId);
    error AlreadyMember(address member);
    error NotMember(address member);
    error CannotRemoveLastMember();

    // ─── Quorum recompute event (audit trail) ────────────────────
    event QuorumChanged(uint256 oldQuorum, uint256 newQuorum, uint256 memberCount, uint256 timestamp);

    /**
     * @param _members Initial SHG member addresses (first member gets ADMIN)
     * @param _quorum  Number of approvals required (e.g., 3 of 5)
     * @param _name    SHG group name
     * @param _backend Backend wallet address for executeLoan
     */
    constructor(
        address[] memory _members,
        uint256 _quorum,
        string memory _name,
        address _backend
    ) {
        if (_members.length < _quorum || _quorum == 0) {
            revert InvalidQuorum(_quorum, _members.length);
        }

        shgName = _name;
        quorumThreshold = _quorum;

        _grantRole(DEFAULT_ADMIN_ROLE, _members[0]);
        _grantRole(BACKEND_ROLE, _backend);

        for (uint256 i = 0; i < _members.length; i++) {
            _grantRole(LEADER_ROLE, _members[i]);
            members.push(_members[i]);
            emit MemberAdded(_members[i], block.timestamp);
        }
        memberCount = _members.length;
    }

    // ─────────────────────────────────────────────────────────────
    // LOAN PROPOSAL LIFECYCLE
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Propose a loan for a borrower (leaders only)
     * @param borrower  Borrower wallet address
     * @param amountPaise Loan amount in INR paise (e.g., 2500000 = ₹25,000)
     * @param tenureMonths Loan tenure in months
     * @return proposalId Unique proposal identifier
     */
    function proposeLoan(
        address borrower,
        uint256 amountPaise,
        uint256 tenureMonths
    )
        external
        onlyRole(LEADER_ROLE)
        whenNotPaused
        returns (bytes32 proposalId)
    {
        if (amountPaise == 0) revert ZeroAmount();
        if (tenureMonths == 0) revert ZeroTenure();

        proposalId = keccak256(
            abi.encodePacked(borrower, amountPaise, tenureMonths, block.timestamp, msg.sender)
        );

        Proposal storage p = proposals[proposalId];
        p.borrower = borrower;
        p.amountPaise = amountPaise;
        p.tenureMonths = tenureMonths;
        p.status = ProposalStatus.PENDING;
        p.createdAt = block.timestamp;
        proposalIds.push(proposalId);

        emit LoanProposed(proposalId, borrower, amountPaise, tenureMonths, block.timestamp);
    }

    /**
     * @notice Approve a pending loan proposal (leaders only, one vote per leader)
     * @param proposalId The proposal to approve
     */
    function approveLoan(bytes32 proposalId) external onlyRole(LEADER_ROLE) whenNotPaused {
        Proposal storage p = proposals[proposalId];
        if (p.status != ProposalStatus.PENDING) revert ProposalNotActive(proposalId);
        if (p.hasApproved[msg.sender]) revert AlreadyApproved(proposalId, msg.sender);

        p.hasApproved[msg.sender] = true;
        p.approvalCount++;

        emit LoanApproved(proposalId, msg.sender, p.approvalCount, block.timestamp);

        if (p.approvalCount >= quorumThreshold) {
            p.status = ProposalStatus.QUORUM_REACHED;
            emit QuorumReached(proposalId, block.timestamp);
        }
    }

    /**
     * @notice Execute a proposal after quorum reached AND backend confirms INR disbursement
     * @dev Double-auth: on-chain quorum + off-chain INR disbursement trigger.
     *      Backend calls this AFTER the INR has been sent to borrower via UPI/bank.
     *      No tokens move on-chain — this is purely an immutable record.
     * @param proposalId The approved proposal to execute
     */
    function executeLoan(bytes32 proposalId) external onlyRole(BACKEND_ROLE) whenNotPaused {
        Proposal storage p = proposals[proposalId];
        if (p.status != ProposalStatus.QUORUM_REACHED) revert QuorumNotReached(proposalId);

        p.status = ProposalStatus.EXECUTED;

        emit LoanExecuted(proposalId, p.borrower, p.amountPaise, block.timestamp);
    }

    /**
     * @notice Cancel a pending proposal (admin only)
     * @param proposalId The proposal to cancel
     */
    function cancelProposal(bytes32 proposalId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Proposal storage p = proposals[proposalId];
        if (p.status != ProposalStatus.PENDING && p.status != ProposalStatus.QUORUM_REACHED) {
            revert ProposalNotActive(proposalId);
        }
        p.status = ProposalStatus.CANCELLED;
        emit ProposalCancelled(proposalId, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    // MEMBER MANAGEMENT
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Add a new member to the SHG
     * @dev Callable by BACKEND_ROLE so the backend relayer can sync off-chain joins.
     *      Quorum is automatically recomputed to simple majority (memberCount/2 + 1).
     */
    function addMember(address member) external onlyRole(BACKEND_ROLE) {
        if (hasRole(LEADER_ROLE, member)) revert AlreadyMember(member);
        _grantRole(LEADER_ROLE, member);
        members.push(member);
        memberCount++;
        emit MemberAdded(member, block.timestamp);
        _recomputeQuorum();
    }

    /**
     * @notice Remove a member from the SHG
     * @dev Callable by BACKEND_ROLE. Compacts the members array via swap-and-pop
     *      so getMembers() never returns stale entries. Cannot remove the last member.
     *      Quorum is automatically recomputed.
     */
    function removeMember(address member) external onlyRole(BACKEND_ROLE) {
        if (!hasRole(LEADER_ROLE, member)) revert NotMember(member);
        if (memberCount <= 1) revert CannotRemoveLastMember();

        _revokeRole(LEADER_ROLE, member);
        _removeFromMembersArray(member);
        memberCount--;
        emit MemberRemoved(member, block.timestamp);
        _recomputeQuorum();
    }

    /**
     * @notice Admin override of the auto-computed quorum (e.g. require unanimous).
     * @dev Must be 1 ≤ quorum ≤ memberCount. Use sparingly — default majority is preferred.
     */
    function setQuorum(uint256 newQuorum) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newQuorum == 0 || newQuorum > memberCount) {
            revert InvalidQuorum(newQuorum, memberCount);
        }
        uint256 old = quorumThreshold;
        quorumThreshold = newQuorum;
        emit QuorumChanged(old, newQuorum, memberCount, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    // INTERNAL HELPERS
    // ─────────────────────────────────────────────────────────────

    /**
     * @dev Simple-majority quorum: floor(memberCount / 2) + 1.
     *      1 member → 1, 2 → 2, 3 → 2, 4 → 3, 5 → 3, 6 → 4.
     */
    function _recomputeQuorum() internal {
        uint256 newQuorum = (memberCount / 2) + 1;
        if (newQuorum != quorumThreshold) {
            uint256 old = quorumThreshold;
            quorumThreshold = newQuorum;
            emit QuorumChanged(old, newQuorum, memberCount, block.timestamp);
        }
    }

    /**
     * @dev Swap-and-pop removal so getMembers() always returns live members only.
     */
    function _removeFromMembersArray(address member) internal {
        uint256 len = members.length;
        for (uint256 i = 0; i < len; i++) {
            if (members[i] == member) {
                members[i] = members[len - 1];
                members.pop();
                return;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // VIEW FUNCTIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Get proposal details (without the approval mapping)
     */
    function getProposal(bytes32 proposalId) external view returns (ProposalView memory) {
        Proposal storage p = proposals[proposalId];
        return ProposalView({
            proposalId: proposalId,
            borrower: p.borrower,
            amountPaise: p.amountPaise,
            tenureMonths: p.tenureMonths,
            approvalCount: p.approvalCount,
            status: p.status,
            createdAt: p.createdAt
        });
    }

    /**
     * @notice Check if a specific leader has approved a proposal
     */
    function hasApproved(bytes32 proposalId, address leader) external view returns (bool) {
        return proposals[proposalId].hasApproved[leader];
    }

    /**
     * @notice Total number of proposals
     */
    function proposalCount() external view returns (uint256) {
        return proposalIds.length;
    }

    /**
     * @notice Get all member addresses
     */
    function getMembers() external view returns (address[] memory) {
        return members;
    }

    // ─── Pause controls ─────────────────────────────────────────
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
