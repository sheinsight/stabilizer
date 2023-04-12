interface UserDepConfig {
  name: string;
  destDir: string;
  srcDir: string;
  externals?: Record<string, string>;
}
