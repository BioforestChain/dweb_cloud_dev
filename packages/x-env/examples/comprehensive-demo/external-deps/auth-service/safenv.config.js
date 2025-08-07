export default {
  variables: {
    JWT_SECRET: {
      type: 'string',
      required: true,
      description: 'Secret key for JWT token signing and verification',
      validate: value =>
        value.length >= 32 || 'JWT secret must be at least 32 characters long',
    },
    JWT_EXPIRES_IN: {
      type: 'string',
      default: '7d',
      description: 'JWT token expiration time (e.g., "7d", "24h", "60m")',
    },
    OAUTH_GOOGLE_CLIENT_ID: {
      type: 'string',
      required: false,
      description: 'Google OAuth client ID for social authentication',
    },
    OAUTH_GOOGLE_CLIENT_SECRET: {
      type: 'string',
      required: false,
      description: 'Google OAuth client secret',
    },
    OAUTH_GITHUB_CLIENT_ID: {
      type: 'string',
      required: false,
      description: 'GitHub OAuth client ID for social authentication',
    },
    OAUTH_GITHUB_CLIENT_SECRET: {
      type: 'string',
      required: false,
      description: 'GitHub OAuth client secret',
    },
    PASSWORD_SALT_ROUNDS: {
      type: 'number',
      default: 12,
      description: 'Number of salt rounds for password hashing',
      validate: value =>
        (value >= 10 && value <= 15) || 'Salt rounds must be between 10 and 15',
    },
    ENABLE_2FA: {
      type: 'boolean',
      default: false,
      description: 'Enable two-factor authentication support',
    },
  },
}
