import type { SafenvPlugin } from './types.ts'

export abstract class BasePlugin implements SafenvPlugin {
  abstract name: string

  abstract apply(
    context: import('../types.ts').SafenvContext
  ): Promise<void> | void

  protected ensureDir(dir: string): void {
    const fs = require('node:fs')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  protected writeFile(filePath: string, content: string): void {
    const fs = require('node:fs')
    const path = require('node:path')

    this.ensureDir(path.dirname(filePath))
    fs.writeFileSync(filePath, content, 'utf8')
  }
}
