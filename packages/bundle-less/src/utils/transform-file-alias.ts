import { transformFileAsync } from "@babel/core";

export async function transformFileAlias(
  filePath: string,
  destDir: string,
  alias: Record<string, string>
) {
  const babelConfig = {
    plugins: [
      [
        require.resolve("babel-plugin-module-resolver"),
        {
          root: destDir,
          cwd: destDir,
          alias,
          loglevel: "silent", // process.env.NODE_ENV !== 'production' 会检测路径正确性
        },
      ],
    ],
  };
  return (await transformFileAsync(filePath, babelConfig))?.code;
}
