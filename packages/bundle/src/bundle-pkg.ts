import omit from "just-omit";
import ncc from "@vercel/ncc";
import fs from "node:fs";
import path from "node:path";
import type { InlineDepConfig } from "./types.js";
import { writeJsonFileSync } from "write-json-file";
import pick from "just-pick";

type BundlePkgOption = Omit<
  Pick<InlineDepConfig, "name" | "output"> &
    Partial<
      Pick<
        InlineDepConfig,
        "packageReadResult" | "minify" | "externals" | "noBundle"
      >
    >,
  never
>;

const bundlePkg = async (entry: string, depConfig: BundlePkgOption) => {
  // pkg.name 和 name 可能不相同(存在 "jest-worker29": "npm:jest-worker@^29", name 是jest-worker29, pkg.name 是jest-worker)
  const {
    name,
    output,
    externals,
    minify = true,
    packageReadResult,
  } = depConfig;

  const outDir = path.dirname(output);

  const { code, assets } = await ncc(entry, {
    target: "es5",
    minify,
    esm: false,
    assetBuilds: false,
    externals: omit(externals ?? {}, name), // 去除自身依赖
    quiet: true,
    debugLog: process.env.DEBUG?.startsWith("LECP"),
    // 更多详细配置: https://github.com/vercel/ncc/blob/main/src/index.js#L37,
    // https://github.com/vercel/webpack-asset-relocator-loader
    customEmit(filePath, { id }) {
      const copyFile = () => {
        const absFilePath = path.isAbsolute(filePath)
          ? filePath.split("!")[0] // 可能存在 xx!xx 自定义 loader 形式
          : require.resolve(filePath, { paths: [path.dirname(id)] });
        const outPath = path.join(outDir, path.basename(absFilePath));
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.copyFileSync(absFilePath, outPath);
      };

      if (depConfig.noBundle?.({ filePath, id, pkgName: name })) {
        copyFile();
        // transform
        return `'./${path.basename(filePath)}'`;
      }
    },
  });

  await fs.promises.mkdir(outDir, { recursive: true });

  // 写入 js
  await fs.promises.writeFile(output, code, { encoding: "utf-8" });

  // TODO: assets的js文件, noBundle复制的js文件 的自身依赖,第三方依赖没有处理,目前需要人肉检查一遍
  // 自身依赖需要复制,第三方依赖处理 externals 或者 需要再次打包(可能存在依赖有assets)后加入externals
  // 有些依赖不好分析:
  // 如 mini-css-extract-plugin的loader.js 依赖 hmr相关 -> https://github.com/webpack-contrib/mini-css-extract-plugin/blob/master/src/loader.js#L54

  if (assets && Object.keys(assets).length) {
    // assets: chokidar 存在场景 { "fsevents.node": xxx}
    Object.entries(assets).forEach(([name, item]) => {
      const outPath = path.join(outDir, name);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, item.source, {
        encoding: "utf-8",
        mode: item.permissions,
      });
    });
  }

  // bundle 子路径,不需要写入pkg
  if (packageReadResult?.packageJson) {
    // 写入 package.json
    // LICENSE,author ??
    // type,main,module,exports ??

    writeJsonFileSync(
      path.join(outDir, "package.json"),
      pick(
        packageReadResult?.packageJson,
        "name",
        "version",
        "types",
        "typings"
      )
    );
  }
};

export default bundlePkg;
