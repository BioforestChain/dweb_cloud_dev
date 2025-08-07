// Auth Service Package - Demo Implementation
module.exports = {
  name: 'auth-service',
  version: '2.1.0',
  description: 'Authentication service with JWT and OAuth support',

  // Mock functions for demo purposes
  generateJWT: payload => {
    console.log('🔐 Generating JWT token for:', payload)
    return 'mock-jwt-token'
  },

  verifyJWT: token => {
    console.log('🔍 Verifying JWT token:', token)
    return { valid: true, payload: { userId: 123 } }
  },

  hashPassword: _password => {
    console.log('🔒 Hashing password')
    return 'hashed-password'
  },

  // Required environment variables
  requiredEnvVars: [
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'PASSWORD_SALT_ROUNDS',
    'ENABLE_2FA',
  ],

  // Optional OAuth variables
  optionalEnvVars: [
    'OAUTH_GOOGLE_CLIENT_ID',
    'OAUTH_GOOGLE_CLIENT_SECRET',
    'OAUTH_GITHUB_CLIENT_ID',
    'OAUTH_GITHUB_CLIENT_SECRET',
  ],
}
