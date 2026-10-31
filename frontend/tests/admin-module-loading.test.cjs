const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");

// Evaluate real ESM bindings in a fresh graph for each lazy-loading entry.
// CommonJS transpilation would hide the temporal-dead-zone failure reported
// by Turbopack when cin-form is evaluated before cms-kit.
async function loadEntry(entry) {
  const context = vm.createContext({ console, process: { env: { NODE_ENV: "development" } } });
  const modules = new Map();
  function getModule(id) {
    if (modules.has(id)) return modules.get(id);
    let module;
    if (path.isAbsolute(id)) {
      const source = ts.transpileModule(fs.readFileSync(id, "utf8"), {
        fileName: id,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      }).outputText;
      module = new vm.SourceTextModule(source, { context, identifier: id });
    } else {
      const exports = require(id);
      module = new vm.SyntheticModule([...new Set([...Object.keys(exports), "default"])], function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
        this.setExport("default", exports.default || exports);
      }, { context, identifier: id });
    }
    modules.set(id, module);
    return module;
  }
  const module = getModule(path.join(root, "components/admin", `${entry}.tsx`));
  await module.link((specifier, importer) => {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return getModule(specifier);
    const base = specifier.startsWith("@/")
      ? path.join(root, specifier.slice(2))
      : path.resolve(path.dirname(importer.identifier), specifier);
    const file = [base + ".tsx", base + ".ts", base].find(candidate => fs.existsSync(candidate));
    assert.ok(file, `Cannot resolve ${specifier}`);
    return getModule(file);
  });
  await module.evaluate();
  return module.namespace;
}

for (const entry of ["cin-form", "cms-kit", "visual-site-builder"]) {
  test(`${entry} initializes independently and renders without a circular-import crash`, async () => {
    const exports = await loadEntry(entry);
    const noop = () => {};
    if (entry === "cin-form") {
      assert.equal(exports.CIN_NAMES.CIN_HERO, "Cinematic hero");
      for (const type of Object.keys(exports.CIN_NAMES)) {
        const html = renderToStaticMarkup(React.createElement(exports.CinForm, {
          type, content: exports.cinDefault(type), onPatch: noop, onNotify: noop,
        }));
        assert.ok(html.includes("cin-form"), `${type} renders its editor`);
      }
    } else {
      const Component = entry === "cms-kit" ? exports.SiteBuilder : exports.VisualSiteBuilder;
      const html = renderToStaticMarkup(React.createElement(Component, {
        pages: [], setPages: noop, onNotify: noop, onPreview: noop, settings: {}, setSettings: noop,
      }));
      assert.ok(html.length > 0);
    }
  });
}
