interface ApiClientConfig {
  baseURL: string
  timeout: number
}

export interface ApiClient {
  get(path: string): Promise<any>
  post(path: string, data: any): Promise<any>
  put(path: string, data: any): Promise<any>
  delete(path: string): Promise<any>
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  console.log(`Creating API client with base URL: ${config.baseURL}`)
  console.log(`API timeout set to: ${config.timeout}ms`)

  return {
    async get(path: string) {
      console.log(`[API] GET ${config.baseURL}${path}`)
      // 模拟API调用
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ status: 'success', data: `Mock data for ${path}` })
        }, 100)
      })
    },

    async post(path: string, data: any) {
      console.log(`[API] POST ${config.baseURL}${path}`, data)
      // 模拟API调用
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ status: 'success', data: 'Created successfully' })
        }, 100)
      })
    },

    async put(path: string, data: any) {
      console.log(`[API] PUT ${config.baseURL}${path}`, data)
      // 模拟API调用
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ status: 'success', data: 'Updated successfully' })
        }, 100)
      })
    },

    async delete(path: string) {
      console.log(`[API] DELETE ${config.baseURL}${path}`)
      // 模拟API调用
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ status: 'success', data: 'Deleted successfully' })
        }, 100)
      })
    },
  }
}
