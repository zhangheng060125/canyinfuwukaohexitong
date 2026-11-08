import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const result = await build({
  absWorkingDir: root,
  entryPoints: ["frontend/src/main.tsx"],
  bundle: true,
  write: false,
  outfile: "trial.js",
  format: "iife",
  minify: true,
  target: ["chrome100", "edge100", "safari15.4"],
  jsx: "automatic",
  define: {
    "import.meta.env.VITE_TRIAL_MODE": '"1"',
    "process.env.NODE_ENV": '"production"',
  },
  plugins: [
    {
      name: "inline-source-document",
      setup(b) {
        b.onResolve({ filter: /\.docx\?url$/ }, (args) => ({
          path: resolve(args.resolveDir, args.path.replace(/\?url$/, "")),
          namespace: "inline-word",
        }));
        b.onLoad({ filter: /.*/, namespace: "inline-word" }, async (args) => ({
          contents:
            "export default " +
            JSON.stringify(
              "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64," +
                (await readFile(args.path)).toString("base64"),
            ),
          loader: "js",
        }));
      },
    },
  ],
});
const js = result.outputFiles.find((f) => f.path.endsWith(".js")).text;
const css = result.outputFiles.find((f) => f.path.endsWith(".css")).text;
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#286349"><title>百花里 · 免费浏览器试用版</title><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
await mkdir(resolve(root, "docs/trial"), { recursive: true });
await writeFile(
  resolve(root, "docs/trial/百花里餐饮考核系统-试用版.html"),
  html,
);
console.log(
  "Created self-contained trial HTML; no server or network requests required.",
);
