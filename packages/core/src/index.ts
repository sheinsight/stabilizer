import deepmerge from "deepmerge";
import { readPackageUpSync } from "read-pkg-up";
import fs from "node:fs";
import path from "node:path";
import { readPackageSync } from "read-pkg";
import { writePackageSync } from "write-pkg";
import { _debug } from "./utils.js";
import bundlePkg from "./bundle-pkg.js";
import copyPkgDts from "./copy-dts.js";
import copyPkg from "./copy-pkg.js";
import { getPkgDtsPath } from "./utils.js";
import { StabilizerConfig, UserDepConfig } from "./types.js";
import process from "node:process";
import { perfectDeps } from "./utils/perfect-deps.js";
import {
  calcDepsExternals,
  calcSelfExternals,
} from "./utils/calc-externals.js";
import { conflictResolution } from "./utils/deps.js";
import resolveFrom from "resolve-from";

const defaultConfig = {
  out: "compiled",
  cwd: process.cwd(),
  externals: {},
};

export async function stabilizer(
  deps: (string | UserDepConfig)[],
  config?: StabilizerConfig
) {
  const completeConfig = deepmerge(defaultConfig, config ?? {});

  const { cwd } = completeConfig;

  const packageJson = readPackageUpSync({ cwd })?.packageJson;

  if (!packageJson) {
    throw new Error("can not found package.json");
  }

  const completeDeps = perfectDeps(deps, completeConfig);

  const selfExternals = calcSelfExternals(packageJson);

  for (const depConfig of completeDeps) {
    const {
      name,
      clean,
      outDir,
      packageReadResult,
      dtsOnly,
      mode,
      patch,
      dts,
    } = depConfig;

    if (clean) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }

    const depsExternals = calcDepsExternals(name, completeDeps, completeConfig);

    const externals = {
      ...selfExternals,
      ...completeConfig.externals,
      ...depsExternals,
      ...depConfig.externals,
    } as Record<string, string>;

    const packageJsonDir = path.dirname(packageReadResult.path);

    conflictResolution(name, packageJsonDir, externals);

    if (!dtsOnly) {
      // js编译时 dtsOnly的dep需要从externals中移除
      let bundleExternals = { ...externals };
      completeDeps.forEach((dep) => {
        if (dep.dtsOnly && bundleExternals[dep.name]) {
          delete bundleExternals[dep.name];
        }
      });
      if (mode === "bundless") {
        // 复制 pkg
        await copyPkg({ ...depConfig, externals: bundleExternals });
      } else {
        // 编译 pkg
        await bundlePkg(resolveFrom(cwd, depConfig.name), {
          ...depConfig,
          externals: bundleExternals,
        });
      }
    }

    let dtsInfo = undefined;

    if (dts) {
      // 写入 types(目前采用 way3)
      // way1 : 复制入口 types 所在文件夹(暂时简单粗暴点)
      //   有定义 types,typings 复制(判断文件夹/单文件??)
      //   entry同目录存在 xxx.js -> xxx.d.ts
      //   有@types/xxx  复制
      // way2 : 是否打包 dts(api-extractor) ??
      //   types entry-> index.d.ts 不用考虑文件夹/单文件 但是存在失败风险
      // 1,2都存在问题: 依赖的类型没有复制进去(如globby 依赖 fast-glob)
      // way3: 正则(或者ast)分析entry 的 import, 递归寻找依赖. 复制&替换引用路径
      //    正则存在误替换注释问题, ast可能处理比较复杂和慢
      // way4: 先api-extractor打包 dts, 然后安装 3 递归寻找依赖. 待验证性能和可靠性
      dtsInfo = getPkgDtsPath(name, cwd);

      if (dtsInfo) {
        const { fullPath: dtsPath, types } = dtsInfo;
        _debug(`${name}对应的 dts:`, dtsPath);

        // logger.info(chalk.gray(`  复制 dts`));
        copyPkgDts({ entry: dtsPath, outDir, externals, cwd });

        // 复写 package.json 的 types
        if (
          types &&
          ![
            "index.d.ts",
            depConfig.packageReadResult.packageJson.types,
            depConfig.packageReadResult.packageJson.typings,
          ].includes(types)
        ) {
          const data = readPackageSync({ cwd: outDir });
          data.types = types;
          writePackageSync(outDir, data);
        }
      }

      // - 复制额外的文件,指向 index.js. 如何寻找(暂时只能人肉)??
      // - assets 替换 require 相关路径
      // - 修复 dts: 如 export = less 去除 declare module "less" 包裹
      if (patch) {
        try {
          await patch({
            ...depConfig,
            outDtsPath: dtsInfo?.types
              ? path.join(outDir, dtsInfo.types)
              : undefined,
            pkgDtsInfo: dtsInfo,
          });
        } catch (error) {
          // logger.warn(error);
        }
      }
    }
  }
}
