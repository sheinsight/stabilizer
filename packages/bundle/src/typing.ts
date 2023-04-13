export interface BundleConfig {
  moduleName: string;
  externals?: Record<string, string>;
  minify?: boolean;
  customEmit?: CustomEmit;
}

export interface CustomEmitOption {
  id: string;
  isRequire: boolean;
  /**
   * current module package name
   */
  moduleName: string;
}

export interface CustomEmit {
  (filePath: string, options: CustomEmitOption): boolean;
}
