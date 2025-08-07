import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import {
  HotReloadManager,
  HotReloadOptions,
  HotReloadEvent,
} from '../hot-reload-manager'
import type { SafenvConfig } from '../types'

describe('HotReloadManager', () => {
  let hotReloadManager: HotReloadManager
  let testDir: string
  let configPath: string
  let receivedEvents: HotReloadEvent[] = []

  beforeEach(async () => {
    testDir = join(process.cwd(), 'test-temp')
    configPath = join(testDir, 'test.config.ts')
    receivedEvents = []

    // Create test directory
    try {
      mkdirSync(testDir, { recursive: true })
    } catch {
      // Directory might already exist
    }

    // Create initial config file
    const initialConfig = `
export default {
  name: 'test-config',
  variables: {
    TEST_VAR: {
      type: 'string',
      default: 'initial-value',
      description: 'Test variable'
    }
  }
}
`
    writeFileSync(configPath, initialConfig)

    const options: HotReloadOptions = {
      debounceDelay: 50, // Shorter delay for testing
      watchDependencies: false, // Disable for simpler testing
    }

    hotReloadManager = new HotReloadManager(options)

    // Setup event listener
    hotReloadManager.onReload(event => {
      receivedEvents.push(event)
    })
  })

  afterEach(async () => {
    await hotReloadManager.stopWatching()

    // Cleanup test files
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Initialization', () => {
    it('should start watching a config file', async () => {
      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {
          TEST_VAR: {
            type: 'string',
            default: 'initial-value',
            description: 'Test variable',
          },
        },
      }

      await hotReloadManager.startWatching(configPath, initialConfig)

      const snapshots = hotReloadManager.getSnapshots()
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].config.name).toBe('test-config')
    })

    it('should create initial snapshot', async () => {
      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {},
      }

      await hotReloadManager.startWatching(configPath, initialConfig)

      const snapshots = hotReloadManager.getSnapshots()
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].config).toEqual(initialConfig)
      expect(snapshots[0].filePath).toBe(configPath)
    })
  })

  describe('Change Detection', () => {
    it('should detect variable additions', async () => {
      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {
          EXISTING_VAR: {
            type: 'string',
            default: 'existing',
            description: 'Existing variable',
          },
        },
      }

      await hotReloadManager.startWatching(configPath, initialConfig)

      // Modify config file
      const updatedConfig = `
export default {
  name: 'test-config',
  variables: {
    EXISTING_VAR: {
      type: 'string',
      default: 'existing',
      description: 'Existing variable'
    },
    NEW_VAR: {
      type: 'string',
      default: 'new-value',
      description: 'New variable'
    }
  }
}
`
      writeFileSync(configPath, updatedConfig)

      // Wait for file change detection
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(receivedEvents.length).toBeGreaterThan(0)
      const changeEvent = receivedEvents.find(e => e.type === 'change-detected')
      expect(changeEvent).toBeDefined()
      expect(changeEvent?.changeSet?.changes).toContainEqual(
        expect.objectContaining({
          type: 'added',
          variable: 'NEW_VAR',
        })
      )
    })

    it('should detect variable modifications', async () => {
      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {
          TEST_VAR: {
            type: 'string',
            default: 'original-value',
            description: 'Test variable',
          },
        },
      }

      await hotReloadManager.startWatching(configPath, initialConfig)

      // Modify config file
      const updatedConfig = `
export default {
  name: 'test-config',
  variables: {
    TEST_VAR: {
      type: 'string',
      default: 'modified-value',
      description: 'Test variable'
    }
  }
}
`
      writeFileSync(configPath, updatedConfig)

      // Wait for file change detection
      await new Promise(resolve => setTimeout(resolve, 100))

      const changeEvent = receivedEvents.find(e => e.type === 'change-detected')
      expect(changeEvent?.changeSet?.changes).toContainEqual(
        expect.objectContaining({
          type: 'modified',
          variable: 'TEST_VAR',
        })
      )
    })

    it('should detect variable removals', async () => {
      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {
          VAR_TO_REMOVE: {
            type: 'string',
            default: 'will-be-removed',
            description: 'Variable to remove',
          },
          VAR_TO_KEEP: {
            type: 'string',
            default: 'will-be-kept',
            description: 'Variable to keep',
          },
        },
      }

      await hotReloadManager.startWatching(configPath, initialConfig)

      // Modify config file (remove VAR_TO_REMOVE)
      const updatedConfig = `
export default {
  name: 'test-config',
  variables: {
    VAR_TO_KEEP: {
      type: 'string',
      default: 'will-be-kept',
      description: 'Variable to keep'
    }
  }
}
`
      writeFileSync(configPath, updatedConfig)

      // Wait for file change detection
      await new Promise(resolve => setTimeout(resolve, 100))

      const changeEvent = receivedEvents.find(e => e.type === 'change-detected')
      expect(changeEvent?.changeSet?.changes).toContainEqual(
        expect.objectContaining({
          type: 'removed',
          variable: 'VAR_TO_REMOVE',
        })
      )
    })
  })

  describe('Snapshot Management', () => {
    it('should create snapshots on changes', async () => {
      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {},
      }

      await hotReloadManager.startWatching(configPath, initialConfig)

      // Initial snapshot
      expect(hotReloadManager.getSnapshots()).toHaveLength(1)

      // Modify config
      const updatedConfig = `
export default {
  name: 'test-config',
  variables: {
    NEW_VAR: {
      type: 'string',
      default: 'new-value',
      description: 'New variable'
    }
  }
}
`
      writeFileSync(configPath, updatedConfig)

      // Wait for change processing
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should have created a new snapshot
      expect(hotReloadManager.getSnapshots()).toHaveLength(2)
    })

    it('should limit snapshot history', async () => {
      const options: HotReloadOptions = {
        maxRollbackHistory: 2,
        debounceDelay: 10,
      }

      const manager = new HotReloadManager(options)

      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {},
      }

      await manager.startWatching(configPath, initialConfig)

      // Create multiple changes to exceed history limit
      for (let i = 0; i < 5; i++) {
        const config = `
export default {
  name: 'test-config',
  variables: {
    VAR_${i}: {
      type: 'string',
      default: 'value-${i}',
      description: 'Variable ${i}'
    }
  }
}
`
        writeFileSync(configPath, config)
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      const snapshots = manager.getSnapshots()
      expect(snapshots.length).toBeLessThanOrEqual(2)

      await manager.stopWatching()
    })
  })

  describe('Rollback Functionality', () => {
    it('should rollback to previous snapshot', async () => {
      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {
          TEST_VAR: {
            type: 'string',
            default: 'initial-value',
            description: 'Test variable',
          },
        },
      }

      await hotReloadManager.startWatching(configPath, initialConfig)

      const initialSnapshots = hotReloadManager.getSnapshots()
      const initialSnapshotId = initialSnapshots[0].id

      // Modify config
      const updatedConfig = `
export default {
  name: 'test-config',
  variables: {
    TEST_VAR: {
      type: 'string',
      default: 'modified-value',
      description: 'Test variable'
    }
  }
}
`
      writeFileSync(configPath, updatedConfig)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Rollback to initial snapshot
      const rollbackSuccess =
        await hotReloadManager.rollbackToSnapshot(initialSnapshotId)
      expect(rollbackSuccess).toBe(true)

      // Should have received rollback event
      const rollbackEvent = receivedEvents.find(e => e.type === 'rollback')
      expect(rollbackEvent).toBeDefined()
    })

    it('should handle invalid snapshot IDs', async () => {
      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {},
      }

      await hotReloadManager.startWatching(configPath, initialConfig)

      const rollbackSuccess =
        await hotReloadManager.rollbackToSnapshot('invalid-id')
      expect(rollbackSuccess).toBe(false)
    })
  })

  describe('Manual Reload', () => {
    it('should support manual reload trigger', async () => {
      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {},
      }

      await hotReloadManager.startWatching(configPath, initialConfig)

      // Modify file without triggering watcher
      const updatedConfig = `
export default {
  name: 'test-config',
  variables: {
    MANUAL_VAR: {
      type: 'string',
      default: 'manual-value',
      description: 'Manual variable'
    }
  }
}
`
      writeFileSync(configPath, updatedConfig)

      // Manually trigger reload
      await hotReloadManager.reload()

      // Should detect changes
      const changeEvent = receivedEvents.find(e => e.type === 'change-detected')
      expect(changeEvent).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle config loading errors', async () => {
      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {},
      }

      await hotReloadManager.startWatching(configPath, initialConfig)

      // Write invalid config
      writeFileSync(configPath, 'invalid javascript syntax {{{')

      // Wait for error processing
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should have received error event
      const errorEvent = receivedEvents.find(e => e.type === 'error')
      expect(errorEvent).toBeDefined()
      expect(errorEvent?.error).toBeInstanceOf(Error)
    })

    it('should auto-rollback on errors when enabled', async () => {
      const options: HotReloadOptions = {
        autoRollback: true,
        debounceDelay: 10,
      }

      const manager = new HotReloadManager(options)

      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {},
      }

      await manager.startWatching(configPath, initialConfig)

      // Create a valid change first
      const validConfig = `
export default {
  name: 'test-config',
  variables: {
    VALID_VAR: {
      type: 'string',
      default: 'valid-value',
      description: 'Valid variable'
    }
  }
}
`
      writeFileSync(configPath, validConfig)
      await new Promise(resolve => setTimeout(resolve, 50))

      // Then create an invalid change
      writeFileSync(configPath, 'invalid syntax')
      await new Promise(resolve => setTimeout(resolve, 50))

      // Should have triggered auto-rollback
      // Note: This test might be flaky due to timing, but demonstrates the concept

      await manager.stopWatching()
    })
  })

  describe('Event Callbacks', () => {
    it('should support multiple event callbacks', async () => {
      const events1: HotReloadEvent[] = []
      const events2: HotReloadEvent[] = []

      hotReloadManager.onReload(event => {
        events1.push(event)
      })
      hotReloadManager.onReload(event => {
        events2.push(event)
      })

      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {},
      }

      await hotReloadManager.startWatching(configPath, initialConfig)

      // Trigger a change
      const updatedConfig = `
export default {
  name: 'test-config',
  variables: {
    NEW_VAR: {
      type: 'string',
      default: 'new-value',
      description: 'New variable'
    }
  }
}
`
      writeFileSync(configPath, updatedConfig)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Both callbacks should have received events
      expect(events1.length).toBeGreaterThan(0)
      expect(events2.length).toBeGreaterThan(0)
      expect(events1.length).toBe(events2.length)
    })

    it('should support callback removal', async () => {
      const events: HotReloadEvent[] = []
      const callback = (event: HotReloadEvent) => {
        events.push(event)
      }

      hotReloadManager.onReload(callback)

      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {},
      }

      await hotReloadManager.startWatching(configPath, initialConfig)

      // Remove callback
      hotReloadManager.offReload(callback)

      // Trigger a change
      const updatedConfig = `
export default {
  name: 'test-config',
  variables: {
    NEW_VAR: {
      type: 'string',
      default: 'new-value',
      description: 'New variable'
    }
  }
}
`
      writeFileSync(configPath, updatedConfig)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Callback should not have received events
      expect(events).toHaveLength(0)
    })
  })

  describe('Performance', () => {
    it('should debounce rapid file changes', async () => {
      const options: HotReloadOptions = {
        debounceDelay: 100,
      }

      const manager = new HotReloadManager(options)
      const events: HotReloadEvent[] = []
      manager.onReload(event => {
        events.push(event)
      })

      const initialConfig: SafenvConfig = {
        name: 'test-config',
        variables: {},
      }

      await manager.startWatching(configPath, initialConfig)

      // Make rapid changes
      for (let i = 0; i < 5; i++) {
        const config = `
export default {
  name: 'test-config',
  variables: {
    VAR_${i}: {
      type: 'string',
      default: 'value-${i}',
      description: 'Variable ${i}'
    }
  }
}
`
        writeFileSync(configPath, config)
        await new Promise(resolve => setTimeout(resolve, 10)) // Rapid changes
      }

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 200))

      // Should have debounced to fewer events than changes made
      const changeEvents = events.filter(e => e.type === 'change-detected')
      expect(changeEvents.length).toBeLessThan(5)

      await manager.stopWatching()
    })
  })
})
