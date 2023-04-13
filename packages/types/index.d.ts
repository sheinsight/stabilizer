export interface StabilizerConfig {
  /**
   * @default compiled
   */
  out?: string;

  /**
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * @default {}
   */
  externals?: Record<string, string>;

  deps?: (string | UserAdvancedDepConfig)[];
}

export interface UserAdvancedDepConfig {
  name: string;
  mode?: "bundle" | "bundle-less";
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
  customEmit?: CustomEmit;
  /**
   * 编译后执行的patch操作
   * - 需要额外复制的文件
   */
  patch?: Patch;
}

export interface InlineUserDepAdvancedConfig extends UserAdvancedDepConfig {
  // TODO
  packageJsonReadResult: any;
}

export interface CustomEmitOption {
  id: string;
  isRequire: boolean;
  /**
   * current module package name
   */
  name: string;
}

export interface CustomEmit {
  (filePath: string, options: CustomEmitOption): boolean;
}

export interface Patch {
  (options: UserAdvancedDepConfig): Promise<void> | void;
}
