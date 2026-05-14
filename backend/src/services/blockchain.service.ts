/**
 * Blockchain Service — GramChain Backend ↔ Polygon Integration
 *
 * Provides real Ethers.js interaction with deployed contracts:
 *   - LoanManager: createLoan, markDisbursed, markEmiPaid, checkDefault
 *   - SHGPoolFactory: createPool
 *   - CreditScoreRegistry: recordScore, getLatestScore
 *
 * All amounts are INR in paise. No ERC-20 token transfers.
 * On-chain = immutable audit trail. Off-chain = actual INR accounting.
 */

import { ethers, Contract, Wallet, JsonRpcProvider, NonceManager } from 'ethers'
import * as fs from 'fs'
import * as path from 'path'
import { buildTxOverrides, waitWithTimeout } from '@/lib/tx-helper'
import { logger } from '@/lib/logger'

// ─── ABI Imports (from compiled artifacts) ──────────────────
// In production these come from typechain. For now we define minimal ABIs.

const LOAN_MANAGER_ABI = [
  'function createLoan(address borrower, uint256 principalPaise, uint256 interestRateBps, uint256 tenureMonths, bytes32 shgPoolId) external returns (uint256)',
  'function approveLoan(uint256 loanId, address leader) external',
  'function markDisbursed(uint256 loanId, bytes32 txRef) external',
  'function markEmiPaid(uint256 loanId, bytes32 upiRef) external',
  'function checkDefault(uint256 loanId) external',
  'function addGroupLeader(address leader) external',
  'function removeGroupLeader(address leader) external',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function GROUP_LEADER_ROLE() external view returns (bytes32)',
  'function getLoan(uint256 loanId) external view returns (address, bytes32, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint8, bytes32)',
  'function getBorrowerLoans(address borrower) external view returns (uint256[])',
  'function totalLoans() external view returns (uint256)',
  'event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principalPaise, uint256 interestRateBps, uint256 tenureMonths, uint256 emiAmountPaise, uint256 timestamp)',
  'event LoanDisbursed(uint256 indexed loanId, address indexed borrower, uint256 principalPaise, bytes32 txRef, uint256 timestamp)',
  'event EmiPaid(uint256 indexed loanId, uint256 emiNumber, uint256 emiAmountPaise, bytes32 upiRef, uint256 timestamp)',
  'event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 timestamp)',
  'event LoanDefaulted(uint256 indexed loanId, address indexed borrower, uint256 overdueBy, uint256 timestamp)',
]

const SHG_POOL_FACTORY_ABI = [
  'function createPool(address[] calldata members, uint256 quorum, string calldata name) external returns (address)',
  'function poolCount() external view returns (uint256)',
  'function getAllPools() external view returns (address[])',
  'function poolByName(string) external view returns (address)',
  'event PoolCreated(address indexed poolAddress, string shgName, uint256 quorum, uint256 memberCount, uint256 timestamp)',
]

const SHG_POOL_ABI = [
  'function proposeLoan(address borrower, uint256 amountPaise, uint256 tenureMonths) external returns (bytes32)',
  'function approveLoan(bytes32 proposalId) external',
  'function executeLoan(bytes32 proposalId) external',
  'function addMember(address member) external',
  'function removeMember(address member) external',
  'function getMembers() external view returns (address[])',
  'function memberCount() external view returns (uint256)',
  'function quorumThreshold() external view returns (uint256)',
  'function getProposal(bytes32 proposalId) external view returns (tuple(bytes32 proposalId, address borrower, uint256 amountPaise, uint256 tenureMonths, uint256 approvalCount, uint8 status, uint256 createdAt))',
  'function hasApproved(bytes32 proposalId, address leader) external view returns (bool)',
  'event MemberAdded(address indexed member, uint256 timestamp)',
  'event MemberRemoved(address indexed member, uint256 timestamp)',
  'event QuorumChanged(uint256 oldQuorum, uint256 newQuorum, uint256 memberCount, uint256 timestamp)',
  'event LoanProposed(bytes32 indexed proposalId, address indexed borrower, uint256 amountPaise, uint256 tenureMonths, uint256 timestamp)',
  'event LoanExecuted(bytes32 indexed proposalId, address indexed borrower, uint256 amountPaise, uint256 timestamp)',
]

