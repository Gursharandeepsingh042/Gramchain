/**
 * Blockchain Event Listener — GramChain
 *
 * PROBLEMS FIXED:
 * 1. The old listener was a placeholder that only logged events.
 * 2. If the backend restarted, all events emitted while it was offline were MISSED.
 * 3. There was no reconnection logic for WebSocket drops.
 *
 * SOLUTION:
 * 1. On startup, reads the last processed block from `BlockchainSyncState` table.
 * 2. Fetches all historical events from that block to current, processes them.
 * 3. Attaches live listener for new events going forward.
 * 4. Persists the latest processed block number after each batch.
 * 5. On WebSocket/provider error, reconnects with exponential backoff.
 */

import { ethers } from 'ethers'
import { getLoanManagerContract, getProvider } from '@/services/blockchain.service'
import { prisma } from '@/lib/prisma'
import { sendPushNotification } from '@/services/notification.service'
import { logger } from '@/lib/logger'

const DEMO_MODE = process.env.DEMO_MODE === 'true'
const RECONNECT_BASE_DELAY_MS = 5_000
const MAX_RECONNECT_DELAY_MS = 120_000

let reconnectDelay = RECONNECT_BASE_DELAY_MS

/**
 * Persist the last successfully processed block number.
 * Uses a singleton row in BlockchainSyncState.
 */
async function saveLastBlock(blockNumber: number): Promise<void> {
  await prisma.blockchainSyncState.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', lastProcessedBlock: blockNumber },
    update: { lastProcessedBlock: blockNumber },
  })
}

/**
 * Retrieve the last processed block, defaulting to 0 (genesis) on first run.
 */
async function getLastBlock(): Promise<number> {
  const state = await prisma.blockchainSyncState.findUnique({
    where: { id: 'singleton' },
  })
  return state?.lastProcessedBlock ?? 0
}

/**
 * Process a LoanDisbursed event — update DB and send push notification.
 */
async function handleLoanDisbursed(
  loanIdBN: bigint,
  _borrower: string,
  _principalPaise: bigint,
  _txRef: string,
  _timestamp: bigint
): Promise<void> {
  const contractLoanId = Number(loanIdBN)

  try {
    const loan = await prisma.loan.findFirst({
      where: { contractLoanId },
      include: { member: true },
    })

    if (!loan) {
      logger.warn({ contractLoanId }, 'LoanDisbursed event: no matching DB loan found')
      return
    }

    // Sync DB status if somehow it got out of sync
    if (loan.status !== 'ACTIVE') {
      await prisma.loan.update({
        where: { id: loan.id },
        data: { status: 'ACTIVE', disbursedAt: new Date() },
      })
      logger.info({ loanId: loan.id, contractLoanId }, 'Synced loan to ACTIVE from chain event')
    }

    // Send push notification
    await sendPushNotification(
      loan.memberId,
      'Loan Disbursed! 🎉',
      `Your loan of ₹${Number(loan.amount).toLocaleString('en-IN')} has been disbursed.`,
      { loanId: loan.id, type: 'LOAN_DISBURSED' }
    )
  } catch (err) {
    logger.error({ contractLoanId, err }, 'Error handling LoanDisbursed event')
  }
}

/**
 * Process a LoanRepaid event
 */
async function handleLoanRepaid(
  loanIdBN: bigint,
  _borrower: string,
  _timestamp: bigint
): Promise<void> {
  const contractLoanId = Number(loanIdBN)
  try {
    const loan = await prisma.loan.findFirst({ where: { contractLoanId } })
    if (!loan) return

    if (loan.status !== 'REPAID') {
      await prisma.loan.update({
        where: { id: loan.id },
        data: { status: 'REPAID' },
      })
      logger.info({ loanId: loan.id, contractLoanId }, 'Synced loan to REPAID from chain event')
    }

    await sendPushNotification(
      loan.memberId,
      'Loan Fully Repaid! ✅',
      'Congratulations! Your loan has been fully repaid.',
      { loanId: loan.id, type: 'LOAN_REPAID' }
    )
  } catch (err) {
    logger.error({ contractLoanId, err }, 'Error handling LoanRepaid event')
  }
}

/**
 * Process a LoanDefaulted event
 */
async function handleLoanDefaulted(
  loanIdBN: bigint,
  _borrower: string,
  _overdueBy: bigint,
  _timestamp: bigint
): Promise<void> {
  const contractLoanId = Number(loanIdBN)
  try {
    const loan = await prisma.loan.findFirst({ where: { contractLoanId } })
    if (!loan) return

    if (loan.status !== 'DEFAULTED') {
      await prisma.loan.update({
        where: { id: loan.id },
        data: { status: 'DEFAULTED' },
      })
      logger.warn({ loanId: loan.id, contractLoanId }, 'Loan synced to DEFAULTED from chain event')
    }
  } catch (err) {
    logger.error({ contractLoanId, err }, 'Error handling LoanDefaulted event')
  }
}

/**
 * Backfill historical events from lastBlock+1 to currentBlock.
 * Called on startup to catch events missed during downtime.
 */
