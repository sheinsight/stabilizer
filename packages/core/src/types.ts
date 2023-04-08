import { NormalizedPackageJson } from "read-pkg";
import { PackageJson } from "type-fest";

export interface StabilizerConfig {
  /**
   * @default compiled
   */
  out: string;

  /**
   * @default process.cwd()
   */
  cwd: string;

  /**
   * @default {}
   */
  externals?: Record<string, string>;
}

export interface UserDepConfig {
  name: string;
  mode?: "bundle" | "bundless";
  minify?: boolean;
  /**
   * @default {}
   */
  externals?: Record<string, string>;
  clean?: boolean;
  /**
   * 是否需要 dts
   * @default true
   */
  dts?: boolean;

  /**
   * 是否只进行dts
   * @default false
   */
  dtsOnly?: boolean;
  noBundle?: NoBundle;
  /**
   * 编译后执行的patch操作
   * - 需要额外复制的文件
   */
  patch?: Patch;
}

export type PkgDtsInfo = {
  fullPath: string;
  pkgPath: string;
  types: string;
};

type Patch = (
  options: UserDepConfig & { outDtsPath?: string; pkgDtsInfo?: PkgDtsInfo }
) => Promise<void> | void;

export type PartialRequired<O, K extends keyof O> = Omit<O, K> &
  Required<Pick<O, K>>;

export type DepPkgInfo = PartialRequired<
  PackageJson, // pnpm 和 type-fest的 package 定义关于author冲突
  "name" | "version" // dep 确定有 name 和 version
>;

export interface InlineDepConfig extends UserDepConfig {
  output: string;
  outDir: string;
  packageJson: NormalizedPackageJson;
  packageJsonDir: string;
}

type NoBundle = (config: {
  /* 引用的文件路径(需要不打包的文件路径) **/
  filePath: string;
  /* 当前文件路径 */
  id: string;
  /* 当前包的名称 */
  pkgName: string;
}) => boolean;

export type LogLevel = "info" | "event" | "warn" | "error" | "none";
