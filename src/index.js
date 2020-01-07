const DIRECTIVE = 'x-for';
const helperImportedFrom = 'babel-runtime-jsx-plus'
const helperImportedName = 'createList'
const helperLocalName = '__create_list__';

export default function ({ types: t }) {
  function getAttrXFor(node) {
    return t.isJSXElement(node)
      && node.openingElement.attributes.length > 0
      && node.openingElement.attributes.find((jsxAttr) => t.isJSXAttribute(jsxAttr) && t.isJSXIdentifier(jsxAttr.name, { name: DIRECTIVE }));
  }

  return {
    visitor: {
      Program(path) {
        path.__listHelperImported = false;
      },
      JSXElement(path) {
        const { node, parentPath } = path;

        if (node.__listHandled) return;
        node.__listHandled = true;

        const attrXFor = getAttrXFor(node);
        if (attrXFor) {
          // Remove x-for attribute
          node.openingElement.attributes.splice(
            node.openingElement.attributes.indexOf(attrXFor),
            1
          );
          const rootPath = path.findParent(p => p.isProgram());
          // Check stynax.
          if (!t.isJSXExpressionContainer(attrXFor.value)) {
            // TODO: throw err prettier.
            console.warn('ignore x-for due to stynax error.');
            return;
          }
          const { expression } = attrXFor.value;
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

          if (rootPath.__listHelperImported === false) {
            const imported = t.identifier(helperImportedName);
            const local = t.identifier(helperLocalName);
            const importDeclaration = t.importDeclaration([
              t.importSpecifier(local, imported)
            ], t.stringLiteral(helperImportedFrom))
            rootPath.unshiftContainer('body', importDeclaration);
            rootPath.__listHelperImported = true;
          }

          // `__create_list__.call(this, value, render)`
          const replacer = t.callExpression(
            t.memberExpression(t.identifier(helperLocalName), t.identifier('call')),
            [t.thisExpression(), iterValue, t.arrowFunctionExpression(params, node)]
          );
          if (parentPath.isJSXElement()) {
            path.replaceWith(t.jsxExpressionContainer(replacer));
          } else {
            path.replaceWith(replacer);
          }
        }
      },
    }
  };
}
