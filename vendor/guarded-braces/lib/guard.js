'use strict';

const MAX_AST_DEPTH = 64;

// Inspect only child edges: upstream ASTs intentionally contain parent links.
// Iterative validation cannot exhaust the JavaScript stack on hostile input.
const assertSafeAst = ast => {
  const pending = [{ node: ast, depth: 0, exit: false }];
  const active = new Set();
  while (pending.length) {
    const { node, depth, exit } = pending.pop();
    if (exit) {
      active.delete(node);
      continue;
    }
    if (!node || typeof node !== 'object' || depth > MAX_AST_DEPTH || active.has(node)) {
      throw new SyntaxError('Brace AST exceeds nesting limit or contains a cycle');
    }
    if (!node.nodes) continue;
    if (!Array.isArray(node.nodes)) throw new SyntaxError('Invalid brace AST children');
    active.add(node);
    pending.push({ node, depth, exit: true });
    for (let index = node.nodes.length - 1; index >= 0; index--) {
      pending.push({ node: node.nodes[index], depth: depth + 1, exit: false });
    }
  }
};

module.exports = { MAX_AST_DEPTH, assertSafeAst };
