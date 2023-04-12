import { traverse, parse, types } from "@babel/core";
import { npmModuleName } from "@shined/stabilizer-utils";

export function findDepFromCodeWhenHasSubFileImported(code: string) {
  const ast = parse(code);

  const hasSubpath = (path: string) => npmModuleName(path) !== path;

  const list: Set<string> = new Set<string>([]);
  traverse(ast, {
    CallExpression: (path) => {
      if (
        !types.isIdentifier(path.node.callee, { name: "require" }) &&
        !(
          types.isMemberExpression(path.node.callee) &&
          types.isIdentifier(path.node.callee.object, { name: "require" })
        )
      ) {
        return;
      }
      const moduleArg = path.node.arguments[0];
      if (types.isStringLiteral(moduleArg)) {
        if (hasSubpath(moduleArg.value)) {
          list.add(moduleArg.value);
        }
      }
    },
    ImportDeclaration: (path) => {
      const moduleArg = path.node.source;
      if (types.isStringLiteral(moduleArg)) {
        if (hasSubpath(moduleArg.value)) {
          list.add(moduleArg.value);
        }
      }
    },
    ExportDeclaration: (path) => {
      if (types.isExportDefaultDeclaration(path.node)) return;

      const moduleArg = path.node.source;
      if (types.isStringLiteral(moduleArg)) {
        if (hasSubpath(moduleArg.value)) {
          list.add(moduleArg.value);
        }
      }
    },
  });

  return list;
}
