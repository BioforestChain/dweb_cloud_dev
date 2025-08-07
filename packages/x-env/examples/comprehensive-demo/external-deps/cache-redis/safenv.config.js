export default {
  variables: {
    REDIS_URL: {
      type: 'string',
      required: true,
      description: 'Redis connection URL',
      validate: value => {
        const redisUrlPattern = /^redis:\/\/.+/
        return (
          redisUrlPattern.test(value) ||
          'Must be a valid Redis URL (redis://...)'
        )
      },
    },
    REDIS_PASSWORD: {
      type: 'string',
      required: false,
      description: 'Redis authentication password',
    },
    REDIS_DB: {
      type: 'number',
      default: 0,
      description: 'Redis database number (0-15)',
      validate: value =>
        (value >= 0 && value <= 15) || 'Redis DB must be between 0 and 15',
    },
    REDIS_KEY_PREFIX: {
      type: 'string',
      default: 'app:',
      description: 'Prefix for all Redis keys',
    },
    REDIS_TTL_DEFAULT: {
      type: 'number',
      default: 3600,
      description: 'Default TTL for cached items in seconds',
    },
    REDIS_MAX_RETRIES: {
      type: 'number',
      default: 3,
      description: 'Maximum connection retry attempts',
    },
    ENABLE_REDIS_CLUSTER: {
      type: 'boolean',
      default: false,
      description: 'Enable Redis cluster mode',
    },
  },
}