const CREDIT_SCORE_ABI = [
  'function recordScore(address member, uint16 score, string calldata riskBand, bytes32 modelVer) external',
  'function getLatestScore(address member) external view returns (uint16 score, string riskBand)',
  'function getScoreHistory(address member) external view returns (tuple(uint16 score, string riskBand, uint256 timestamp, bytes32 modelVersion)[])',
  'event ScoreRecorded(address indexed member, uint16 score, string riskBand, bytes32 modelVersion, uint256 timestamp)',
]

// ─── Configuration ──────────────────────────────────────────
const DEMO_MODE = process.env.DEMO_MODE === 'true'
const RPC_URL = process.env.POLYGON_RPC_URL ?? 'http://127.0.0.1:8545'

// FIX: Never auto-generate a random key — that means every restart uses a different signer,
// which breaks on-chain role assignments. Throw loudly in production if the key is missing.
function getPrivateKey(): string {
  const key = process.env.BACKEND_PRIVATE_KEY
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: BACKEND_PRIVATE_KEY must be set in production')
    }
    // In development only, generate a random key so the service starts without crashing
    logger.warn('BACKEND_PRIVATE_KEY not set — using ephemeral random key (DEV ONLY)')
    return ethers.Wallet.createRandom().privateKey
  }
  return key
}
const PRIVATE_KEY = getPrivateKey()

// Load contract addresses (from deploy script output)
function loadContractAddresses(): Record<string, string> {
  // Try multiple paths: compiled dist/ first, then source src/ (dev), then cwd
  const candidates = [
    path.join(__dirname, '..', 'constants', 'contracts.json'),
    path.join(process.cwd(), 'dist', 'constants', 'contracts.json'),
    path.join(process.cwd(), 'src', 'constants', 'contracts.json'),
  ]
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        logger.info({ path: filePath }, 'Loaded contract addresses')
        return data
      }
    } catch (_) { /* try next */ }
  }
  logger.warn('contracts.json not found in any candidate path — using env vars')
  return {
    loanManager: process.env.LOAN_MANAGER_ADDRESS ?? '',
    shgPoolFactory: process.env.SHG_POOL_FACTORY_ADDRESS ?? '',
    creditScoreRegistry: process.env.CREDIT_SCORE_REGISTRY_ADDRESS ?? '',
  }
}

// ─── Provider & Signer ─────────────────────────────────────
let provider: JsonRpcProvider
let signer: Wallet
let managedSigner: NonceManager  // B1: Wraps signer with auto nonce tracking
let loanManagerContract: Contract
let factoryContract: Contract
let creditScoreContract: Contract
let initialized = false

function initContracts() {
  if (initialized || DEMO_MODE) return
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL)
    signer = new ethers.Wallet(PRIVATE_KEY, provider)
    // B1: NonceManager handles nonce auto-increment and recovery from stuck nonces.
    // This prevents the common "nonce too low" and "replacement fee too low" errors
    // that occur when multiple outbox jobs fire in rapid succession.
    managedSigner = new NonceManager(signer)
    const addresses = loadContractAddresses()

    if (addresses.loanManager && addresses.loanManager !== '0x0000000000000000000000000000000000000000') {
      loanManagerContract = new ethers.Contract(addresses.loanManager, LOAN_MANAGER_ABI, managedSigner)
    }
    if (addresses.shgPoolFactory && addresses.shgPoolFactory !== '0x0000000000000000000000000000000000000000') {
      factoryContract = new ethers.Contract(addresses.shgPoolFactory, SHG_POOL_FACTORY_ABI, managedSigner)
    }
    if (addresses.creditScoreRegistry && addresses.creditScoreRegistry !== '0x0000000000000000000000000000000000000000') {
      creditScoreContract = new ethers.Contract(addresses.creditScoreRegistry, CREDIT_SCORE_ABI, managedSigner)
    }
    initialized = true
    logger.info({ signer: signer.address }, 'Blockchain contracts initialized (with NonceManager)')
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Blockchain init failed — running in offline mode')
  }
}

// Initialize on module load
initContracts()

// ─────────────────────────────────────────────────────────────
// LOAN MANAGER OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Create a loan on-chain (records the loan in LoanManager contract)
 */
