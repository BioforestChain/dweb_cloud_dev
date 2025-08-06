#!/usr/bin/env node --experimental-strip-types

import { config } from 'dotenv'

// 加载测试环境变量
config({ path: '.env.test' })

console.log('Environment variables after loading .env.test:')
console.log('APP_NAME:', process.env.APP_NAME)
console.log('APP_PORT:', process.env.APP_PORT)
console.log('API_BASE_URL:', process.env.API_BASE_URL)
console.log('API_TIMEOUT:', process.env.API_TIMEOUT)
console.log('ENABLE_AUTH:', process.env.ENABLE_AUTH)
console.log('ENABLE_ANALYTICS:', process.env.ENABLE_ANALYTICS)
console.log('STATIC_PATH:', process.env.STATIC_PATH)
console.log('MAX_UPLOAD_SIZE:', process.env.MAX_UPLOAD_SIZE)
