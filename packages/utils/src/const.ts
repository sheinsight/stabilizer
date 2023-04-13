import { StabilizerConfig } from "@shined/stabilizer-types";
export const defaultConfig = <Required<StabilizerConfig>>{
  out: "compiled",
  cwd: process.cwd(),
  externals: {},
  deps: [],
};
