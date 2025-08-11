import { SafenvCore } from './core.ts'
import type { SafenvOptions } from './types.ts'

export class SafenvBuilder extends SafenvCore {
  constructor(options: SafenvOptions = {}) {
    super({ ...options })
  }

  async build(): Promise<void> {
    console.log('Building safenv configuration...')

    try {
      await this.run()
      console.log('Safenv build completed successfully')
    } catch (error) {
      console.error('Error building safenv:', error)
      throw error
    }
  }
}
