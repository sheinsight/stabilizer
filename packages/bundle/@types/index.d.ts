// https://github.com/vercel/vercel/blob/main/packages/node/%40types/zeit__ncc/index.d.ts
declare function ncc(
  entrypoint: string,
  options?: ncc.NccOptions
): ncc.NccResult & Promise<ncc.BuildResult>;

declare namespace ncc {
  // 更多类型补充 -> https://github.com/vercel/ncc/blob/main/src/index.js#L37
  export interface NccOptions {
    target: string;
    watch?: any;
    esm?: boolean;
    sourceMap?: boolean;
    sourceMapRegister?: boolean;
    minify?: boolean;
    assetBuilds?: false;
    externals?: string[] | Record<string, string>;
    quiet?: boolean;
    debugLog?: boolean;
    customEmit?: (
      path: string,
      { id, isRequire }: { id: string; isRequire: boolean }
    ) => false | string | void;
  }

  export interface Asset {
    source: string;
    permissions: number;
  }

  export interface Assets {
    [name: string]: Asset;
  }

  export interface BuildResult {
    err: Error | null | undefined;
    code: string;
    map: string | undefined;
    assets: Assets | undefined;
    permissions: number | undefined;
  }

  export type HandlerFn = (params: BuildResult) => void;
  export type HandlerCallback = (fn: HandlerFn) => void;
  export type RebuildFn = () => void;
  export type RebuildCallback = (fn: RebuildFn) => void;
  export type CloseCallback = () => void;

  export interface NccResult {
    handler: HandlerCallback;
    rebuild: RebuildCallback;
    close: CloseCallback;
  }
}

declare module "@vercel/ncc" {
  export default ncc;
}
