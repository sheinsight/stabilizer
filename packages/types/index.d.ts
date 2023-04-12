export interface UserDepAdvancedConfig {
  name: string;
  mode?: "bundle" | "bund-less";
  minify?: boolean;
  clean?: boolean;
  dts?: boolean;
  dtsOnly?: boolean;
}
