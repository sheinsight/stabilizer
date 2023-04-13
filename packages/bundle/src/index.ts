import fs from "node:fs";
import path from "node:path";
import pick from "just-pick";
import ncc from "@vercel/ncc";
import { readPackage } from "@shined/n-read-pkg";
import { writeJsonFileSync } from "write-json-file";
import { UserAdvancedDepConfig } from "@shined/stabilizer-types";

export async function bundle(
  input: string,
  output: string,
  depConfig: UserAdvancedDepConfig
) {
  const { name, externals, minify = true } = depConfig;

  const srcDir = path.dirname(input);
  const destDir = path.dirname(output);

  const { code, assets } = await ncc(input, {
    target: "es6",
    minify,
    esm: false,
    assetBuilds: false,
    externals: externals,
    quiet: true,
    debugLog: process.env.DEBUG?.startsWith("LECP"),
    // 更多详细配置: https://github.com/vercel/ncc/blob/main/src/index.js#L37,
    // https://github.com/vercel/webpack-asset-relocator-loader
    customEmit(filePath, options) {
      // TODO
      const copyFile = () => {
        const absFilePath = path.isAbsolute(filePath)
          ? filePath.split("!")[0] // 可能存在 xx!xx 自定义 loader 形式
          : require.resolve(filePath, { paths: [path.dirname(options.id)] });
        const outPath = path.join(destDir, path.basename(absFilePath));
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.copyFileSync(absFilePath, outPath);
      };

      const customEmitOptions = {
        ...options,
        name,
      };

      if (depConfig.customEmit?.(filePath, customEmitOptions)) {
        copyFile();
        // transform
        return `'./${path.basename(filePath)}'`;
      }
    },
  });

  await fs.promises.mkdir(destDir, { recursive: true });

  // 写入 js
  await fs.promises.writeFile(output, code, { encoding: "utf-8" });

  // TODO: assets的js文件, noBundle复制的js文件 的自身依赖,第三方依赖没有处理,目前需要人肉检查一遍
  // 自身依赖需要复制,第三方依赖处理 externals 或者 需要再次打包(可能存在依赖有assets)后加入externals
  // 有些依赖不好分析:
  // 如 mini-css-extract-plugin的loader.js 依赖 hmr相关 -> https://github.com/webpack-contrib/mini-css-extract-plugin/blob/master/src/loader.js#L54
  if (assets) {
    // assets: chokidar 存在场景 { "fsevents.node": xxx}
    Object.entries(assets).forEach(([name, item]) => {
      const outPath = path.join(destDir, name);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, item.source, {
        encoding: "utf-8",
        mode: item.permissions,
      });
    });
  }

  const readPackageResult = readPackage(input, srcDir);

  if (readPackageResult) {
    writeJsonFileSync(
      path.join(destDir, "package.json"),
      pick(readPackageResult.packageJson, "name", "version", "types", "typings")
    );
  }
}
