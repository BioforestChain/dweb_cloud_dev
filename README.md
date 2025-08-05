# @dweb-cloud/dev

## Development Guidelines

### Commit Message Convention

This project follows a strict commit message format that combines **Gitemoji** with **Conventional Commits**.

#### Format

```
:emoji: type(scope): description
```

#### Required Elements

1. **Gitemoji**: Must start with a gitemoji (e.g., `:sparkles:`, `:bug:`)
2. **Type**: One of `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`
3. **Scope**: Optional, indicates the area of change (e.g., `auth`, `api`, `ui`)
4. **Description**: Brief description of the change (1-50 characters)

#### Recommended Gitemojis

| Gitemoji                | Type     | Description              |
| ----------------------- | -------- | ------------------------ |
| `:sparkles:`            | feat     | New feature              |
| `:bug:`                 | fix      | Bug fix                  |
| `:memo:`                | docs     | Documentation            |
| `:lipstick:`            | style    | Formatting, styling      |
| `:recycle:`             | refactor | Code refactoring         |
| `:white_check_mark:`    | test     | Adding tests             |
| `:wrench:`              | chore    | Maintenance              |
| `:zap:`                 | perf     | Performance improvements |
| `:green_heart:`         | ci       | CI/CD changes            |
| `:construction_worker:` | build    | Build system             |
| `:rewind:`              | revert   | Revert changes           |

**Note**: While these are the recommended gitemojis for each commit type, you can use any gitemoji you prefer (e.g., `:art:`, `:fire:`, `:rocket:`, `:tada:`, etc.) as long as the format is correct.

#### Examples

```bash
# ✅ Valid commits
:sparkles: feat(auth): add user authentication
:bug: fix(api): resolve login timeout issue
:memo: docs: update README with installation guide
:lipstick: style: format code with prettier
:recycle: refactor(core): simplify config loading logic
:white_check_mark: test(auth): add unit tests for login flow

# ❌ Invalid commits
Add new feature
fix: bug in auth
:sparkles: add authentication (missing type)
feat(auth): add user authentication (missing gitemoji)
```

### Development Commands

```bash
# Install dependencies
pnpm install

# Format code
pnpm format

# Check formatting
pnpm format:check

# Run linting
pnpm lint

# Run type checking
pnpm typecheck

# Run tests
pnpm test
```

### Pre-commit Hooks

This project uses Husky and lint-staged to ensure code quality:

- **Pre-commit**: Automatically formats code with Prettier and runs linting
- **Commit-msg**: Validates commit message format

The hooks will automatically run when you commit changes. If they fail, the commit will be rejected.

#### Cross-Platform Compatibility

This project uses **commitlint** for commit message validation, which provides excellent cross-platform support:

- ✅ **Linux/macOS**: Native support through Node.js
- ✅ **Windows (Git Bash)**: Full compatibility
- ✅ **Windows (PowerShell)**: Works through Git's execution environment
- ✅ **Windows (CMD)**: Works through Git's execution environment
- ✅ **Any Git GUI**: Universal compatibility

The commit validation runs through Node.js and commitlint, ensuring consistent behavior across all platforms and development environments.
