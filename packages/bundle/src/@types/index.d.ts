interface UserDepConfig {
  name: string;
  mode?: "bundle" | "bund-less";
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
}
