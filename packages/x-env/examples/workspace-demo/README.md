# Workspace Integration Example

这个示例展示了如何在 pnpm workspace 环境中使用 @dweb-cloud/safenv 管理多个项目的环境变量配置。

## 项目结构

```
workspace-demo/
├── README.md                    # 本文档
├── package.json                 # workspace根配置
├── pnpm-workspace.yaml         # pnpm workspace配置
├── .env.example                # 环境变量模板
├── projects/
│   ├── base-service/           # 项目一：基础服务
│   │   ├── package.json
│   │   ├── safenv.config.ts
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── config.ts
│   │   ├── .env.example
│   │   └── dist/               # 构建输出
│   └── web-app/               # 项目二：Web应用
│       ├── package.json
│       ├── safenv.config.ts
│       ├── src/
│       │   ├── index.ts
│       │   └── config.ts
│       ├── .env.example
│       └── dist/              # 构建输出
└── scripts/
    ├── setup.sh               # 环境设置脚本
    └── test.sh                # 测试脚本
```

## 快速开始

### 1. 安装依赖

```bash
cd workspace-demo
pnpm install
```

### 2. 设置环境变量

```bash
# 复制环境变量模板
cp .env.example .env
cp projects/base-service/.env.example projects/base-service/.env
cp projects/web-app/.env.example projects/web-app/.env

# 编辑环境变量文件，填入实际值
```

### 3. 构建项目

```bash
# 构建所有项目
pnpm run build

# 或者单独构建
pnpm run build --filter base-service
pnpm run build --filter web-app
```

### 4. 运行项目

```bash
# 启动基础服务
pnpm run start --filter base-service

# 启动Web应用
pnpm run start --filter web-app
```

## 项目说明

### Base Service (基础服务)

基础服务项目展示了如何使用 @dweb-cloud/safenv 定义和管理数据库、Redis 和服务相关的环境变量。它导出配置供其他项目使用。

主要特性：

- 数据库连接配置
- Redis 缓存配置
- 服务端口和日志级别配置
- 类型安全的配置导出

### Web App (Web应用)

Web应用项目展示了如何依赖基础服务的配置，同时定义自己的环境变量。它使用 `autoDependencies` 功能自动发现和导入依赖项的配置。

主要特性：

- 自动依赖发现
- Web应用特有配置
- API客户端配置
- 功能开关配置

## 环境变量管理

### 优先级

1. 项目本地的 `.env` 文件
2. Workspace 根目录的 `.env` 文件
3. 系统环境变量
4. 配置文件中的默认值

### 依赖配置

Web应用可以通过前缀访问基础服务的配置：

```typescript
// 在 web-app 中访问 base-service 的配置
const dbHost = WebAppConfig.BASE_SERVICE_DB_HOST
const dbPort = WebAppConfig.BASE_SERVICE_DB_PORT
```

## 开发工具

### 配置验证

```bash
# 验证所有项目的配置
pnpm run validate

# 验证特定项目
pnpm run validate --filter base-service
```

### 类型生成

```bash
# 生成TypeScript类型定义
pnpm run generate-types
```

## 故障排除

### 常见问题

1. **依赖配置未找到**
   - 确保依赖项目已正确构建
   - 检查 `autoDependencies` 配置是否启用

2. **环境变量验证失败**
   - 检查 `.env` 文件是否存在
   - 验证环境变量值是否符合约束条件

3. **类型错误**
   - 运行 `pnpm run generate-types` 重新生成类型
   - 确保所有依赖项都已安装

### 调试模式

```bash
# 启用调试日志
DEBUG=safenv:* pnpm run start --filter base-service
```

## 更多信息

- [x-env 主文档](../../README.md)
- [配置文件格式说明](../../docs/config-format.md)
- [依赖管理指南](../../docs/dependency-management.md)
