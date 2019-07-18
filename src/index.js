const DIRECTIVE = 'x-for';
const helperImportedFrom = 'babel-runtime-jsx-plus'
const helperImportedName = 'createList'
const helperLocalName = '__create_list__';

export default function({ types: t }) {
  // `__create_list__.call`
  const callee = t.memberExpression(t.identifier(helperLocalName), t.identifier('call'));

  return {
    visitor: {
      Program(path) {
        path.__listHelperImported = false;
      },
      JSXElement: {
        exit(path) {
          const { node, parentPath } = path;
          if (node.__jsxlist) {
            const { args, iterValue } = node.__jsxlist;
            node.__jsxlist = null;
            // Arguments for `__create_list__.call`: (this, value, render)
            const replacer = t.callExpression(callee, [
              t.thisExpression(),
              iterValue,
              t.arrowFunctionExpression(args, node)
            ]);
            if (parentPath.isJSXElement()) {
              path.replaceWith(t.jsxExpressionContainer(replacer));
            } else {
              path.replaceWith(replacer);
            }
          }
        }
      },
      JSXAttribute(path) {
        const { node } = path;
        if (t.isJSXIdentifier(node.name, { name: DIRECTIVE })) {
          // Check stynax.
          if (!t.isJSXExpressionContainer(node.value)) {
            // TODO: throw err prettier.
            console.warn('ignore x-for due to stynax error.');
            return;
          }
          const { expression } = node.value;
          let params = [];
          let iterValue;

          if (t.isBinaryExpression(expression, { operator: 'in' })) {
            // x-for={(item, index) in value}
            const { left, right } = expression;
            iterValue = right;
            if (t.isSequenceExpression(left)) {
              // x-for={(item, key) in value}
              params = left.expressions;
            } else if (t.isIdentifier(left)) {
              // x-for={item in value}
              params.push(left);
            } else {
              // x-for={??? in value}
              throw new Error('Stynax error of x-for.');
            }
          } else {
            // x-for={value}, x-for={callExp()}, ...
            iterValue = expression;
          }

          const rootPath = path.findParent(p => p.isProgram());
          const parentJSXEl = path.findParent(p => p.isJSXElement());
          parentJSXEl.node.__jsxlist = { args: params, iterValue };

          if (rootPath.__listHelperImported === false) {
            const imported = t.identifier(helperImportedName);
            const local = t.identifier(helperLocalName);
            const importDeclaration = t.importDeclaration([
              t.importSpecifier(local, imported)
            ], t.stringLiteral(helperImportedFrom))
            rootPath.unshiftContainer('body', importDeclaration);
            rootPath.__listHelperImported = true;
          }
          path.remove();
        }
      }
    }
  };
}
