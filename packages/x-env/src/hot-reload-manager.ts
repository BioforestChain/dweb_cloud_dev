import { watch, FSWatcher } from 'chokidar'
import { resolve, dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import type { SafenvConfig, SafenvContext } from './types.ts'
import { loadConfig } from 'unconfig'
import { EnhancedVariableResolver } from './enhanced-variable-resolver.ts'

/**
 * 配置变更类型
 */
export type ChangeType =
  | 'added' // 新增变量
  | 'modified' // 修改变量
  | 'removed' // 删除变量
  | 'renamed' // 重命名变量
  | 'dependency' // 依赖变更

/**
 * 配置变更详情
 */
export interface ConfigChange {
  type: ChangeType
  path: string
  variable?: string
  oldValue?: any
  newValue?: any
  timestamp: number
}

/**
 * 变更集合
 */
export interface ChangeSet {
  id: string
  timestamp: number
  changes: ConfigChange[]
  affectedVariables: string[]
  affectedPlugins: string[]
  rollbackData?: any
}

/**
 * 热更新选项
 */
export interface HotReloadOptions {
  /** 监听的文件模式 */
  watchPatterns?: string[]
  /** 忽略的文件模式 */
  ignorePatterns?: string[]
  /** 防抖延迟（毫秒） */
  debounceDelay?: number
  /** 防抖延迟（毫秒） - 兼容属性 */
  debounceMs?: number
  /** 是否启用增量更新 */
  incrementalUpdate?: boolean
  /** 是否自动回滚失败的更新 */
  autoRollback?: boolean
  /** 最大回滚历史数量 */
  maxRollbackHistory?: number
  /** 最大快照数量 */
  maxSnapshots?: number
  /** 是否监听依赖文件 */
  watchDependencies?: boolean
  /** 变更回调函数 */
  onChange?: (changes: ConfigChange[]) => Promise<void>
  /** 自定义变更检测器 */
  customChangeDetector?: (
    oldConfig: SafenvConfig,
    newConfig: SafenvConfig
  ) => ConfigChange[]
}

/**
 * 热更新事件
 */
export interface HotReloadEvent {
  type: 'reload' | 'error' | 'rollback' | 'change-detected'
  changeSet?: ChangeSet
  error?: Error
  context?: SafenvContext
}

/**
 * 热更新回调函数
 */
export type HotReloadCallback = (event: HotReloadEvent) => void | Promise<void>

/**
 * 配置快照
 */
interface ConfigSnapshot {
  id: string
  timestamp: number
  config: SafenvConfig
  resolvedVariables: Record<string, any>
  hash: string
  filePath: string
}

/**
 * 智能热更新管理器
 * 支持增量更新、回滚机制、依赖追踪等高级功能
 */
export class HotReloadManager {
  private watchers: Map<string, FSWatcher> = new Map()
  private snapshots: ConfigSnapshot[] = []
  private callbacks: HotReloadCallback[] = []
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private variableResolver: EnhancedVariableResolver
  private dependencyFiles: Set<string> = new Set()
  private configPath: string | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  private dependencyPaths = new Set<string>()
  private options: Required<HotReloadOptions>
  private currentConfig: SafenvConfig | null = null

  constructor(options: HotReloadOptions = {}) {
    this.options = {
      watchPatterns: ['**/*.json', '**/*.js', '**/*.ts'],
      ignorePatterns: ['**/node_modules/**', '**/.git/**'],
      debounceDelay: 300,
      debounceMs: 300,
      incrementalUpdate: true,
      autoRollback: true,
      maxRollbackHistory: 10,
      maxSnapshots: 50,
      watchDependencies: true,
      onChange: options.onChange || (async () => {}),
      customChangeDetector:
        options.customChangeDetector || this.defaultChangeDetector.bind(this),
      ...options,
    }
    this.variableResolver = new EnhancedVariableResolver()
  }

  /**
   * 默认变更检测器
   */
  private defaultChangeDetector(
    oldConfig: SafenvConfig,
    newConfig: SafenvConfig
  ): ConfigChange[] {
    const changes: ConfigChange[] = []

    // 简单的深度比较检测变更
    if (JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
      changes.push({
        type: 'modified' as const,
        path: 'config',
        oldValue: oldConfig,
        newValue: newConfig,
        timestamp: Date.now(),
      })
    }

    return changes
  }

  /**
   * 开始监听配置文件
   */
  async startWatching(
    configPath: string,
    initialConfig: SafenvConfig
  ): Promise<void> {
    this.configPath = resolve(configPath)
    this.currentConfig = initialConfig

    // 创建初始快照
    await this.createSnapshot(initialConfig, this.configPath)

    // 监听主配置文件
    await this.watchFile(this.configPath)

    // 监听依赖文件
    if (this.options.watchDependencies) {
      await this.discoverAndWatchDependencies(initialConfig)
    }

    console.log(`🔥 Hot reload started for: ${this.configPath}`)
  }

  /**
   * 停止监听
   */
  async stopWatching(): Promise<void> {
    // 清理定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    // 关闭所有文件监听器
    for (const [path, watcher] of this.watchers) {
      await watcher.close()
      console.log(`📴 Stopped watching: ${path}`)
    }

    this.watchers.clear()
    this.dependencyPaths.clear()
    console.log('🔥 Hot reload stopped')
  }

  /**
   * 添加热更新回调
   */
  onReload(callback: HotReloadCallback): void {
    this.callbacks.push(callback)
  }

  /**
   * 移除热更新回调
   */
  offReload(callback: HotReloadCallback): void {
    const index = this.callbacks.indexOf(callback)
    if (index > -1) {
      this.callbacks.splice(index, 1)
    }
  }

  /**
   * 手动触发重新加载
   */
  async reload(): Promise<void> {
    if (!this.configPath) {
      throw new Error('Hot reload not initialized')
    }

    await this.handleConfigChange(this.configPath)
  }

  /**
   * 回滚到指定快照
   */
  async rollbackToSnapshot(snapshotId: string): Promise<boolean> {
    const snapshot = this.snapshots.find(s => s.id === snapshotId)
    if (!snapshot) {
      console.warn(`Snapshot ${snapshotId} not found`)
      return false
    }

    try {
      this.currentConfig = snapshot.config

      const event: HotReloadEvent = {
        type: 'rollback',
        changeSet: {
          id: `rollback-${Date.now()}`,
          timestamp: Date.now(),
          changes: [
            {
              type: 'modified',
              path: snapshot.filePath,
              timestamp: Date.now(),
            },
          ],
          affectedVariables: Object.keys(snapshot.config.variables),
          affectedPlugins:
            snapshot.config.plugins?.map(p =>
              typeof p === 'string' ? p : p.name
            ) || [],
        },
      }

      await this.notifyCallbacks(event)
      console.log(`🔄 Rolled back to snapshot: ${snapshotId}`)
      return true
    } catch (error) {
      console.error('Failed to rollback:', error)
      return false
    }
  }

  /**
   * 获取快照历史
   */
  getSnapshots(): ConfigSnapshot[] {
    return [...this.snapshots]
  }

  /**
   * 清理旧快照
   */
  cleanupSnapshots(): void {
    if (this.snapshots.length > this.options.maxRollbackHistory) {
      const toRemove = this.snapshots.length - this.options.maxRollbackHistory
      this.snapshots.splice(0, toRemove)
      console.log(`🧹 Cleaned up ${toRemove} old snapshots`)
    }
  }

  /**
   * 监听单个文件
   */
  private async watchFile(filePath: string): Promise<void> {
    if (this.watchers.has(filePath)) {
      return // 已经在监听
    }

    const watcher = watch(filePath, {
      ignored: this.options.ignorePatterns,
      persistent: true,
      ignoreInitial: true,
    })

    watcher.on('change', () => {
      this.debouncedHandleChange(filePath)
    })

    watcher.on('error', error => {
      console.error(`File watcher error for ${filePath}:`, error)
      this.notifyCallbacks({ type: 'error', error })
    })

    this.watchers.set(filePath, watcher)
    console.log(`👀 Watching: ${filePath}`)
  }

  /**
   * 防抖处理配置变更
   */
  private debouncedHandleChange(filePath: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.handleConfigChange(filePath)
    }, this.options.debounceDelay)
  }

  /**
   * 处理配置文件变更
   */
  private async handleConfigChange(filePath: string): Promise<void> {
    try {
      console.log(`📝 Config change detected: ${filePath}`)

      // 加载新配置
      const newConfig = await this.loadConfigFromPath(filePath)
      if (!newConfig) {
        throw new Error(`Failed to load config from ${filePath}`)
      }

      // 检测变更
      const changes = this.detectChanges(this.currentConfig!, newConfig)

      if (changes.length === 0) {
        console.log('📄 No significant changes detected')
        return
      }

      // 创建变更集
      const changeSet: ChangeSet = {
        id: this.generateChangeSetId(),
        timestamp: Date.now(),
        changes,
        affectedVariables: this.extractAffectedVariables(changes),
        affectedPlugins: this.extractAffectedPlugins(changes, newConfig),
        rollbackData: this.currentConfig,
      }

      // 通知变更检测
      await this.notifyCallbacks({
        type: 'change-detected',
        changeSet,
      })

      // 创建新快照
      await this.createSnapshot(newConfig, filePath)

      // 应用变更
      if (this.options.incrementalUpdate) {
        await this.applyIncrementalUpdate(changeSet, newConfig)
      } else {
        await this.applyFullReload(newConfig)
      }

      this.currentConfig = newConfig
    } catch (error) {
      console.error('Failed to handle config change:', error)

      const errorEvent: HotReloadEvent = {
        type: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      }

      await this.notifyCallbacks(errorEvent)

      // 自动回滚
      if (this.options.autoRollback && this.snapshots.length > 1) {
        const lastSnapshot = this.snapshots[this.snapshots.length - 2]
        console.log('🔄 Auto-rollback triggered')
        await this.rollbackToSnapshot(lastSnapshot.id)
      }
    }
  }

  /**
   * 从路径加载配置
   */
  private async loadConfigFromPath(
    filePath: string
  ): Promise<SafenvConfig | null> {
    try {
      const { config } = await loadConfig<SafenvConfig>({
        sources: [
          {
            files: [filePath],
          },
        ],
      })
      return config
    } catch (error) {
      console.error(`Failed to load config from ${filePath}:`, error)
      return null
    }
  }

  /**
   * 检测配置变更
   */
  private detectChanges(
    oldConfig: SafenvConfig,
    newConfig: SafenvConfig
  ): ConfigChange[] {
    const changes: ConfigChange[] = []

    // 使用自定义变更检测器
    if (this.options.customChangeDetector) {
      return this.options.customChangeDetector(oldConfig, newConfig)
    }

    // 检测变量变更
    const oldVars = oldConfig.variables || {}
    const newVars = newConfig.variables || {}

    // 检测新增和修改的变量
    for (const [varName, newVar] of Object.entries(newVars)) {
      const oldVar = oldVars[varName]

      if (!oldVar) {
        changes.push({
          type: 'added',
          path: this.configPath!,
          variable: varName,
          newValue: newVar,
          timestamp: Date.now(),
        })
      } else if (JSON.stringify(oldVar) !== JSON.stringify(newVar)) {
        changes.push({
          type: 'modified',
          path: this.configPath!,
          variable: varName,
          oldValue: oldVar,
          newValue: newVar,
          timestamp: Date.now(),
        })
      }
    }

    // 检测删除的变量
    for (const varName of Object.keys(oldVars)) {
      if (!newVars[varName]) {
        changes.push({
          type: 'removed',
          path: this.configPath!,
          variable: varName,
          oldValue: oldVars[varName],
          timestamp: Date.now(),
        })
      }
    }

    // 检测依赖变更
    const oldDeps = oldConfig.dependencies || []
    const newDeps = newConfig.dependencies || []

    if (JSON.stringify(oldDeps) !== JSON.stringify(newDeps)) {
      changes.push({
        type: 'dependency',
        path: this.configPath!,
        oldValue: oldDeps,
        newValue: newDeps,
        timestamp: Date.now(),
      })
    }

    return changes
  }

  /**
   * 应用增量更新
   */
  private async applyIncrementalUpdate(
    changeSet: ChangeSet,
    newConfig: SafenvConfig
  ): Promise<void> {
    console.log(
      `🔄 Applying incremental update (${changeSet.changes.length} changes)`
    )

    const event: HotReloadEvent = {
      type: 'reload',
      changeSet,
      context: {
        config: newConfig,
        resolvedVariables: await this.resolveVariables(newConfig),
        mode: 'serve',
        outputDir: './dist',
      },
    }

    await this.notifyCallbacks(event)
  }

  /**
   * 应用完整重新加载
   */
  private async applyFullReload(newConfig: SafenvConfig): Promise<void> {
    console.log('🔄 Applying full reload')

    const event: HotReloadEvent = {
      type: 'reload',
      context: {
        config: newConfig,
        resolvedVariables: await this.resolveVariables(newConfig),
        mode: 'serve',
        outputDir: './dist',
      },
    }

    await this.notifyCallbacks(event)
  }

  /**
   * 创建配置快照
   */
  private async createSnapshot(
    config: SafenvConfig,
    filePath: string
  ): Promise<void> {
    const snapshot: ConfigSnapshot = {
      id: this.generateSnapshotId(),
      timestamp: Date.now(),
      config: JSON.parse(JSON.stringify(config)), // 深拷贝
      resolvedVariables: await this.resolveVariables(config),
      hash: this.calculateConfigHash(config),
      filePath,
    }

    this.snapshots.push(snapshot)
    this.cleanupSnapshots()

    console.log(`📸 Created snapshot: ${snapshot.id}`)
  }

  /**
   * 发现并监听依赖文件
   */
  private async discoverAndWatchDependencies(
    config: SafenvConfig
  ): Promise<void> {
    if (!this.options.watchDependencies) {
      return
    }

    const dependencyFiles = await this.discoverDependencyFiles(config)

    for (const filePath of dependencyFiles) {
      if (!this.dependencyFiles.has(filePath) && existsSync(filePath)) {
        this.dependencyFiles.add(filePath)
        await this.watchFile(filePath)
        console.log(`👀 Watching dependency file: ${filePath}`)
      }
    }
  }

  /**
   * 发现依赖文件
   */
  private async discoverDependencyFiles(
    config: SafenvConfig
  ): Promise<string[]> {
    const files: string[] = []
    const configDir = dirname(this.configPath!)

    // 1. 扫描 package.json
    const packageJsonPath = join(configDir, 'package.json')
    if (existsSync(packageJsonPath)) {
      files.push(packageJsonPath)
    }

    // 2. 扫描 .env 文件
    const envFiles = [
      '.env',
      '.env.local',
      '.env.development',
      '.env.production',
    ]
    for (const envFile of envFiles) {
      const envPath = join(configDir, envFile)
      if (existsSync(envPath)) {
        files.push(envPath)
      }
    }

    // 3. 扫描依赖配置中的文件
    if (config.dependencies && Array.isArray(config.dependencies)) {
      for (const dep of config.dependencies) {
        if (typeof dep === 'string' && dep.endsWith('.json')) {
          const depPath = resolve(configDir, dep)
          if (existsSync(depPath)) {
            files.push(depPath)
          }
        }
      }
    }

    // 4. 扫描配置文件中引用的其他文件
    if (this.configPath) {
      const referencedFiles = await this.extractFileReferences(this.configPath)
      files.push(...referencedFiles)
    }

    return files
  }

  /**
   * 从配置文件中提取文件引用
   */
  private async extractFileReferences(configPath: string): Promise<string[]> {
    const files: string[] = []
    const configDir = dirname(configPath)

    try {
      const content = readFileSync(configPath, 'utf-8')

      // 匹配 import/require 语句中的相对路径
      const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g
      let match

      while ((match = importRegex.exec(content)) !== null) {
        const filePath = match[1]
        if (filePath.startsWith('./') || filePath.startsWith('../')) {
          const absolutePath = resolve(configDir, filePath)
          if (existsSync(absolutePath)) {
            files.push(absolutePath)
          }
          // 尝试添加常见扩展名
          for (const ext of ['.js', '.ts', '.json']) {
            const pathWithExt = absolutePath + ext
            if (existsSync(pathWithExt)) {
              files.push(pathWithExt)
            }
          }
        }
      }
    } catch (error) {
      console.warn(
        `Failed to extract file references from ${configPath}:`,
        error
      )
    }

    return files
  }

  /**
   * 提取受影响的变量
   */
  private extractAffectedVariables(changes: ConfigChange[]): string[] {
    const variables = new Set<string>()

    for (const change of changes) {
      if (change.variable) {
        variables.add(change.variable)
      }
    }

    return Array.from(variables)
  }

  /**
   * 提取受影响的插件
   */
  private extractAffectedPlugins(
    changes: ConfigChange[],
    newConfig: SafenvConfig
  ): string[] {
    const affectedPlugins = new Set<string>()
    const allPlugins =
      newConfig.plugins?.map(p => (typeof p === 'string' ? p : p.name)) || []

    for (const change of changes) {
      switch (change.type) {
        case 'added':
        case 'modified':
        case 'removed':
          // 检查变量变更是否影响特定插件
          if (change.variable) {
            const pluginsUsingVariable = this.findPluginsUsingVariable(
              change.variable,
              newConfig
            )
            pluginsUsingVariable.forEach(plugin => affectedPlugins.add(plugin))
          }
          break

        case 'dependency':
          // 依赖变更可能影响所有插件
          allPlugins.forEach(plugin => affectedPlugins.add(plugin))
          break

        default:
          // 其他类型的变更，检查是否是插件相关的配置变更
          if (change.path?.includes('plugin')) {
            allPlugins.forEach(plugin => affectedPlugins.add(plugin))
          }
      }
    }

    // 如果没有找到特定的受影响插件，但有变更，则认为所有插件都可能受影响
    if (affectedPlugins.size === 0 && changes.length > 0) {
      return allPlugins
    }

    return Array.from(affectedPlugins)
  }

  /**
   * 查找使用特定变量的插件
   */
  private findPluginsUsingVariable(
    variableName: string,
    config: SafenvConfig
  ): string[] {
    const plugins: string[] = []

    if (!config.plugins) {
      return plugins
    }

    for (const plugin of config.plugins) {
      const pluginName = typeof plugin === 'string' ? plugin : plugin.name

      // 检查插件配置中是否引用了该变量
      if (typeof plugin === 'object' && 'options' in plugin && plugin.options) {
        const optionsStr = JSON.stringify(plugin.options)
        if (
          optionsStr.includes(variableName) ||
          optionsStr.includes(`$\{${variableName}}`)
        ) {
          plugins.push(pluginName)
        }
      }

      // 一些常见的插件-变量关联规则
      if (this.isPluginAffectedByVariable(pluginName, variableName)) {
        plugins.push(pluginName)
      }
    }

    return plugins
  }

  /**
   * 判断插件是否受特定变量影响
   */
  private isPluginAffectedByVariable(
    pluginName: string,
    variableName: string
  ): boolean {
    // 定义一些常见的插件-变量关联规则
    const associations: Record<string, string[]> = {
      genTs: ['*'], // genTs 插件受所有变量影响
      genFile: ['*'], // genFile 插件受所有变量影响
      validation: ['*'], // 验证插件受所有变量影响
      database: ['DB_*', 'DATABASE_*'], // 数据库插件受数据库相关变量影响
      api: ['API_*', 'SERVER_*'], // API 插件受 API 相关变量影响
    }

    const patterns = associations[pluginName] || []

    for (const pattern of patterns) {
      if (pattern === '*') {
        return true
      }

      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1)
        if (variableName.startsWith(prefix)) {
          return true
        }
      } else if (pattern === variableName) {
        return true
      }
    }

    return false
  }

  /**
   * 解析配置中的变量
   */
  private async resolveVariables(
    config: SafenvConfig
  ): Promise<Record<string, any>> {
    try {
      const result = await this.variableResolver.resolveVariables(
        config.variables || {},
        {
          skipValidation: true, // 热更新时跳过验证以提高性能
          skipTransform: false,
          parallel: true,
          cache: true,
        }
      )
      return result.variables
    } catch (error) {
      console.warn('Failed to resolve variables during hot reload:', error)
      return {}
    }
  }

  /**
   * 通知所有回调
   */
  private async notifyCallbacks(event: HotReloadEvent): Promise<void> {
    for (const callback of this.callbacks) {
      try {
        await callback(event)
      } catch (error) {
        console.error('Hot reload callback error:', error)
      }
    }
  }

  /**
   * 生成快照 ID
   */
  private generateSnapshotId(): string {
    return `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 生成变更集 ID
   */
  private generateChangeSetId(): string {
    return `changeset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 计算配置哈希
   */
  private calculateConfigHash(config: SafenvConfig): string {
    const configStr = JSON.stringify(config, Object.keys(config).sort())
    return createHash('md5').update(configStr).digest('hex')
  }
}
