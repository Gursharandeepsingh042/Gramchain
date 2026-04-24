import { createClient } from 'redis'

let redisClient: ReturnType<typeof createClient> | null = null

export const getRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.warn('⚠️  REDIS_URL not set — running without Redis (BullMQ jobs disabled)')
    return null
  }

  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL })
    redisClient.on('error', (err) => console.error('Redis error:', err))
    await redisClient.connect()
    console.log('✅ Redis connected')
  }

  return redisClient
}

// Synchronous accessor (for BullMQ connection config)
export const redisConnection = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : undefined
