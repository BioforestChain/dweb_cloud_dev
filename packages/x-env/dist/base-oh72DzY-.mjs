import { createRequire } from "node:module";

//#region rolldown:runtime
var __require = /* @__PURE__ */ createRequire(import.meta.url);

//#endregion
//#region src/plugins/base.ts
var BasePlugin = class {
	ensureDir(dir) {
		const fs = __require("node:fs");
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	}
	writeFile(filePath, content) {
		const fs = __require("node:fs");
		const path = __require("node:path");
		this.ensureDir(path.dirname(filePath));
		fs.writeFileSync(filePath, content, "utf8");
	}
};

//#endregion
export { BasePlugin, __require };
//# sourceMappingURL=base-oh72DzY-.mjs.map