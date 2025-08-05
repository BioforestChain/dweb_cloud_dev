module.exports = {
  // 不继承默认配置，因为它会干扰我们的 gitemoji 格式
  parserPreset: {
    parserOpts: {
      // 自定义解析器来处理 gitemoji 格式 - 支持 :emoji: 和 Unicode emoji
      headerPattern:
        /^((?::[a-z_]+:|\p{Emoji})\s*)\s+(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: (.{1,50})$/u,
      headerCorrespondence: ['gitemoji', 'type', 'scope', 'subject'],
    },
  },
  rules: {
    // 基本规则
    'header-max-length': [2, 'always', 72],
    'body-leading-blank': [1, 'always'],
    'body-max-line-length': [2, 'always', 100],
    'footer-leading-blank': [1, 'always'],
    'footer-max-line-length': [2, 'always', 100],

    // 类型相关规则
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'test',
        'chore',
        'perf',
        'ci',
        'build',
        'revert',
      ],
    ],

    // 主题相关规则
    'subject-case': [
      2,
      'never',
      ['sentence-case', 'start-case', 'pascal-case', 'upper-case'],
    ],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],

    // 作用域规则
    'scope-case': [2, 'always', 'lower-case'],

    // 启用自定义 gitemoji 规则
    'gitemoji-format': [2, 'always'],
  },
  plugins: [
    {
      rules: {
        // 自定义规则：验证 gitemoji 格式 - 允许任何 gitemoji
        'gitemoji-format': parsed => {
          const { header } = parsed
          // 更灵活的模式：支持 :emoji: 和 Unicode emoji
          const gitemojiPattern =
            /^(?::[a-z_]+:|\p{Emoji})\s*(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .{1,50}$/u

          if (!gitemojiPattern.test(header)) {
            return [
              false,
              `Commit message must follow format: emoji type(scope): description

🎭 You can use either format:
  • :emoji: (gitemoji format): :sparkles: feat(auth): add user authentication
  • 🎉 (Unicode emoji): 🎉 feat(auth): add user authentication

🎭 Recommended gitemoji for each type:
  :sparkles: ✨ - feat (new feature)
  :bug: 🐛 - fix (bug fix)
  :memo: 📝 - docs (documentation)
  :lipstick: 💄 - style (formatting, styling)
  :recycle: ♻️ - refactor (code refactoring)
  :white_check_mark: ✅ - test (adding tests)
  :wrench: 🔧 - chore (maintenance)
  :zap: ⚡ - perf (performance improvements)
  :green_heart: 💚 - ci (CI/CD changes)
  :construction_worker: 👷 - build (build system)
  :rewind: ⏪ - revert (revert changes)

💡 You can also use other emojis like:
  :art: 🎨 :fire: 🔥 :rocket: 🚀 :tada: 🎉 :lock: 🔒

📝 Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert

✅ Examples:
  :sparkles: feat(auth): add user authentication
  🎉 feat(auth): add user authentication
  :bug: fix(api): resolve login timeout issue
  🐛 fix(api): resolve login timeout issue`,
            ]
          }

          return [true]
        },
      },
    },
  ],
}
