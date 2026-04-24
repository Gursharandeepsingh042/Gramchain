// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title LoanManager
 * @notice Full loan lifecycle management: PENDING → APPROVED → ACTIVE → REPAID/DEFAULTED
 * @dev EMI tracking, auto-default detection, on-chain repayment recording
 */
contract LoanManager is ReentrancyGuard, AccessControl, Pausable {
    bytes32 public constant BACKEND_ROLE = keccak256("BACKEND_ROLE");
    bytes32 public constant ML_ORACLE_ROLE = keccak256("ML_ORACLE_ROLE");

    IERC20 public immutable usdc;

    enum LoanStatus { PENDING, APPROVED, ACTIVE, REPAID, DEFAULTED }

    struct Loan {
        uint256 id;
        address borrower;
        uint256 principal;         // USDC amount (6 decimals)
        uint256 interestRateBps;   // e.g. 1800 = 18% APR
        uint256 tenureMonths;
        uint256 emiAmount;
        uint256 disbursedAt;
        uint256 nextEmiDue;
        uint256 remainingPrincipal;
        uint256 repaymentCount;
        LoanStatus status;
        bytes32 shgPoolId;         // Reference to SHGPool
        int256 creditScore;        // ML score at time of application
    }

    uint256 public loanCounter;
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public borrowerLoans;

    // Events
    event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event LoanDisbursed(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event RepaymentReceived(uint256 indexed loanId, uint256 amount, uint256 remaining);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower);
    event LoanDefaulted(uint256 indexed loanId, address indexed borrower);

    uint256 private constant SECONDS_PER_MONTH = 30 days;
    uint256 private constant DEFAULT_GRACE_DAYS = 30 days;

    constructor(address _usdc, address _backend) {
        usdc = IERC20(_usdc);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BACKEND_ROLE, _backend);
    }

    /**
     * @notice Create a new loan (called by backend after SHG approval)
     */
    function createLoan(
        address borrower,
        uint256 principal,
        uint256 interestRateBps,
        uint256 tenureMonths,
        int256 creditScore
    ) external onlyRole(BACKEND_ROLE) whenNotPaused returns (uint256 loanId) {
        loanId = ++loanCounter;

        // Calculate EMI: simple interest EMI
        uint256 monthlyInterest = (principal * interestRateBps) / (10000 * 12);
        uint256 principalEmi = principal / tenureMonths;
        uint256 emiAmount = principalEmi + monthlyInterest;

        Loan storage loan = loans[loanId];
        loan.id = loanId;
        loan.borrower = borrower;
        loan.principal = principal;
        loan.interestRateBps = interestRateBps;
        loan.tenureMonths = tenureMonths;
        loan.emiAmount = emiAmount;
        loan.remainingPrincipal = principal;
        loan.status = LoanStatus.PENDING;
        loan.creditScore = creditScore;
        loan.disbursedAt = block.timestamp;
        loan.nextEmiDue = block.timestamp + SECONDS_PER_MONTH;

        borrowerLoans[borrower].push(loanId);

        emit LoanCreated(loanId, borrower, principal);
    }

    /**
     * @notice Backend triggers disbursement after approval
     */
    function disburseLoan(uint256 loanId) external onlyRole(BACKEND_ROLE) nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.PENDING, "Not in PENDING state");

        loan.status = LoanStatus.ACTIVE;
        loan.disbursedAt = block.timestamp;
        loan.nextEmiDue = block.timestamp + SECONDS_PER_MONTH;

        usdc.transfer(loan.borrower, loan.principal);

        emit LoanDisbursed(loanId, loan.borrower, loan.principal);
    }

    /**
     * @notice Borrower repays an EMI
     */
    function repayEMI(uint256 loanId) external nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        require(loan.borrower == msg.sender, "Not your loan");
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");

        uint256 emi = loan.emiAmount;
        usdc.transferFrom(msg.sender, address(this), emi);

        loan.repaymentCount++;
        loan.nextEmiDue = block.timestamp + SECONDS_PER_MONTH;

        uint256 principalPaid = loan.principal / loan.tenureMonths;
        if (loan.remainingPrincipal >= principalPaid) {
            loan.remainingPrincipal -= principalPaid;
        } else {
            loan.remainingPrincipal = 0;
        }

        emit RepaymentReceived(loanId, emi, loan.remainingPrincipal);

        if (loan.repaymentCount >= loan.tenureMonths) {
            loan.status = LoanStatus.REPAID;
            loan.remainingPrincipal = 0;
            emit LoanRepaid(loanId, loan.borrower);
        }
    }

    /**
     * @notice Mark loan as defaulted (called by backend checker job)
     */
    function checkDefault(uint256 loanId) external onlyRole(BACKEND_ROLE) {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");

        if (block.timestamp > loan.nextEmiDue + DEFAULT_GRACE_DAYS) {
            loan.status = LoanStatus.DEFAULTED;
            emit LoanDefaulted(loanId, loan.borrower);
        }
    }

    /**
     * @notice Get all loan IDs for a borrower
     */
    function getBorrowerLoans(address borrower) external view returns (uint256[] memory) {
        return borrowerLoans[borrower];
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
