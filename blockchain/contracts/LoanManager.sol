// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title LoanManager
 * @notice Full loan lifecycle state machine — INR-native, no token transfers
 * @dev All amounts are INR in paise (₹25,000 = 2500000 paise).
 *      On-chain = immutable record. Off-chain = actual INR accounting via UPI/bank.
 *
 *      State machine:  PENDING → APPROVED → ACTIVE → REPAID | DEFAULTED
 *
 *      - PENDING:   Loan created by backend after SHG proposal
 *      - APPROVED:  Multi-sig quorum reached (SHGPool.executeLoan fired)
 *      - ACTIVE:    Backend marks disbursed after INR sent via UPI/bank
 *      - REPAID:    All EMIs marked as paid
 *      - DEFAULTED: EMI overdue > 30 day grace period
 *
 * @dev Roles:
 *      - BACKEND_ROLE: Backend wallet. Calls markDisbursed, markEmiPaid.
 *      - GROUP_LEADER_ROLE: SHG leaders. Calls approveLoan.
 *      - DEFAULT_ADMIN_ROLE: Deployer. Manages roles.
 */
contract LoanManager is ReentrancyGuard, AccessControl, Pausable {
    bytes32 public constant BACKEND_ROLE = keccak256("BACKEND_ROLE");
    bytes32 public constant GROUP_LEADER_ROLE = keccak256("GROUP_LEADER_ROLE");

    // ─── Loan State Machine ─────────────────────────────────────
    enum LoanStatus { PENDING, APPROVED, ACTIVE, REPAID, DEFAULTED }

    struct Loan {
        uint256 id;
        address borrower;
        bytes32 shgPoolId;              // Reference to SHGPool proposal
        uint256 principalPaise;         // ₹25,000 = 2500000
        uint256 interestRateBps;        // 1800 = 18% APR
        uint256 emiAmountPaise;         // Monthly EMI in paise
        uint256 tenureMonths;
        uint256 disbursedAt;            // Unix timestamp (0 if not yet disbursed)
        uint256 nextEmiDueAt;           // Unix timestamp of next EMI due date
        uint256 emisPaid;               // Number of EMIs paid
        LoanStatus status;
        bytes32 disbursalTxRef;         // Off-chain INR transaction reference
    }

    // ─── Storage ────────────────────────────────────────────────
    uint256 public loanCounter;
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public borrowerLoans;

    // ─── Approval tracking per loan ─────────────────────────────
    mapping(uint256 => mapping(address => bool)) public loanApprovals;
    mapping(uint256 => uint256) public loanApprovalCount;
    uint256 public approvalQuorum;      // Required approvals for loan approval

    // ─── Constants ──────────────────────────────────────────────
    uint256 private constant SECONDS_PER_MONTH = 30 days;
    uint256 private constant DEFAULT_GRACE_PERIOD = 30 days;

    // ─── Events (immutable audit trail) ─────────────────────────
    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principalPaise,
        uint256 interestRateBps,
        uint256 tenureMonths,
        uint256 emiAmountPaise,
        uint256 timestamp
    );
    event LoanApprovedByLeader(
        uint256 indexed loanId,
        address indexed approver,
        uint256 approvalCount,
        uint256 timestamp
    );
    event LoanFullyApproved(
        uint256 indexed loanId,
        uint256 timestamp
    );
    event LoanDisbursed(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principalPaise,
        bytes32 txRef,
        uint256 timestamp
    );
    event EmiPaid(
        uint256 indexed loanId,
        uint256 emiNumber,
        uint256 emiAmountPaise,
        bytes32 upiRef,
        uint256 timestamp
    );
    event LoanRepaid(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 timestamp
    );
    event LoanDefaulted(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 overdueBy,
        uint256 timestamp
    );

    // ─── Errors ─────────────────────────────────────────────────
    error ZeroAmount();
    error ZeroTenure();
    error ZeroBorrower();
    error InvalidLoanStatus(uint256 loanId, LoanStatus expected, LoanStatus actual);
    error AlreadyApproved(uint256 loanId, address approver);
    error LoanNotOverdue(uint256 loanId);
    error AllEmisPaid(uint256 loanId);
    error LoanNotFound(uint256 loanId);

    /**
     * @param _backend       Backend wallet address
     * @param _approvalQuorum Number of group leader approvals required
     */
    constructor(address _backend, uint256 _approvalQuorum) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BACKEND_ROLE, _backend);
        approvalQuorum = _approvalQuorum;
    }

    // ─────────────────────────────────────────────────────────────
    // LOAN CREATION (Backend)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Create a new loan record on-chain
     * @dev Called by backend after SHG proposal. Loan starts as PENDING.
     *      EMI = (principal / tenure) + (principal * rate / 10000 / 12)
     * @param borrower       Borrower wallet address
     * @param principalPaise Loan amount in INR paise
     * @param interestRateBps Annual interest rate in basis points (1800 = 18%)
     * @param tenureMonths   Loan tenure in months
     * @param shgPoolId      Reference to the SHGPool proposal ID
     * @return loanId        The newly created loan ID
     */
    function createLoan(
        address borrower,
        uint256 principalPaise,
        uint256 interestRateBps,
        uint256 tenureMonths,
        bytes32 shgPoolId
    ) external onlyRole(BACKEND_ROLE) whenNotPaused returns (uint256 loanId) {
        if (borrower == address(0)) revert ZeroBorrower();
        if (principalPaise == 0) revert ZeroAmount();
        if (tenureMonths == 0) revert ZeroTenure();

        loanId = ++loanCounter;

        // Calculate EMI: simple interest model
        // Monthly interest portion = (principal * rateBps) / (10000 * 12)
        // Monthly principal portion = principal / tenureMonths
        uint256 monthlyInterest = (principalPaise * interestRateBps) / (10000 * 12);
        uint256 principalPortion = principalPaise / tenureMonths;
        uint256 emiAmount = principalPortion + monthlyInterest;

        Loan storage loan = loans[loanId];
        loan.id = loanId;
        loan.borrower = borrower;
        loan.shgPoolId = shgPoolId;
        loan.principalPaise = principalPaise;
        loan.interestRateBps = interestRateBps;
        loan.emiAmountPaise = emiAmount;
        loan.tenureMonths = tenureMonths;
        loan.status = LoanStatus.PENDING;

        borrowerLoans[borrower].push(loanId);

        emit LoanCreated(
            loanId,
            borrower,
            principalPaise,
            interestRateBps,
            tenureMonths,
            emiAmount,
            block.timestamp
        );
    }

    // ─────────────────────────────────────────────────────────────
    // LOAN APPROVAL (Group Leaders)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Group leader approves a pending loan (or Backend submits gasless relayed approval)
     * @dev When quorum is reached, status moves to APPROVED.
     *      Security: when backend relays, leader MUST hold GROUP_LEADER_ROLE — prevents forged approvals.
     *      When a leader calls directly, msg.sender must equal leader.
     * @param loanId The loan to approve
     * @param leader The actual leader address casting the vote
     */
    function approveLoan(uint256 loanId, address leader) external whenNotPaused {
        if (hasRole(BACKEND_ROLE, msg.sender)) {
            // Backend relayer path: the supplied leader must genuinely hold GROUP_LEADER_ROLE.
            // This prevents the backend from forging votes with arbitrary addresses.
            require(
                hasRole(GROUP_LEADER_ROLE, leader),
                "Relayed leader does not have GROUP_LEADER_ROLE"
            );
        } else {
            // Direct call path: caller must be a leader and must be approving themselves.
            require(hasRole(GROUP_LEADER_ROLE, msg.sender), "Caller is not a group leader");
            require(leader == msg.sender, "Leader param must equal msg.sender for direct calls");
        }

        Loan storage loan = loans[loanId];
        if (loan.id == 0) revert LoanNotFound(loanId);
        if (loan.status != LoanStatus.PENDING) {
            revert InvalidLoanStatus(loanId, LoanStatus.PENDING, loan.status);
        }
        if (loanApprovals[loanId][leader]) revert AlreadyApproved(loanId, leader);

        loanApprovals[loanId][leader] = true;
        loanApprovalCount[loanId]++;

        emit LoanApprovedByLeader(loanId, leader, loanApprovalCount[loanId], block.timestamp);

        if (loanApprovalCount[loanId] >= approvalQuorum) {
            loan.status = LoanStatus.APPROVED;
            emit LoanFullyApproved(loanId, block.timestamp);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // DISBURSEMENT MARKING (Backend)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Mark loan as disbursed after INR has been sent off-chain
     * @dev Called by backend AFTER the INR disbursal via UPI/bank is confirmed.
     *      This is the on-chain immutable record of the disbursal event.
     *      No tokens move on-chain.
     * @param loanId The loan that was disbursed
     * @param txRef  Off-chain transaction reference (UPI ref / bank txn ID hash)
     */
    function markDisbursed(uint256 loanId, bytes32 txRef)
        external
        onlyRole(BACKEND_ROLE)
        whenNotPaused
    {
        Loan storage loan = loans[loanId];
        if (loan.id == 0) revert LoanNotFound(loanId);
        if (loan.status != LoanStatus.APPROVED) {
            revert InvalidLoanStatus(loanId, LoanStatus.APPROVED, loan.status);
        }

        loan.status = LoanStatus.ACTIVE;
        loan.disbursedAt = block.timestamp;
        loan.nextEmiDueAt = block.timestamp + SECONDS_PER_MONTH;
        loan.disbursalTxRef = txRef;

        emit LoanDisbursed(loanId, loan.borrower, loan.principalPaise, txRef, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    // EMI REPAYMENT RECORDING (Backend)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Mark an EMI as paid after INR received via UPI/bank
     * @dev Called by backend AFTER the INR EMI payment is confirmed.
     *      No tokens move on-chain — this records the payment for the audit trail.
     *      When all EMIs are paid, loan status moves to REPAID.
     * @param loanId The loan being repaid
     * @param upiRef Off-chain UPI reference / bank transaction hash
     */
    function markEmiPaid(uint256 loanId, bytes32 upiRef)
        external
        onlyRole(BACKEND_ROLE)
        whenNotPaused
    {
        Loan storage loan = loans[loanId];
        if (loan.id == 0) revert LoanNotFound(loanId);
        if (loan.status != LoanStatus.ACTIVE) {
            revert InvalidLoanStatus(loanId, LoanStatus.ACTIVE, loan.status);
        }
        if (loan.emisPaid >= loan.tenureMonths) revert AllEmisPaid(loanId);

        loan.emisPaid++;
        loan.nextEmiDueAt = block.timestamp + SECONDS_PER_MONTH;

        emit EmiPaid(loanId, loan.emisPaid, loan.emiAmountPaise, upiRef, block.timestamp);

        // Check if all EMIs paid → mark REPAID
        if (loan.emisPaid >= loan.tenureMonths) {
            loan.status = LoanStatus.REPAID;
            emit LoanRepaid(loanId, loan.borrower, block.timestamp);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // DEFAULT DETECTION
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Check if a loan has defaulted (EMI overdue > 30 day grace)
     * @dev Can be called by anyone (Chainlink Automation, backend cron, keeper).
     *      Only transitions ACTIVE loans with overdue EMIs past the grace period.
     * @param loanId The loan to check
     */
    function checkDefault(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        if (loan.id == 0) revert LoanNotFound(loanId);
        if (loan.status != LoanStatus.ACTIVE) {
            revert InvalidLoanStatus(loanId, LoanStatus.ACTIVE, loan.status);
        }

        uint256 overdueThreshold = loan.nextEmiDueAt + DEFAULT_GRACE_PERIOD;
        if (block.timestamp <= overdueThreshold) revert LoanNotOverdue(loanId);

        uint256 overdueBy = block.timestamp - loan.nextEmiDueAt;
        loan.status = LoanStatus.DEFAULTED;

        emit LoanDefaulted(loanId, loan.borrower, overdueBy, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    // VIEW FUNCTIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Get all loan IDs for a borrower
     */
    function getBorrowerLoans(address borrower) external view returns (uint256[] memory) {
        return borrowerLoans[borrower];
    }

    /**
     * @notice Get full loan details
     */
    function getLoan(uint256 loanId) external view returns (
        address borrower,
        bytes32 shgPoolId,
        uint256 principalPaise,
        uint256 interestRateBps,
        uint256 emiAmountPaise,
        uint256 tenureMonths,
        uint256 disbursedAt,
        uint256 nextEmiDueAt,
        uint256 emisPaid,
        LoanStatus status,
        bytes32 disbursalTxRef
    ) {
        Loan storage loan = loans[loanId];
        return (
            loan.borrower,
            loan.shgPoolId,
            loan.principalPaise,
            loan.interestRateBps,
            loan.emiAmountPaise,
            loan.tenureMonths,
            loan.disbursedAt,
            loan.nextEmiDueAt,
            loan.emisPaid,
            loan.status,
            loan.disbursalTxRef
        );
    }

    /**
     * @notice Get the total number of loans created
     */
    function totalLoans() external view returns (uint256) {
        return loanCounter;
    }

    // ─── Role Management ────────────────────────────────────────

    /**
     * @notice Grant GROUP_LEADER_ROLE to an address
     * @dev Callable by either DEFAULT_ADMIN_ROLE (governance) or BACKEND_ROLE (relayer)
     *      so the backend can sync newly-promoted leaders to chain automatically.
     */
    function addGroupLeader(address leader) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || hasRole(BACKEND_ROLE, msg.sender),
            "Caller must be admin or backend"
        );
        _grantRole(GROUP_LEADER_ROLE, leader);
    }

    /**
     * @notice Revoke GROUP_LEADER_ROLE from an address
     * @dev Same auth model as addGroupLeader. Backend revokes when a leader is
     *      removed off-chain or demoted.
     */
    function removeGroupLeader(address leader) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || hasRole(BACKEND_ROLE, msg.sender),
            "Caller must be admin or backend"
        );
        _revokeRole(GROUP_LEADER_ROLE, leader);
    }

    /**
     * @notice Update the approval quorum
     */
    function setApprovalQuorum(uint256 newQuorum) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newQuorum > 0, "Quorum must be > 0");
        require(newQuorum <= 50, "Quorum cannot exceed 50 members");
        approvalQuorum = newQuorum;
    }

    // ─── Pause controls ─────────────────────────────────────────
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
