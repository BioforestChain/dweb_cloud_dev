现在假设我们在开发一个 safenv 的 ts/nodejs 库。
这个库的介绍：

1. safenv 的提供了一种通用的 配置、环境、变量的管理方式。下文我们统称“配置、环境、变量”为“VAL”，
2. safenv 自身只是一种声明 VAL，定义一组 VAL 为一个项目、并且可以声明项目之间的依赖关系、聚合关系。
3. 我们可以在一个 safenv.config 中，通过 workspace 配置项，管理多个 safenv.config。
4. safenv 本身并不生产文件、代码，也不参到最终的线上代码。
5. 比如在某个项目目录下定义 safenv.config.ts/json/yaml 文件
   - 通常来说使用使用 json/yaml 文件，已经可以满足大部分场景的需求了。
   - 如果使用 ts，可以用来自定义校验、解析
   - 技术上，使用 unconfig 实现
   - 默认是 serve 模式，就是监听 safenv.config 本身以及它的依赖关系，有变动，就运行生命周期来执行插件
   - 如果是 build 模式，则不会监听，只执行一次生命周期
6. safenv 的关键在于，它提供了插件，从而将这些最终的 VAL 与关系做出各种输出，内置的插件有：
   1. genFilePlugin: 输出 .env/json/yaml/toml 等配置文件
      - 需要配置一个 name 字段，比如 `my_project`，那么就会导出 `my_project.safenv.env/json/yaml/toml` 文件
      - 可以同时配置多种输出文件，虽然没必要
      - serve 模式下，还支持 web-ui 服务，如果启动，那么会在网页上看到已经定义好的 VAL 信息，然后编辑它，内容就会同步到 .env/json/yaml/toml 文件中
      - 还支持 html-tools，可以生成一个 html 文件，提供了导入导出的功能。
        - 实现上和 web-ui 就是一样的，我们将定义一种 importExportAdapter
        - 在 web-ui 模式下，就通过 httpImportExport 适配器，来通过 fetch-get 导入配置文件，通过 fetch-post 来导出配置文件。
        - 而在 html-tools 模式下，就通过 fileImportExport 适配器，来通过 filesystemaccess api 来选择文件夹来管理本地配置文件。
   2. genTsPlugin: 输出 ts 代码（可以自定义生成的文件路径）
      1. （必须）生成验证器代码（可以自定义 name，可自定义是否要导出这个验证器）：
         - `export const zSafenv = z.object({...})`
         - （默认）zod 风格：使用 zod(default/v3/v4) 来定义类型约束和解析，按需导入，而不是全量导入
           > 用这种写法：`import {string} from 'zod';const z = {string};`
           > 而不是：`import z from 'zod';`
         - pure 风格：没有任何依赖，简单地定义约束和解析
           > 类似：`const number = (v)=>+v; const string = (v)=>v; const z = {number, string};`
      1. （可选 1）生成导出代码（可以自定义导出的变量名）：
         - process.env: 直接从 process.env 来加载内容·
           > `export const safenv = zSafenv.parse(process.env)`
           > 用法：`console.log(safenv.X)`
         - process.env-static: 静态的代码写法：
           > `export const SAFENV_X = /* @__PURE__ * /zSafenv.X.parse(process.env.X)`
           > 这种做法的好处是，可以被树摇掉，同时`process.env.X`可以通过一些编译器插件的 define 来做静态的替换
           > 这里自定义的变量名会变成前缀，比如如果定义了`mysafenv`这个变量名，那么导出就成了：`mysafenvX`
         - env-file: 通过加载 envfile
           > 类似：`const envFile = path.resolve(import.meta.dirname, 'my_project.safenv.env')`
           > 然后尝试加载它`fs.existsSync(envFile) && process.loadEnvFile(envFile)`，这里也可以选用 `dotnev` 来加载 envFile
           > 最后和 process.env 加载内容一样去使用它：`export const safenv = zSafenv.parse(process.env)`
         - json/yaml/toml-file: 和 envfile 类似：
           > `const jsonFile = path.resolve(import.meta.dirname, 'my_project.safenv.json')`
           > 可以自定义依赖项目: json 默认是原生的 JSON，可以是 jsonc/json5 这些社区库，yaml/toml 同理。
           > 我们的底层就是 `deps:string[] + injectCode:string[]`，开发者可以自定义依赖项和注入代码。
           > 比如：`json5:{deps:['json5'],injectCode:['import JSON from 'json5;']}`
           > 最终我们都是要调用`JSON.parse/YAML.parse/TOML.parse`这样的写法。
7. 我无法预知的点在于：
   1. 插件的生命周期设计是什么样的
   2. safenv.config 应该如何 感知依赖关系。如果是 ts 文件，那么也许可以用 import 语法来导入，但这样是对的吗？我觉得应该使用非 import 的语法。参考 pnpm-workspace / package.json-deps
