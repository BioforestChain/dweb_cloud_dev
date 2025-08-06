import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  external: ['zod'],
  shims: true,
  treeshake: true,
  // 确保 CLI 文件保持可执行权限
  outputOptions: (options, format) => {
    if (options.file?.includes('cli')) {
      return {
        banner: '#!/usr/bin/env node',
      }
    }
  },
})
