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

### Safenv CLI Commands

```bash
# Build configuration once
safenv build

# Start file watching mode
safenv serve

# Start web UI for configuration editing
safenv ui

# Run workspace configuration
safenv workspace
```

#### Web UI Features

The `safenv ui` command starts a web-based configuration editor that allows you to:

- 🔍 **Auto-discovery**: Automatically finds available configuration files
- 📂 **File Selection**: Choose from available config files in the UI
- 📝 **Live Editing**: Edit environment variables in a user-friendly interface
- 💾 **Real-time Saving**: Save changes directly to your configured output files
- 🔄 **Reset Functionality**: Reset values to their defaults
- 🔄 **Hot Switching**: Switch between different configuration files without restarting
- 📥📤 **Import/Export**: Import and export configurations in multiple formats (JSON, ENV, YAML, TOML)
- 🎨 **Modern Design**: Responsive, intuitive interface
- ⚡ **Instant Feedback**: Real-time validation and status updates
- 🔧 **Dual Mode Support**: Web-UI mode (HTTP-based) and HTML-tools mode (File System Access API)

**Usage:**

```bash
# Start UI with auto-discovery (recommended)
safenv ui

# Start with a specific config file
safenv ui --config my-safenv.config.ts

# Custom port and host
safenv ui --port 8080 --host 0.0.0.0

# Specify UI mode
safenv ui --mode local    # Use File System Access API
safenv ui --mode remote   # Use HTTP-based import/export
safenv ui --mode auto     # Auto-detect (default)
```

**UI Modes:**

- **Local Mode** (`--mode local`): Uses File System Access API for direct file operations. Best for local development with modern browsers.
- **Remote Mode** (`--mode remote`): Uses HTTP-based import/export. Best for server deployments and older browsers.
- **Auto Mode** (`--mode auto`): Automatically selects the best mode based on environment (default).

### Auto-Dependency Discovery

Safenv can automatically discover and merge environment variables from your project dependencies:

```typescript
// safenv.config.ts
export default {
  name: 'my-app',
  autoDependencies: true, // Enable auto-discovery
  variables: {
    // Your app-specific variables
    APP_NAME: {
      type: 'string',
      default: 'My App',
    },
  },
}
```

**How it works:**

1. Scans `package.json` dependencies for packages with safenv configurations
2. Looks for safenv config exports in dependency packages
3. Automatically prefixes dependency variables with the package name
4. Merges all variables into a single configuration

**Example:**

- Package `@auth/service` exports variable `API_KEY`
- In your app, it becomes `AUTH_SERVICE_API_KEY`
- Package `@db/connector` exports variable `CONNECTION_URL`
- In your app, it becomes `DB_CONNECTOR_CONNECTION_URL`

### Standard Schema Support

Safenv generates TypeScript validation functions that implement the [Standard Schema](https://github.com/standard-schema/standard-schema) specification, enabling interoperability with popular validation libraries like Zod, Valibot, and ArkType.

```typescript
// Generated Standard Schema function
export function createMyAppSchema(): MyAppSchema {
  return {
    name: 'my-app',
    '~standard': {
      version: 1,
      vendor: 'safenv',
      validate(value: unknown) {
        // Validation logic with detailed error reporting
        // Supports type coercion (string -> number, string -> boolean, etc.)
        // Returns { value: T } on success or { issues: Issue[] } on failure
      },
    },
  }
}

// Usage with any Standard Schema compatible library
const schema = createMyAppSchema()
const result = schema['~standard'].validate(process.env)

if (result.issues) {
  console.error('Validation failed:', result.issues)
} else {
  console.log('Config:', result.value) // Fully typed!
}
```

**Benefits:**

- **Universal Compatibility**: Works with any validation library that implements Standard Schema
- **Type Safety**: Full TypeScript support with inferred types
- **Detailed Error Reporting**: Precise error messages with field paths
- **Smart Type Coercion**: Automatically converts strings to appropriate types
- **Zero Dependencies**: Generated code has no runtime dependencies

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
