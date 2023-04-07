import chalk from "chalk";
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
import {
  checkExternals,
  getPkgAllDepsMap,
  getPkgDtsPath,
  getPkgInfo,
} from "./utils.js";
import { StabilizerConfig, UserDepConfig } from "./types.js";
import process from "node:process";
import { measure } from "./utils/measure.js";
import { perfectDeps } from "./utils/perfect-deps.js";
import {
  calcDepsExternals,
  calcSelfExternals,
} from "./utils/calc-externals.js";

const defaultConfig = {
  out: "compiled",
  cwd: process.cwd(),
  externals: {},
};

export async function stabilizer(
  deps: (string | UserDepConfig)[],
  config: StabilizerConfig
) {
  const completeConfig = deepmerge(defaultConfig, config);

  const { cwd } = completeConfig;

  const packageJson = readPackageUpSync({ cwd })?.packageJson;

  if (!packageJson) {
    throw new Error("can not found package.json");
  }

  const completeDeps = perfectDeps(deps, completeConfig);

  const selfExternals = calcSelfExternals(packageJson);

  for (const dep of completeDeps) {
    const { name, clean, outDir } = dep;

    if (clean) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }

    const depsExternals = calcDepsExternals(name, completeDeps, completeConfig);

    const externals = {
      ...selfExternals,
      ...completeConfig.externals,
      ...depsExternals,
      ...dep.externals,
    };
  }

  // const preBuildConfig = getPreBuildConfig(cwd, deps);
  // debug(`实际prebuild配置文件: %O`, preBuildConfig);

  // logger.event("🚀 开始预编译");
  // const { duration } = await measure(() => prebuild(preBuildConfig, config));
  // logger.event(`⏳ 预编译耗时:${duration}ms`);
}

/**
 * 依赖预编译(打包)
 * - js -> index.js
 * - types -> index.d.ts
 */
const init = async (config: IConfig) => {
  const { cwd } = config;
  const logger = createLogger("", config.logLevel);

  const userConfig = await getUserConfig(cwd, logger);
  _debug(`用户prebuild配置文件: %O`, userConfig.prebuild);

  if (!userConfig.prebuild) {
    logger.error("未找到prebuild相关配置");
    return;
  }

  const preBuildConfig = getPreBuildConfig(cwd, userConfig.prebuild, logger);
  debug(`实际prebuild配置文件: %O`, preBuildConfig);

  logger.event("🚀 开始预编译");
  const { duration } = await measure(() => prebuild(preBuildConfig, config));
  logger.event(`⏳ 预编译耗时:${duration}ms`);
};

const getPreBuildConfig = (cwd: string, deps: string[]) => {
  const defaultConfig: PreBuildUserConfig = {
    output: "compiled",
    deps: [],
    externals: {},
  };

  // string -> {name: string}
  const _deps = deps.map((dep) => {
    if (typeof dep === "string") return { name: dep };
    return dep;
  });

  const prebuildConfig = deepmerge(defaultConfig, config) as PreBuildConfig;

  prebuildConfig.pkg = readPackageUpSync({ cwd })!.packageJson;

  prebuildConfig.deps = prebuildConfig.deps.map((dep) => {
    dep.output = path.join(cwd, prebuildConfig.output, dep.name, "index.js"); // 根据 entry 后缀, type === 'module'??
    dep.outDir = path.dirname(dep.output);
    dep.minify = dep.minify ?? true;
    dep.dts = dep.dts ?? true;

    const res = getPkgInfo(dep.name, cwd);
    if (res) {
      dep.pkg = res.pkg;
      dep.pkgPath = res.pkgPath;
      // dep.dtsPath = getPkgDtsPath(dep.name, cwd);
    }

    return dep;
  });

  return prebuildConfig;
};

const prebuild = async (config: PreBuildConfig, { logLevel, cwd }: IConfig) => {
  const globalExternals = Object.keys({
    ...config.pkg.dependencies,
    ...config.pkg.peerDependencies,
  }).reduce((acc, dep) => {
    acc[dep] = dep;
    return acc;
  }, {} as Record<string, string>);

  // deps in rootDeps -> external
  for (const depConfig of config.deps) {
    // pkg.name 和 name 可能不相同(存在 "jest-worker29": "npm:jest-worker@^29", name 是jest-worker29, pkg.name 是jest-worker)
    const {
      name,
      pkgPath,
      mode,
      outDir,
      dts,
      patch,
      dtsOnly,
      clean = true,
    } = depConfig;

    // 编译前删除文件夹
    if (clean) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }

    // deps 内部依赖 根据入口文件位置  compiled/xxx 位置 算相对路径
    const compiledExternals = config.deps.reduce((acc, dep) => {
      if (name !== dep.name) {
        acc[dep.name] = path.relative(
          path.join(cwd, config.output, name),
          path.join(cwd, config.output, dep.name)
        );
      } else {
        acc[dep.name] = `../${name}`; // dts可能存在注释需要,不能再此处删除自身Externals
      }

      return acc;
    }, {} as Record<string, string>);

    const externals = {
      ...globalExternals,
      ...config.externals,
      ...compiledExternals,
      ...depConfig.externals,
    };

    // 检查 externals
    const allDeps = getPkgAllDepsMap(name, pkgPath);
    const notSatisfiesList = checkExternals(allDeps, externals, cwd);
    notSatisfiesList.forEach((item) => {
      // logger.warn(
      //   `${item.name}的版本 ${item.externalVersion} 和子依赖的版本 ${item.depVersions} 依赖冲突,将从externals中移除`
      // );
      delete externals[item.name];
    });

    if (!dtsOnly) {
      // js编译时 dtsOnly的dep需要从externals中移除
      let bundleExternals = { ...externals };
      config.deps.forEach((dep) => {
        if (dep.dtsOnly && bundleExternals[dep.name]) {
          delete bundleExternals[dep.name];
        }
      });
      if (mode === "bundless") {
        // 复制 pkg
        await copyPkg({ ...depConfig, externals: bundleExternals }, logger);
      } else {
        // 编译 pkg
        await bundlePkg({ ...depConfig, externals: bundleExternals }, cwd);
      }
    }

    // https://github.com/vercel/ncc/blob/main/src/cli.js#L284
    // ncc cli 有对 symlinks 的处理.待研究是否需要

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
          !["index.d.ts", depConfig.pkg.types, depConfig.pkg.typings].includes(
            types
          )
        ) {
          const data = readPackageSync(outDir);
          data.types = types;
          writePackageSync(outDir, data);
        }
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
};

export default init;
