import { SafenvCore } from './core.ts'
import { SafenvServer } from './server.ts'
import { SafenvBuilder } from './builder.ts'
import { SafenvWorkspace } from './workspace.ts'
import type { SafenvOptions } from './types.ts'

export * from './types.ts'
export * from './config-builder.ts'
export { SafenvCore } from './core.ts'
export { SafenvServer } from './server.ts'
export { SafenvBuilder } from './builder.ts'
export { SafenvWorkspace } from './workspace.ts'
export { UIServer } from './ui-server.ts'
export { NpmSafenvResolver } from './npm-safenv-resolver.ts'
export * from './plugins/index.ts'
export * from './adapters.ts'

export function createSafenv(options: SafenvOptions = {}) {
  return new SafenvCore(options)
}

export function createServer(options: SafenvOptions = {}) {
  return new SafenvServer(options)
}

export function createBuilder(options: SafenvOptions = {}) {
  return new SafenvBuilder(options)
}

export function createWorkspace(options: SafenvOptions = {}) {
  return new SafenvWorkspace(options)
}
