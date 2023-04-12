export function npmModuleName(source: string) {
  if (source.startsWith(".")) return source;
  return source
    .split("/")
    .slice(0, source.startsWith("@") ? 2 : 1)
    .join("/");
}

export const uniq = (arr: string[]) => Array.from(new Set(arr));
