
//#region src/plugins/base.ts
var BasePlugin = class {
	ensureDir(dir) {
		const fs = require("node:fs");
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	}
	writeFile(filePath, content) {
		const fs = require("node:fs");
		const path = require("node:path");
		this.ensureDir(path.dirname(filePath));
		fs.writeFileSync(filePath, content, "utf8");
	}
};

//#endregion
Object.defineProperty(exports, 'BasePlugin', {
  enumerable: true,
  get: function () {
    return BasePlugin;
  }
});