#!/usr/bin/env node

import { program } from 'commander'
import {
  createSafenv,
  SafenvCore,
  SafenvServer,
  SafenvWorkspace,
  SafenvBuilder,
  UIServer,
} from './index.ts'

program
  .name('safenv')
  .description('Universal configuration, environment, and variable management')
  .version('0.1.0')

program
  .command('serve')
  .description('Start safenv in serve mode with file watching')
  .option('-c, --config <file>', 'Config file path', 'safenv.config')
  .option('-o, --output <dir>', 'Output directory', './dist')
  .option('--no-watch', 'Disable file watching')
  .action(async options => {
    const server = createSafenv({
      configFile: options.config,
      server: {
        port: 3000,
        host: 'localhost',
      },
    }) as SafenvServer

    try {
      await server.start()
      console.log('Safenv server started. Press Ctrl+C to stop.')

      process.on('SIGINT', async () => {
        console.log('\nStopping safenv server...')
        await server.stop()
        process.exit(0)
      })
    } catch (error) {
      console.error('Error starting server:', error)
      process.exit(1)
    }
  })

program
  .command('build')
  .description('Build safenv configuration once')
  .option('-c, --config <file>', 'Config file path', 'safenv.config')
  .option('-o, --output <dir>', 'Output directory', './dist')
  .action(async options => {
    const builder = new SafenvBuilder({
      configFile: options.config,
    })

    try {
      await builder.build()
    } catch (error) {
      console.error('Error building:', error)
      process.exit(1)
    }
  })

program
  .command('workspace')
  .description('Run workspace configuration')
  .option(
    '-c, --config <file>',
    'Workspace config file path',
    'workspace.config'
  )
  .action(async options => {
    const workspace = createSafenv({
      configFile: options.config,
      workspace: ['./packages/*'],
    }) as SafenvWorkspace

    try {
      await workspace.runWorkspace()
      console.log('Workspace configuration completed')
    } catch (error) {
      console.error('Error running workspace:', error)
      process.exit(1)
    }
  })

program
  .command('ui')
  .description('Start safenv web UI for configuration editing')
  .option('-c, --config <file>', 'Config file path', 'safenv.config')
  .option('-o, --output <dir>', 'Output directory', './dist')
  .option('-p, --port <port>', 'Port number', '3000')
  .option('-h, --host <host>', 'Host address', 'localhost')
  .option(
    '-m, --mode <mode>',
    'UI mode: "remote" (HTTP-based) or "local" (File System Access) or "auto"',
    'auto'
  )
  .action(async options => {
    const uiServer = new UIServer({
      configFile: options.config,
      root: options.output,
      port: parseInt(options.port),
      host: options.host,
      mode: options.mode,
    })

    try {
      await uiServer.start()
      console.log('Press Ctrl+C to stop the UI server.')

      process.on('SIGINT', async () => {
        console.log('\nStopping UI server...')
        await uiServer.stop()
        process.exit(0)
      })
    } catch (error) {
      console.error('Error starting UI server:', error)
      process.exit(1)
    }
  })

program.parse()
