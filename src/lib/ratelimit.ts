import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const hasRedisConfig =
  process.env.UPSTASH_REDIS_REST_URL &&
  !process.env.UPSTASH_REDIS_REST_URL.includes('placeholder') &&
  process.env.UPSTASH_REDIS_REST_TOKEN &&
  process.env.UPSTASH_REDIS_REST_TOKEN !== 'placeholder'

const ratelimit = hasRedisConfig
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      analytics: true,
      prefix: 'ratelimit:chat',
    })
  : null

/**
 * Rate limiter that gracefully degrades when Upstash is not configured.
 * Returns { success: true } if Redis is unavailable, allowing requests through.
 */
export const chatRatelimit = {
  async limit(key: string) {
    if (!ratelimit) return { success: true }
    try {
      return await ratelimit.limit(key)
    } catch (err) {
      console.warn('Rate limit check failed, allowing request:', err)
      return { success: true }
    }
  },
}
