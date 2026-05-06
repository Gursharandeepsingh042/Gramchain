/**
 * Transaction Helper — gas oracle + stuck-tx watchdog
 * ────────────────────────────────────────────────────────────
 * B2: Pulls EIP-1559 fees from `provider.getFeeData()` and adds
 *     a 20% buffer so transactions don't get stuck on chain
 *     congestion spikes.
 * B3: Wraps `tx.wait()` with a configurable timeout. If the tx
 *     hasn't confirmed within `STUCK_TX_TIMEOUT_MS` we throw,
 *     letting BullMQ retry. The NonceManager auto-replaces the
 *     stuck tx with a new one at higher gas on retry.
 *
 * Usage:
 *   const overrides = await buildTxOverrides(provider)
 *   const tx = await contract.someMethod(args, overrides)
 *   const receipt = await waitWithTimeout(tx)
 */

import { JsonRpcProvider, FeeData } from 'ethers'
import { logger } from '@/lib/logger'

// ── Tunables ────────────────────────────────────────────────
const GAS_BUFFER_BPS = 2000              // 20% buffer (in basis points)
const STUCK_TX_TIMEOUT_MS = 5 * 60 * 1000 // 5 min before declaring a tx stuck
const FEE_CACHE_TTL_MS = 15 * 1000        // refresh fee data every 15 s

// ── Fee cache (avoid hammering the RPC every tx) ────────────
let cachedFeeData: { data: FeeData; expiresAt: number } | null = null

async function getFeeDataCached(provider: JsonRpcProvider): Promise<FeeData> {
  const now = Date.now()
  if (cachedFeeData && cachedFeeData.expiresAt > now) {
    return cachedFeeData.data
  }
  const data = await provider.getFeeData()
  cachedFeeData = { data, expiresAt: now + FEE_CACHE_TTL_MS }
  return data
}

/**
 * Build EIP-1559 gas overrides with a safety buffer.
 * On legacy chains (no maxFeePerGas), falls back to gasPrice.
 */
export async function buildTxOverrides(
  provider: JsonRpcProvider,
): Promise<Record<string, bigint>> {
  try {
    const fee = await getFeeDataCached(provider)
    const bump = (n: bigint) => (n * BigInt(10_000 + GAS_BUFFER_BPS)) / 10_000n

    if (fee.maxFeePerGas && fee.maxPriorityFeePerGas) {
      return {
        maxFeePerGas:         bump(fee.maxFeePerGas),
        maxPriorityFeePerGas: bump(fee.maxPriorityFeePerGas),
      }
    }
    if (fee.gasPrice) {
      return { gasPrice: bump(fee.gasPrice) }
    }
    return {}
  } catch (err) {
    logger.warn({ err }, 'getFeeData failed — submitting tx without overrides')
    return {}
  }
}

/**
 * Wait for a tx receipt with a timeout. Throws if the tx is
 * still pending after STUCK_TX_TIMEOUT_MS so the caller (BullMQ
 * worker) retries — the NonceManager replaces the stuck tx with
 * a fresh one at a higher gas price on the retry attempt.
 */
export async function waitWithTimeout<T extends { wait: () => Promise<any>; hash: string }>(
  tx: T,
  timeoutMs = STUCK_TX_TIMEOUT_MS,
): Promise<Awaited<ReturnType<T['wait']>>> {
  return await Promise.race([
    tx.wait(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Tx ${tx.hash} did not confirm within ${timeoutMs}ms — treating as stuck`,
            ),
          ),
        timeoutMs,
      ),
    ),
  ])
}