export const createLoanOnChain = async (params: {
  borrowerAddress: string
  principalPaise: number
  interestRateBps: number
  tenureMonths: number
  shgPoolId: string
}): Promise<{ txHash: string; contractLoanId: number }> => {
  if (DEMO_MODE || !loanManagerContract) {
    return {
      txHash: `0xdemo_create_${Date.now().toString(16)}`,
      contractLoanId: Math.floor(Math.random() * 10000),
    }
  }

  const poolIdHash = ethers.keccak256(ethers.toUtf8Bytes(params.shgPoolId))
  const overrides = await buildTxOverrides(provider)
  const tx = await loanManagerContract.createLoan(
    params.borrowerAddress,
    params.principalPaise,
    params.interestRateBps,
    params.tenureMonths,
    poolIdHash,
    overrides,
  )
  const receipt = await waitWithTimeout(tx)
  const event = receipt.logs.find((l: any) => l.fragment?.name === 'LoanCreated')
  const loanId = event ? Number(event.args[0]) : 0

  return { txHash: receipt.hash, contractLoanId: loanId }
}

/**
 * Approve loan on-chain (Backend relayer acting on behalf of SHG Leader)
 */
export const approveLoanOnChain = async (
  contractLoanId: number,
  leaderAddress: string
): Promise<{ txHash: string }> => {
  if (DEMO_MODE || !loanManagerContract) {
    return { txHash: `0xdemo_approve_${Date.now().toString(16)}` }
  }

  // B4: Idempotency — skip if loan is already past PENDING (status >= 1 = APPROVED).
  try {
    const loanData = await loanManagerContract.getLoan(contractLoanId)
    const status = Number(loanData[9])
    if (status >= 1) {
      logger.info({ contractLoanId, status }, 'approve-loan skipped: loan already approved/disbursed')
      return { txHash: '0xnoop_already_approved' }
    }
  } catch {
    // Read may fail; proceed and let the contract revert if state is inconsistent.
  }

  // Contract signature: approveLoan(uint256 loanId, address leader)
  // Backend acts as relayer — leader address must hold GROUP_LEADER_ROLE on-chain
  const overrides = await buildTxOverrides(provider)
  const tx = await loanManagerContract.approveLoan(contractLoanId, leaderAddress, overrides)
  const receipt = await waitWithTimeout(tx)
  return { txHash: receipt.hash }
}

/**
 * Mark a loan as disbursed on-chain (after INR sent via UPI/bank)
 */
export const markDisbursedOnChain = async (
  contractLoanId: number,
  txRef: string
): Promise<{ txHash: string }> => {
  if (DEMO_MODE || !loanManagerContract) {
    return { txHash: `0xdemo_disburse_${Date.now().toString(16)}` }
  }

  // B4: Idempotency — check if this loan is already ACTIVE on-chain.
  // Prevents double-disbursement if the outbox sweep fires the same job twice.
  try {
    const loanData = await loanManagerContract.getLoan(contractLoanId)
    const status = Number(loanData[9]) // LoanStatus enum: 2 = ACTIVE
    if (status >= 2) {
      logger.info({ contractLoanId, status }, 'mark-disbursed skipped: loan already ACTIVE/REPAID')
      return { txHash: '0xnoop_already_disbursed' }
    }
  } catch {
    // If the read fails, proceed with the write — contract will revert if status mismatch.
  }

  const refHash = ethers.keccak256(ethers.toUtf8Bytes(txRef))
  const overrides = await buildTxOverrides(provider)
  const tx = await loanManagerContract.markDisbursed(contractLoanId, refHash, overrides)
  const receipt = await waitWithTimeout(tx)
  return { txHash: receipt.hash }
}

/**
 * Record an EMI payment on-chain (after INR received via UPI/bank)
 */
