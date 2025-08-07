# X-Env Comprehensive Demo

这个示例项目全面验证 X-Env 的 monorepo 和外部依赖包 safenv.config 解析能力。

## 项目结构

```
comprehensive-demo/
├── README.md                    # 本文档
├── package.json                 # 主项目配置
├── safenv.config.js            # 主项目环境变量配置
├── packages/                   # Monorepo 工作区
│   ├── web-frontend/           # 前端应用
│   │   ├── package.json
│   │   └── safenv.config.js
│   ├── api-backend/            # 后端 API
│   │   ├── package.json
│   │   └── safenv.config.js
│   └── shared-utils/           # 共享工具库
│       ├── package.json
│       └── safenv.config.js
├── external-deps/              # 外部依赖包模拟
│   ├── auth-service/           # 认证服务包
│   │   ├── package.json        # 包含 exports.safenv 配置
│   │   ├── index.js
│   │   └── safenv.config.js
│   ├── database-client/        # 数据库客户端包
│   │   ├── package.json
│   │   ├── index.js
│   │   └── safenv.config.js
│   └── cache-redis/            # Redis 缓存包
│       ├── package.json
│       ├── index.js
│       └── safenv.config.js
├── node_modules/               # 依赖安装目录（模拟）
└── demo-script.js              # 演示脚本
```

## 验证能力

### 1. Monorepo 项目间依赖解析

- ✅ 自动发现工作区中的所有项目
- ✅ 解析项目间的环境变量依赖关系
- ✅ 类型安全的变量传递和验证

### 2. 外部依赖包 safenv.config 解析

- ✅ 从 npm 包的 `exports.safenv` 字段自动发现配置
- ✅ 支持多种 exports 格式
- ✅ 类型安全的依赖包环境变量解析

### 3. 综合依赖分析

- ✅ 统一的依赖关系图构建
- ✅ 环境变量冲突检测
- ✅ 可视化依赖关系展示

## 使用方法

```bash
# 1. 进入示例目录
cd examples/comprehensive-demo

# 2. 运行演示脚本
node demo-script.js

# 3. 启动可视化界面
node ../../src/cli/visualizer-server.js

# 4. 运行依赖分析
node -e "
const { NpmSafenvResolver } = require('../../src/npm-safenv-resolver.ts');
const resolver = new NpmSafenvResolver('.');
resolver.getAllDependencyVariables().then(console.log);
"
```

## 预期结果

运行演示后应该能看到：

- 3个 monorepo 项目的环境变量
- 3个外部依赖包的环境变量
- 总计约 12-15 个环境变量
- 完整的依赖关系图
- 类型安全的变量解析结果