async function backfillEvents(
  contract: ethers.Contract,
  provider: ethers.JsonRpcProvider,
  fromBlock: number
): Promise<number> {
  const currentBlock = await provider.getBlockNumber()
  
  // If fresh database, skip backfilling millions of old blocks to avoid RPC limit errors
  if (fromBlock === 0) {
      logger.info({ currentBlock }, 'Fresh database detected. Starting event listener from current block.');
      return currentBlock;
  }
  
  if (fromBlock >= currentBlock) return currentBlock

  logger.info({ fromBlock, currentBlock }, `Backfilling events from block ${fromBlock} to ${currentBlock}`)

  const MIN_BATCH = 5
  let batchSize = 50 // Polygon Amoy RPCs enforce a very small block range limit
  let block = fromBlock

  while (block < currentBlock) {
    const toBlock = Math.min(block + batchSize - 1, currentBlock)

    try {
      const [disbursedEvents, repaidEvents, defaultedEvents] = await Promise.all([
        contract.queryFilter(contract.filters.LoanDisbursed(), block, toBlock),
        contract.queryFilter(contract.filters.LoanRepaid(), block, toBlock),
        contract.queryFilter(contract.filters.LoanDefaulted(), block, toBlock),
      ])

      for (const evt of disbursedEvents) {
        const { args } = evt as any
        await handleLoanDisbursed(args[0], args[1], args[2], args[3], args[4])
      }
      for (const evt of repaidEvents) {
        const { args } = evt as any
        await handleLoanRepaid(args[0], args[1], args[2])
      }
      for (const evt of defaultedEvents) {
        const { args } = evt as any
        await handleLoanDefaulted(args[0], args[1], args[2], args[3])
      }

      await saveLastBlock(toBlock)
      block = toBlock + 1
      // Gradually increase batch size back after success (up to 50)
      batchSize = Math.min(batchSize * 2, 50)
    } catch (err: any) {
      const isPruned =
        err?.error?.code === -32701 ||
        err?.error?.message?.includes('History has been pruned')

      const isRangeError =
        !isPruned && (
          err?.error?.message?.includes('block range exceeds') ||
          err?.message?.includes('block range exceeds') ||
          err?.shortMessage?.includes('coalesce error')
        )

      if (isPruned) {
        logger.warn({ fromBlock: block, currentBlock }, 'RPC history pruned — fast-forwarding to current block')
        await saveLastBlock(currentBlock)
        return currentBlock
      }

      if (isRangeError && batchSize > MIN_BATCH) {
        // Halve batch size and retry the same range
        batchSize = Math.max(Math.floor(batchSize / 2), MIN_BATCH)
        logger.warn({ fromBlock: block, toBlock, newBatchSize: batchSize }, 'Block range too large — reducing batch size and retrying')
        continue
      }

      logger.error({ fromBlock: block, toBlock, batchSize, err }, 'Error during backfill batch — retrying next interval')
      break
    }
  }

  return currentBlock
}

const POLL_INTERVAL_MS = 30_000
let pollTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Poll for new events every POLL_INTERVAL_MS using queryFilter.
 * Avoids eth_newFilter which expires on public HTTP RPCs.
 */
function attachLiveListeners(contract: ethers.Contract, provider: ethers.JsonRpcProvider, fromBlock: number): void {
  let lastPolledBlock = fromBlock

  const poll = async () => {
    try {
      const currentBlock = await provider.getBlockNumber()
      if (currentBlock <= lastPolledBlock) {
        pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
        return
      }

      const [disbursedEvents, repaidEvents, defaultedEvents] = await Promise.all([
        contract.queryFilter(contract.filters.LoanDisbursed(), lastPolledBlock + 1, currentBlock),
        contract.queryFilter(contract.filters.LoanRepaid(), lastPolledBlock + 1, currentBlock),
        contract.queryFilter(contract.filters.LoanDefaulted(), lastPolledBlock + 1, currentBlock),
      ])

      for (const evt of disbursedEvents) {
        const { args } = evt as any
        logger.info({ contractLoanId: Number(args[0]) }, '📡 Polled event: LoanDisbursed')
        await handleLoanDisbursed(args[0], args[1], args[2], args[3], args[4])
      }
      for (const evt of repaidEvents) {
        const { args } = evt as any
        logger.info({ contractLoanId: Number(args[0]) }, '📡 Polled event: LoanRepaid')
        await handleLoanRepaid(args[0], args[1], args[2])
      }
      for (const evt of defaultedEvents) {
        const { args } = evt as any
        logger.warn({ contractLoanId: Number(args[0]) }, '📡 Polled event: LoanDefaulted')
        await handleLoanDefaulted(args[0], args[1], args[2], args[3])
      }

      await saveLastBlock(currentBlock)
      lastPolledBlock = currentBlock
    } catch (err) {
      logger.error({ err }, 'Poll error — will retry next interval')
    }
    pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
  }

  pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
  logger.info({ fromBlock, pollIntervalMs: POLL_INTERVAL_MS }, '📡 Live polling started')
}

/**
 * Start the blockchain event listener with reconnection logic.
 */
export const startEventListener = async (): Promise<void> => {
  if (DEMO_MODE) {
    logger.info('✅ [DEMO] Blockchain event listener mocked.')
    return
  }

  const contract = getLoanManagerContract()
  const provider = getProvider()

  if (!contract || !provider) {
    logger.warn('⚠️  LoanManager contract not available. Skipping event listener.')
    return
  }

  try {
    const lastBlock = await getLastBlock()
    const currentBlock = await backfillEvents(contract, provider as ethers.JsonRpcProvider, lastBlock)
    await saveLastBlock(currentBlock)

    attachLiveListeners(contract, provider as ethers.JsonRpcProvider, currentBlock)

    reconnectDelay = RECONNECT_BASE_DELAY_MS // Reset on success
    logger.info({ lastBlock, currentBlock }, '✅ Blockchain event listener started')
  } catch (err) {
    logger.error({ err }, 'Event listener startup failed — scheduling reconnect')
    await scheduleReconnect()
  }
}

async function scheduleReconnect(): Promise<void> {
  logger.info({ delayMs: reconnectDelay }, `Reconnecting blockchain listener in ${reconnectDelay / 1000}s...`)
  await new Promise((r) => setTimeout(r, reconnectDelay))
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
  await startEventListener()
}