export const markEmiPaidOnChain = async (
  contractLoanId: number,
  upiRef: string
): Promise<{ txHash: string }> => {
  if (DEMO_MODE || !loanManagerContract) {
    return { txHash: `0xdemo_emi_${Date.now().toString(16)}` }
  }

  const refHash = ethers.keccak256(ethers.toUtf8Bytes(upiRef))

  // B4: Idempotency — the LoanManager contract reverts on duplicate refHash,
  // but we pre-check so a duplicate retry returns a noop instead of throwing.
  try {
    const loanData = await loanManagerContract.getLoan(contractLoanId)
    const status = Number(loanData[9])
    if (status >= 3) {
      // 3 = REPAID, 4 = DEFAULTED — no further EMIs allowed
      logger.info({ contractLoanId, status }, 'mark-emi skipped: loan already settled')
      return { txHash: '0xnoop_loan_settled' }
    }
  } catch {
    // proceed; contract is the source of truth
  }

  const overrides = await buildTxOverrides(provider)
  const tx = await loanManagerContract.markEmiPaid(contractLoanId, refHash, overrides)
  const receipt = await waitWithTimeout(tx)
  return { txHash: receipt.hash }
}

/**
 * Check if a loan has defaulted
 */
export const checkDefaultOnChain = async (
  contractLoanId: number
): Promise<{ defaulted: boolean; txHash?: string }> => {
  if (DEMO_MODE || !loanManagerContract) {
    return { defaulted: false }
  }

  try {
    const tx = await loanManagerContract.checkDefault(contractLoanId)
    const receipt = await tx.wait()
    return { defaulted: true, txHash: receipt.hash }
  } catch {
    return { defaulted: false }
  }
}

/**
 * Get loan details from chain
 */
