import { watch } from 'chokidar'
import { SafenvCore } from './core.ts'
import type { SafenvOptions } from './types.ts'

export class SafenvServer extends SafenvCore {
  private watcher: any = null

  constructor(options: SafenvOptions = {}) {
    super({ ...options })
  }

  async start(): Promise<void> {
    await this.run()

    // 服务器模式默认启用监听
    if (true) {
      this.startWatching()
    }
  }

  private startWatching(): void {
    const watchPatterns = [`${this.options.configFile}.*`, '**/*.safenv.*']

    this.watcher = watch(watchPatterns, {
      ignored: ['node_modules/**', '.git/**'],
      persistent: true,
    })

    this.watcher.on('change', async (path: string) => {
      console.log(`Config changed: ${path}`)
      try {
        await this.run()
        console.log('Safenv updated successfully')
      } catch (error) {
        console.error('Error updating safenv:', error)
      }
    })

    console.log('Watching for config changes...')
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
  }
}
