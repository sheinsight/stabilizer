import chalk from "chalk";
import { LogLevel } from "./types.js";
import randomColor from "./random-color.js";

export const createLog =
  (name: string) =>
  (...msg: unknown[]) => {
    console.log(`${name ? `${randomColor(`${name}`)}: ` : ""}`, ...msg);
  };

// level权重
const logLevelWeight = { info: 1, event: 2, warn: 3, error: 4, none: 5 };
const isShow = (logLevel: LogLevel = "info", myLevel: LogLevel) =>
  (logLevelWeight[logLevel] ?? 0) <= logLevelWeight[myLevel];

export const createLogger = (name: string, logLevel: LogLevel = "info") => {
  const log = createLog(name);
  return {
    info: (...message: unknown[]) =>
      isShow(logLevel, "info") && log(...message),
    event: (...message: unknown[]) =>
      isShow(logLevel, "event") && log(...message),
    warn: (...message: unknown[]) =>
      isShow(logLevel, "warn") &&
      log(chalk.bgYellow.white(" WARNING "), chalk.yellow(...message)),
    error: (...message: unknown[]) =>
      isShow(logLevel, "error") &&
      log(chalk.bgRed.white(" ERROR "), chalk.red(...message)),
  };
};

export type Logger = ReturnType<typeof createLogger>;