export const getLoanFromChain = async (contractLoanId: number) => {
  if (DEMO_MODE || !loanManagerContract) return null
  try {
    const result = await loanManagerContract.getLoan(contractLoanId)
    return {
      borrower: result[0],
      shgPoolId: result[1],
      principalPaise: Number(result[2]),
      interestRateBps: Number(result[3]),
      emiAmountPaise: Number(result[4]),
      tenureMonths: Number(result[5]),
      disbursedAt: Number(result[6]),
      nextEmiDueAt: Number(result[7]),
      emisPaid: Number(result[8]),
      status: Number(result[9]),
      disbursalTxRef: result[10],
    }
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// SHG POOL FACTORY OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Deploy a new SHGPool on-chain for a group
 */
export const createPoolOnChain = async (params: {
  memberAddresses: string[]
  quorum: number
  name: string
}): Promise<{ txHash: string; poolAddress: string }> => {
  if (DEMO_MODE || !factoryContract) {
    return {
      txHash: `0xdemo_pool_${Date.now().toString(16)}`,
      poolAddress: `0xdemo${Math.random().toString(16).slice(2, 42).padEnd(40, '0')}`,
    }
  }

  const tx = await factoryContract.createPool(
    params.memberAddresses,
    params.quorum,
    params.name
  )
  const receipt = await tx.wait()
  const event = receipt.logs.find((l: any) => l.fragment?.name === 'PoolCreated')
  const poolAddress = event ? event.args[0] : ethers.ZeroAddress

  return { txHash: receipt.hash, poolAddress }
}

/**
 * Execute a loan proposal on an SHG Pool (after quorum reached)
 */
export const executePoolLoan = async (
  poolAddress: string,
  proposalId: string
): Promise<{ txHash: string }> => {
  if (DEMO_MODE) {
    return { txHash: `0xdemo_exec_${Date.now().toString(16)}` }
  }

  const pool = new ethers.Contract(poolAddress, SHG_POOL_ABI, managedSigner)
  const tx = await pool.executeLoan(proposalId)
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

/**
 * Add a member to an SHGPool on-chain (sync new joiners from off-chain DB).
 * Idempotent: returns the existing member's tx hash if already a member.
 */
export const addPoolMemberOnChain = async (
  poolAddress: string,
  memberAddress: string
): Promise<{ txHash: string }> => {
  if (DEMO_MODE) {
    return { txHash: `0xdemo_addmember_${Date.now().toString(16)}` }
  }
  if (!signer) throw new Error('Blockchain signer not initialized')

  const pool = new ethers.Contract(poolAddress, SHG_POOL_ABI, managedSigner)

  // Idempotency: skip if already on-chain.
  try {
    const existing: string[] = await pool.getMembers()
    if (existing.map(a => a.toLowerCase()).includes(memberAddress.toLowerCase())) {
      return { txHash: '0xnoop_already_member' }
    }
  } catch {
    // If the read fails we still try the write — the contract reverts on duplicate.
  }

  const tx = await pool.addMember(memberAddress)
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

/**
 * Remove a member from an SHGPool on-chain (sync off-chain removal).
 */
export const removePoolMemberOnChain = async (
  poolAddress: string,
  memberAddress: string
): Promise<{ txHash: string }> => {
  if (DEMO_MODE) {
    return { txHash: `0xdemo_removemember_${Date.now().toString(16)}` }
  }
  if (!signer) throw new Error('Blockchain signer not initialized')

  const pool = new ethers.Contract(poolAddress, SHG_POOL_ABI, managedSigner)

  // Idempotency: noop if not currently a member.
  try {
    const existing: string[] = await pool.getMembers()
    if (!existing.map(a => a.toLowerCase()).includes(memberAddress.toLowerCase())) {
      return { txHash: '0xnoop_not_member' }
    }
  } catch {
    // proceed; contract reverts on missing member
  }

  const tx = await pool.removeMember(memberAddress)
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

/**
 * Grant GROUP_LEADER_ROLE on the LoanManager so this address can approve loans.
 * Idempotent: noop if the role is already held.
 */
export const grantLeaderRoleOnChain = async (
  leaderAddress: string
): Promise<{ txHash: string }> => {
  if (DEMO_MODE || !loanManagerContract) {
    return { txHash: `0xdemo_grantleader_${Date.now().toString(16)}` }
  }

  // Idempotency: read role first.
  try {
    const role: string = await loanManagerContract.GROUP_LEADER_ROLE()
    const already: boolean = await loanManagerContract.hasRole(role, leaderAddress)
    if (already) return { txHash: '0xnoop_role_already_held' }
  } catch {
    // Fall through; the write will revert/no-op as needed.
  }

  const tx = await loanManagerContract.addGroupLeader(leaderAddress)
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

/**
 * Revoke GROUP_LEADER_ROLE on the LoanManager.
 */
export const revokeLeaderRoleOnChain = async (
  leaderAddress: string
): Promise<{ txHash: string }> => {
  if (DEMO_MODE || !loanManagerContract) {
    return { txHash: `0xdemo_revokeleader_${Date.now().toString(16)}` }
  }

  try {
    const role: string = await loanManagerContract.GROUP_LEADER_ROLE()
    const has: boolean = await loanManagerContract.hasRole(role, leaderAddress)
    if (!has) return { txHash: '0xnoop_role_not_held' }
  } catch {
    // proceed
  }

  const tx = await loanManagerContract.removeGroupLeader(leaderAddress)
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

// ─────────────────────────────────────────────────────────────
// CREDIT SCORE OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Record a credit score on-chain
 */
export const recordScoreOnChain = async (params: {
  memberAddress: string
  score: number
  riskBand: string
  modelVersion: string
}): Promise<{ txHash: string }> => {
  if (DEMO_MODE || !creditScoreContract) {
    return { txHash: `0xdemo_score_${Date.now().toString(16)}` }
  }

  const modelHash = ethers.keccak256(ethers.toUtf8Bytes(params.modelVersion))
  const tx = await creditScoreContract.recordScore(
    params.memberAddress,
    params.score,
    params.riskBand,
    modelHash
  )
  const receipt = await tx.wait()
  return { txHash: receipt.hash }
}

/**
 * Get latest credit score from chain
 */
export const getScoreFromChain = async (
  memberAddress: string
): Promise<{ score: number; riskBand: string } | null> => {
  if (DEMO_MODE || !creditScoreContract) return null
  try {
    const result = await creditScoreContract.getLatestScore(memberAddress)
    return { score: Number(result[0]), riskBand: result[1] }
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────

/** Get the backend signer address */
export const getSignerAddress = (): string => {
  if (DEMO_MODE) return '0xDEMO_SIGNER'
  return signer?.address ?? 'NOT_INITIALIZED'
}

/** Check if blockchain service is connected */
export const isConnected = (): boolean => {
  return initialized && !DEMO_MODE
}

/** Get loan manager contract for event listening */
export const getLoanManagerContract = () => {
  return loanManagerContract
}

/** Get the raw provider — needed by event listener for queryFilter (backfill) */
export const getProvider = () => {
  return provider
}
