import { watch } from 'chokidar'
import { SafenvCore } from './core.ts'
import type { SafenvOptions } from './types.ts'

export class SafenvServer extends SafenvCore {
  private watcher: any = null

  // 访问父类的 pluginManager
  protected get pluginManager() {
    return (this as any).pluginManager
  }

  constructor(options: SafenvOptions = {}) {
    super({ ...options })
  }

  async start(): Promise<void> {
    await this.run()

    // 服务器模式默认启用监听
    this.startWatching()
  }

  private startWatching(): void {
    const watchPatterns = [`${this.options.configFile}.*`, '**/*.safenv.*']

    this.watcher = watch(watchPatterns, {
      ignored: ['node_modules/**', '.git/**'],
      persistent: true,
    })

    this.watcher.on('change', async (path: string) => {
      console.log(`📁 Config changed: ${path}`)

      try {
        // 触发文件变化生命周期钩子
        if (this.pluginManager) {
          await this.pluginManager.executePhase(
            'onFileChange' as any,
            {} as any,
            [path]
          )
        }

        await this.run()
        console.log('✅ Safenv updated successfully')
      } catch (error) {
        console.error('❌ Error updating safenv:', error)

        // 触发错误处理钩子
        if (this.pluginManager && error instanceof Error) {
          const safenvError = error as any
          safenvError.phase = 'onFileChange'
          await this.pluginManager
            .executePhase('onError', {} as any, safenvError)
            .catch(() => {})
        }
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
