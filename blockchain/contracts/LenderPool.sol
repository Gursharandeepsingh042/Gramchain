// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title LenderPool
 * @notice Pooled lending contract — lenders deposit USDC and receive GramUnits (receipt tokens).
 *         Interest from borrower repayments accrues to the pool, increasing GramUnit value.
 *
 * @dev Architecture: "Stablecoin as the Rail, INR as the Interface"
 *      - Lenders deposit USDC (via Transak fiat gateway converting INR → USDC)
 *      - GramUnits are ERC-20 receipt tokens representing a share of the pool
 *      - Interest from LoanManager repayments flows back here, increasing share value
 *      - Withdrawals have a 30-day cooldown to ensure pool liquidity
 *
 * @dev FX Buffer Strategy (Dynamic, 1.5% minimum):
 *      - `fxBufferBps` stores the current buffer in basis points (e.g. 150 = 1.5%)
 *      - Backend updates this based on 90-day rolling INR/USD volatility
 *      - Buffer is deducted from lender deposits to maintain a reserve
 *      - Reserve is used to absorb FX slippage during USDC → INR conversions
 *
 * @dev USDC Compliance:
 *      - Only accepts the specific USDC contract address set at deployment
 *      - All amounts use 6 decimal precision (USDC standard)
 *      - Platform fee (2%) is deducted from interest, not principal — NBFC model
 */
