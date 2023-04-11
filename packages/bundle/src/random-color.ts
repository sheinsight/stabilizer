import chalk, { ForegroundColorName } from "chalk";

// ANSI 16色 去除黑白色(black,white,whiteBright)
const colors: ForegroundColorName[] = [
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "gray", // blackBright
  "redBright",
  "greenBright",
  "yellowBright",
  "blueBright",
  "magentaBright",
  "cyanBright",
];

let index = 0;
const cache: Record<string, string> = {};

export default function randomColor(pkg: string) {
  if (!cache[pkg]) {
    const color = colors[index];
    let str = chalk[color].bold(pkg);
    cache[pkg] = str;
    if (index === colors.length - 1) {
      index = 0;
    } else {
      index += 1;
    }
  }
  return cache[pkg];
}
