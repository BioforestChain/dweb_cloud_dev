import { SafenvCore } from './core.ts'
import { SafenvServer } from './server.ts'
import { SafenvWorkspace } from './workspace.ts'
import { SafenvBuilder } from './builder.ts'
import type { SafenvOptions } from './types.ts'

export * from './types.ts'
export * from './config-builder.ts'
export { SafenvCore } from './core.ts'
export { SafenvServer } from './server.ts'
export { SafenvWorkspace } from './workspace.ts'
export { SafenvBuilder } from './builder.ts'
export { UIServer } from './ui-server.ts'
export { NpmSafenvResolver } from './npm-safenv-resolver.ts'
export * from './plugins/index.ts'
export * from './adapters.ts'

// Safenv 配置定义函数 - 提供类型安全的配置定义
export function defineConfig(options: SafenvOptions): SafenvOptions {
  return options
}

// Safenv 实例创建函数 - 基于配置创建相应实例
export function createSafenv(
  options: SafenvOptions = {}
): SafenvCore | SafenvServer | SafenvWorkspace {
  // 类型推断优先级（基于 Safenv VAL 管理理念）

  // 1. 工作空间配置优先 - 自动发现或指定项目路径
  if (options.workspace) {
    return new SafenvWorkspace(options)
  }

  // 2. 服务器配置 - 用于 web-ui 和 html-tools
  if (options.server) {
    return new SafenvServer(options)
  }

  // 3. 默认核心实例 - VAL 管理和插件执行
  return new SafenvCore(options)
}
