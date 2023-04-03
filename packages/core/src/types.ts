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
  dts?: boolean;
  /**
   * @default {}
   */
  externals?: Record<string, string>;
}

export type PartialRequired<O, K extends keyof O> = Omit<O, K> &
  Required<Pick<O, K>>;

export type DepPkgInfo = PartialRequired<
  PackageJson, // pnpm 和 type-fest的 package 定义关于author冲突
  "name" | "version" // dep 确定有 name 和 version
>;

export type DepConfig = {
  name: string;
  mode: "bundle" | "bundless";
  entry: string;
  output: string;
  outDir: string;
  minify: boolean;
  dtsOnly: boolean;
  clean: boolean;
  dts: boolean;
  pkg: DepPkgInfo;
  pkgPath: string;
  noBundle?: NoBundle;
  externals?: Record<string, string>;
};

type NoBundle = (config: {
  /* 引用的文件路径(需要不打包的文件路径) **/
  filePath: string;
  /* 当前文件路径 */
  id: string;
  /* 当前包的名称 */
  pkgName: string;
}) => boolean;

export type LogLevel = "info" | "event" | "warn" | "error" | "none";
