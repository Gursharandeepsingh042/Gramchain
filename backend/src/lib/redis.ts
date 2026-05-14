import { createClient } from 'redis'

let redisClient: ReturnType<typeof createClient> | null = null

export const getRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.warn('⚠️  REDIS_URL not set — running without Redis (BullMQ jobs disabled)')
    return null
  }

  if (!redisClient) {
    try {
      redisClient = createClient({ url: process.env.REDIS_URL })
      redisClient.on('error', (err) => console.error('Redis error:', err))
      await redisClient.connect()
      console.log('✅ Redis connected')
    } catch (err) {
      // Don't break the request flow if Redis is unreachable — fall back to no-cache mode.
      // Callers already handle `null` return as "Redis disabled".
      console.error('⚠️  Redis connect failed — continuing without Redis:', (err as Error).message)
      redisClient = null
      return null
    }
  }

  return redisClient
}

// Synchronous accessor (for BullMQ connection config)
export const redisConnection = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : undefined
