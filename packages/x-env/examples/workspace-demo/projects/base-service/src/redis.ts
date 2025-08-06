export interface RedisConfig {
  url: string
  defaultTTL: number
}

export interface RedisClient {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, ttl?: number) => Promise<void>
  del: (key: string) => Promise<void>
  exists: (key: string) => Promise<boolean>
  close: () => Promise<void>
  isConnected: () => boolean
}

export async function createRedisClient(
  config: RedisConfig
): Promise<RedisClient> {
  console.log(`Connecting to Redis: ${config.url}`)
  console.log(`Default TTL: ${config.defaultTTL} seconds`)

  // 模拟Redis连接过程
  await new Promise(resolve => setTimeout(resolve, 50))

  let connected = true
  const store = new Map<string, { value: string; expires: number }>()

  return {
    async get(key: string) {
      if (!connected) {
        throw new Error('Redis connection is closed')
      }

      const item = store.get(key)
      if (!item) {
        return null
      }

      if (Date.now() > item.expires) {
        store.delete(key)
        return null
      }

      console.log(`Redis GET: ${key} -> ${item.value}`)
      return item.value
    },

    async set(key: string, value: string, ttl?: number) {
      if (!connected) {
        throw new Error('Redis connection is closed')
      }

      const expires = Date.now() + (ttl || config.defaultTTL) * 1000
      store.set(key, { value, expires })

      console.log(
        `Redis SET: ${key} -> ${value} (TTL: ${ttl || config.defaultTTL}s)`
      )
    },

    async del(key: string) {
      if (!connected) {
        throw new Error('Redis connection is closed')
      }

      const deleted = store.delete(key)
      console.log(`Redis DEL: ${key} -> ${deleted ? 'deleted' : 'not found'}`)
    },

    async exists(key: string) {
      if (!connected) {
        throw new Error('Redis connection is closed')
      }

      const item = store.get(key)
      const exists = item ? Date.now() <= item.expires : false

      if (item && Date.now() > item.expires) {
        store.delete(key)
      }

      console.log(`Redis EXISTS: ${key} -> ${exists}`)
      return exists
    },

    async close() {
      console.log('Closing Redis connection')
      connected = false
      store.clear()
    },

    isConnected() {
      return connected
    },
  }
}
