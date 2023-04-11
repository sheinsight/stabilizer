import { transformFileAsync } from "@babel/core";
import { globby } from "globby";
import path from "node:path";
import type { InlineDepConfig } from "./types.js";
import { _debug } from "./utils.js";
import bundlePkg from "./bundle-pkg.js";
import { getModuleDeps } from "./utils.js";
import fs from "node:fs";
import { writePackageSync } from "write-pkg";
import pick from "just-pick";
import { readPackageMemoized } from "./utils/read-package.js";
import { npmModuleName } from "@shined/stabilizer-utils";
import { uniq } from "./utils/uniq.js";
import resolveFrom from "resolve-from";
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
const copyPkg = async (depConfig: InlineDepConfig) => {
  const { packageReadResult, outDir, externals = {} } = depConfig;

  // 1.复制 pkg
  // TODO: glob copy,
  (
    await globby("**/*", {
      ignoreFiles: ["package.json", "readme.md", "changelog.md", "license"],
    })
  ).forEach((file) => {
    const packagePath = packageReadResult?.path;
    const packageJsonDir = path.dirname(packagePath);
    const src = path.join(packageJsonDir, file);
    const dest = path.join(outDir, file);
    fs.copyFileSync(src, dest);
  });

  // 修改 package.json
  writePackageSync(
    path.join(outDir, "package.json"),
    pick(
      packageReadResult?.packageJson,
      "name",
      "version",
      "types",
      "typings",
      "main",
      "module",
      "exports",
      "bin"
    )
  );

  const dependenciesExternals = Object.keys(
    packageReadResult?.packageJson.dependencies || {}
  ).reduce<Record<string, string>>((acc, dep) => {
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
      .filter((path) => dependenciesExternals[npmModuleName(path)])
  );

  // todo  🤔  存在子路径依赖， 为什么会走 bundlepkg
  _debug("存在子路径依赖", subpathList);
  await Promise.all(
    subpathList.map(async (subpath) => {
      const packageJsonDir = path.dirname(packageReadResult?.path);
      const entry = resolveFrom(packageJsonDir, subpath);
      await bundlePkg(entry, {
        name: subpath,
        output: path.join(outDir, `${subpath}.js`),
        externals: exchangeExternals(pkgExternals),
      });
    })
  );

  // 🤔   bundle-less  为什么要配置  babel-plugin-module-resolver ？？
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
    Object.keys(packageReadResult?.packageJson.dependencies || {})
      .filter((dep) => !externals[dep] && !dep.startsWith("@types/"))
      .map(async (dep) => {
        //
        const packageJsonDir = path.dirname(packageReadResult?.path);

        const depInfo = readPackageMemoized(dep, packageJsonDir);
        if (!depInfo) {
          throw new Error(`在${packageJsonDir}未找到${dep}信息`);
        }
        const entry = resolveFrom(packageJsonDir, dep);
        await bundlePkg(entry, {
          name: dep,
          packageReadResult: depInfo,
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
