declare module "@shined/stabilizer-bundle-less" {
  interface UserDepConfig {
    name: string;
    destDir: string;
    srcDir: string;
    externals?: Record<string, string>;
  }
}
