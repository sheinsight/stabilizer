import { transformFileAsync } from "@babel/core";
import { globby } from "globby";
import path from "node:path";
import type { DepConfig } from "./types.js";
import { _debug, uniq } from "./utils.js";
import bundlePkg from "./bundle-pkg.js";
import { getModuleDeps, getPkgInfo, getPkgName } from "./utils.js";
import fs from "node:fs";

/**
 * bundless 模式可能存在问题
 * - 子依赖包也不是干净的包(externals, 加 patch ?)
 * - 当前包依赖子依赖的子路径( 采取way3)
 *  可以先收集有子路径的依赖,给出 warn
 *  way1. 修改 require export const xx = require('xx').xx
 *        修改 entry. 增加 export const xx = require('xx/xx')
 *  way2. 不修改 require, 修改 entry, 增加 export const xx = require('xx/xx'). 增加 path, 指向到 entry
 *        (webpack预编译目前采用该策略,需要手动设置entry, 很多已经在 entry export,只是引用不规范)
 *  way3. 不修改 require, 不修改 entry, 单独编译 'xx/xx'到 path (文件可能变大)
 */
const copyPkg = async (depConfig: DepConfig) => {
  const { pkg, pkgPath, outDir, externals = {} } = depConfig;

  // 1.复制 pkg
  // TODO: glob copy,
  (
    await globby("**/*", {
      ignoreFiles: ["package.json", "readme.md", "changelog.md", "license"],
    })
  ).forEach((file) => {
    const src = path.join(pkgPath, file);
    const dest = path.join(outDir, file);
    fs.copyFileSync(src, dest);
  });

  // fse.copySync(pkgPath, outDir, {
  //   overwrite: true,
  //   filter: (src, dest) => {
  //     if (fs.lstatSync(src).isDirectory()) true;
  //     const filePath = src.replace(pkgPath + "/", "").toLowerCase();
  //     if (filePath.startsWith("node_modules/")) return false;
  //     const blackList = [
  //       "package.json",
  //       "readme.md",
  //       "changelog.md",
  //       "license",
  //     ];
  //     if (blackList.includes(filePath)) return false;
  //     return true;
  //   },
  // });

  // 修改 package.json
  fs.promises.writeFile(
    path.join(outDir, "package.json"),
    JSON.stringify({
      name: pkg.name,
      version: pkg.version,
      types: pkg.types || pkg.typings,
      main: pkg.main,
      module: pkg.module,
      // @ts-ignore pnpm的定义缺失
      exports: pkg.exports,
      bin: pkg.bin,
    }),
    { encoding: "utf-8" }
  );

  const dependenciesExternals = Object.keys(pkg.dependencies || {}).reduce<
    Record<string, string>
  >((acc, dep) => {
    acc[dep] = `./${dep}`;
    return acc;
  }, {});

  const pkgExternals = { ...dependenciesExternals, ...externals };

  // 2.替换相应依赖路径,
  // TODO: 这里需要考虑 dep.clean = false 的情况， 需要过滤之前的一些垃圾文件

  const files = await globby("**/*.{js,mjs,cjs}", {
    cwd: outDir,
    absolute: true,
  });

  // 检查存在的子路径引用, 需要处理
  // 需要放到babel-plugin-module-resolver之前进行， babel-plugin-module-resolver 会导致 subpath查找失败
  // 过滤掉peerDependencies
  const subpathList = uniq(
    files
      .reduce<string[]>((acc, file) => {
        acc = [...acc, ...getModuleDeps(file)];
        return acc;
      }, [])
      .filter((path) => !path.endsWith("/package.json"))
      .filter((path) => dependenciesExternals[getPkgName(path)])
  );

  _debug("存在子路径依赖", subpathList);
  await Promise.all(
    subpathList.map(async (subpath) => {
      await bundlePkg({
        name: subpath,
        entry: require.resolve(subpath, { paths: [pkgPath] }),
        output: path.join(outDir, `${subpath}.js`),
        externals: exchangeExternals(pkgExternals),
      });
    })
  );

  await Promise.all(
    files.map(async (file) => {
      const result = await transformFileAsync(file, {
        plugins: [
          [
            require.resolve("@@/babel-plugin-module-resolver"),
            {
              root: outDir,
              cwd: outDir,
              alias: pkgExternals,
              loglevel: "silent", // process.env.NODE_ENV !== 'production' 会检测路径正确性
            },
          ],
        ],
      });
      if (result?.code) {
        fs.writeFileSync(file, result.code, { encoding: "utf-8" });
      }
    })
  );

  // 3.编译依赖
  await Promise.all(
    Object.keys(pkg.dependencies || {})
      .filter((dep) => !externals[dep] && !dep.startsWith("@types/"))
      .map(async (dep) => {
        //
        const depInfo = getPkgInfo(dep, pkgPath);
        if (!depInfo) {
          throw new Error(`在${pkgPath}未找到${dep}信息`);
        }

        await bundlePkg({
          name: dep,
          pkg: depInfo.packageJson,
          entry: require.resolve(dep, { paths: [pkgPath] }),
          output: path.join(outDir, dep, "index.js"),
          externals: exchangeExternals(pkgExternals, dep),
          minify: true,
        });
      })
  );
};

// ./a -> ../a, ../a -> ../../a', a -> a
const exchangeExternals = (
  externals: Record<string, string> = {},
  moduleName: string = ""
) => {
  // 依赖如果有scope， 需要多嵌套一层。
  const relPath = /^@\S+\/\S+/.test(moduleName) ? "../../" : "../";
  return Object.keys(externals).reduce<Record<string, string>>((acc, dep) => {
    const value = externals[dep];
    if (value.startsWith("./")) {
      acc[dep] = `${relPath}${value.replace(/^.\//, "")}`;
    } else if (value.startsWith("../")) {
      acc[dep] = `${relPath}${value}`;
    }

    return acc;
  }, {});
};

export default copyPkg;