contract LenderPool is ERC20, ReentrancyGuard, AccessControl, Pausable {
    bytes32 public constant BACKEND_ROLE = keccak256("BACKEND_ROLE");

    IERC20 public immutable usdc;

    // ─── Pool State ──────────────────────────────────────────────
    uint256 public totalPoolUsdc;          // Total USDC in the pool (principal + accrued interest)
    uint256 public totalAllocated;         // USDC currently allocated to active loans
    uint256 public totalInterestEarned;    // Cumulative interest received from repayments
    uint256 public fxBufferReserve;        // USDC held as FX buffer reserve

    // ─── Configuration ──────────────────────────────────────────
    uint256 public fxBufferBps = 150;      // 1.5% default — dynamic, updated by backend
    uint256 public platformFeeBps = 200;   // 2% platform fee on interest (NBFC model)
    uint256 public withdrawalCooldown = 30 days;

    // ─── Withdrawal Queue ───────────────────────────────────────
    struct WithdrawalRequest {
        uint256 shares;
        uint256 requestedAt;
        bool completed;
    }
    mapping(address => WithdrawalRequest) public withdrawalRequests;

    // ─── Events ─────────────────────────────────────────────────
    event Deposited(address indexed lender, uint256 usdcAmount, uint256 sharesMinted, uint256 fxBufferDeducted);
    event WithdrawalRequested(address indexed lender, uint256 shares, uint256 availableAt);
    event WithdrawalCompleted(address indexed lender, uint256 shares, uint256 usdcReturned);
    event LoanAllocated(address indexed shgPool, uint256 amount);
    event InterestAccrued(uint256 interestAmount, uint256 platformFee, uint256 newPoolValue);
    event FxBufferUpdated(uint256 oldBps, uint256 newBps);
    event RepaymentReceived(uint256 principalReturned, uint256 interestAmount);

    constructor(address _usdc, address _backend) ERC20("GramUnit", "GRAM") {
        usdc = IERC20(_usdc);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BACKEND_ROLE, _backend);
    }

    // ─────────────────────────────────────────────────────────────
    // LENDER FUNCTIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Deposit USDC into the pool. Receives GramUnit shares proportionally.
     * @dev FX buffer is deducted from the deposit and held in reserve.
     *      Formula: shares = (depositAmount * totalShares) / totalPoolUsdc
     *      If pool is empty, shares = depositAmount (1:1 initial ratio)
     * @param amount USDC amount to deposit (6 decimals)
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");

        // Transfer USDC from lender to this contract
        usdc.transferFrom(msg.sender, address(this), amount);

        // Deduct FX buffer
        uint256 bufferAmount = (amount * fxBufferBps) / 10000;
        uint256 netDeposit = amount - bufferAmount;
        fxBufferReserve += bufferAmount;

        // Calculate shares to mint
        uint256 sharesToMint;
        if (totalSupply() == 0 || totalPoolUsdc == 0) {
            sharesToMint = netDeposit; // 1:1 for first deposit
        } else {
            sharesToMint = (netDeposit * totalSupply()) / totalPoolUsdc;
        }

        totalPoolUsdc += netDeposit;
        _mint(msg.sender, sharesToMint);

        emit Deposited(msg.sender, amount, sharesToMint, bufferAmount);
    }

    /**
     * @notice Request a withdrawal. Subject to 30-day cooldown for pool stability.
     * @param shares Number of GramUnit shares to redeem
     */
    function requestWithdrawal(uint256 shares) external whenNotPaused {
        require(shares > 0, "Shares must be > 0");
        require(balanceOf(msg.sender) >= shares, "Insufficient shares");
        require(!withdrawalRequests[msg.sender].completed || withdrawalRequests[msg.sender].shares == 0,
            "Existing pending withdrawal");

        withdrawalRequests[msg.sender] = WithdrawalRequest({
            shares: shares,
            requestedAt: block.timestamp,
            completed: false
        });

        emit WithdrawalRequested(msg.sender, shares, block.timestamp + withdrawalCooldown);
    }

    /**
     * @notice Complete a withdrawal after cooldown period.
     * @dev USDC returned = (shares * totalPoolUsdc) / totalShares
     *      This means if interest has accrued, lender gets more USDC than deposited.
     */
    function completeWithdrawal() external nonReentrant whenNotPaused {
        WithdrawalRequest storage req = withdrawalRequests[msg.sender];
        require(req.shares > 0, "No pending withdrawal");
        require(!req.completed, "Already completed");
        require(block.timestamp >= req.requestedAt + withdrawalCooldown, "Cooldown not elapsed");

        uint256 shares = req.shares;
        uint256 usdcToReturn = (shares * totalPoolUsdc) / totalSupply();

        // Ensure pool has enough available (not allocated to loans)
        uint256 availableUsdc = totalPoolUsdc - totalAllocated;
        require(usdcToReturn <= availableUsdc, "Insufficient liquidity — funds allocated to active loans");

        req.completed = true;
        totalPoolUsdc -= usdcToReturn;
        _burn(msg.sender, shares);
        usdc.transfer(msg.sender, usdcToReturn);

        emit WithdrawalCompleted(msg.sender, shares, usdcToReturn);
    }

    /**
     * @notice Get the current USDC value of a lender's GramUnit holdings
     * @param lender Address to query
     * @return usdcValue Current USDC equivalent of their shares
     */
    function getLenderBalance(address lender) external view returns (uint256 usdcValue) {
        if (totalSupply() == 0) return 0;
        return (balanceOf(lender) * totalPoolUsdc) / totalSupply();
    }

    /**
     * @notice Get the current exchange rate: USDC per GramUnit (scaled by 1e6)
     */
    function getSharePrice() external view returns (uint256) {
        if (totalSupply() == 0) return 1e6; // 1:1 default
        return (totalPoolUsdc * 1e6) / totalSupply();
    }

    // ─────────────────────────────────────────────────────────────
    // BACKEND FUNCTIONS (called by GramChain backend signer)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Allocate USDC from the pool to fund a loan via SHGPool
     * @dev Called by backend after loan approval + group vote
     * @param shgPool Address of the SHGPool contract to receive funds
     * @param amount USDC amount to allocate
     */
    function allocateLoan(address shgPool, uint256 amount)
        external
        onlyRole(BACKEND_ROLE)
        nonReentrant
        whenNotPaused
    {
        uint256 availableUsdc = totalPoolUsdc - totalAllocated;
        require(amount <= availableUsdc, "Insufficient pool liquidity");

        totalAllocated += amount;
        usdc.transfer(shgPool, amount);

        emit LoanAllocated(shgPool, amount);
    }

    /**
     * @notice Receive repayment (principal + interest) from LoanManager
     * @dev Backend calls this after a borrower's repayEMI is confirmed on-chain.
     *      Platform fee (2%) is deducted from interest only (NBFC model).
     *      Principal reduces totalAllocated; net interest increases totalPoolUsdc.
     * @param principalReturned USDC principal portion being returned
     * @param interestAmount USDC interest portion being returned
     */
    function receiveRepayment(uint256 principalReturned, uint256 interestAmount)
        external
        onlyRole(BACKEND_ROLE)
        nonReentrant
    {
        // Transfer USDC back from LoanManager (must have approved this contract)
        usdc.transferFrom(msg.sender, address(this), principalReturned + interestAmount);

        // Principal returns to the pool
        totalAllocated -= principalReturned;

        // Platform fee on interest (2%)
        uint256 platformFee = (interestAmount * platformFeeBps) / 10000;
        uint256 netInterest = interestAmount - platformFee;

        // Net interest accrues to the pool (increases GramUnit value for all lenders)
        totalPoolUsdc += netInterest;
        totalInterestEarned += netInterest;

        // Platform fee stays in contract — admin can withdraw separately
        emit InterestAccrued(netInterest, platformFee, totalPoolUsdc);
        emit RepaymentReceived(principalReturned, interestAmount);
    }

    /**
     * @notice Update the dynamic FX buffer rate based on INR/USD volatility
     * @dev Called by backend periodically (e.g., weekly) based on 90-day rolling vol
     * @param newBufferBps New buffer in basis points (minimum 150 = 1.5%)
     */
    function updateFxBuffer(uint256 newBufferBps) external onlyRole(BACKEND_ROLE) {
        require(newBufferBps >= 150, "Buffer cannot be below 1.5%");
        require(newBufferBps <= 1000, "Buffer cannot exceed 10%");

        uint256 oldBps = fxBufferBps;
        fxBufferBps = newBufferBps;

        emit FxBufferUpdated(oldBps, newBufferBps);
    }

    /**
     * @notice Admin: withdraw accumulated platform fees
     */
    function withdrawPlatformFees(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Platform fees are the difference between total USDC balance and
        // (totalPoolUsdc + fxBufferReserve)
        uint256 totalAccountedFor = totalPoolUsdc + fxBufferReserve;
        uint256 contractBalance = usdc.balanceOf(address(this));
        uint256 availableFees = contractBalance > totalAccountedFor
            ? contractBalance - totalAccountedFor
            : 0;

        require(amount <= availableFees, "Exceeds available platform fees");
        usdc.transfer(to, amount);
    }

    /**
     * @notice Admin: withdraw from FX buffer reserve (for USDC → INR conversion slippage)
     */
    function withdrawFxBuffer(address to, uint256 amount) external onlyRole(BACKEND_ROLE) {
        require(amount <= fxBufferReserve, "Exceeds FX buffer reserve");
        fxBufferReserve -= amount;
        usdc.transfer(to, amount);
    }

    // ─── Pause controls ─────────────────────────────────────────
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
