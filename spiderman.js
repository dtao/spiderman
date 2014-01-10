/**
 * @typedef {object} Node
 * @property {string} type
 */

/**
 * Wraps an AST.
 *
 * @param {Node} ast The AST (abstract syntax tree) to wrap.
 * @returns {Spiderman.Node} A {@link Spiderman.Node} representing the root of
 *     the AST.
 *
 * @exampleHelpers
 * var fs      = require('fs'),
 *     esprima = require('esprima');
 *     js      = fs.readFileSync('example/example.js', 'utf8'),
 *     ast     = esprima.parse(js);
 *
 * @example
 * Spiderman(ast); // instanceof Spiderman.Node
 */
function Spiderman(ast) {
  return new Spiderman.Node(ast);
}

Spiderman.VERSION = '0.1.0';

/**
 * Wraps an AST node conforming to the SpiderMonkey Parser API.
 *
 * @constructor
 * @param {Node} node
 */
Spiderman.Node = function Node(node) {
  if (!node) { return; }

  this.node = node;
  this.type = node.type;
};

/**
 * Gets all descendents (children, grandchildren, etc.) of an AST node, each
 * wrapped as a {@link Spiderman.Node} object.
 *
 * @returns {Array.<Spiderman.Node>} An array containing all of this node's
 *     descendents.
 *
 * @example
 * Spiderman(ast).descendents()
 *   .map(function(n) { return n.type; })
 *   .slice(0, 6);
 * // => [
 *   'VariableDeclaration',
 *   'VariableDeclarator',
 *   'ObjectExpression',
 *   'Property',
 *   'Identifier',
 *   'Literal',
 * ]
 */
Spiderman.Node.prototype.descendents = function descendents() {
  var children    = this.children(),
      descendents = [];

  for (var i = 0, len = children.length; i < len; ++i) {
    descendents.push(children[i]);
    descendents.push.apply(descendents, children[i].descendents());
  }

  return descendents;
};

/**
 * Gets all of the children of an AST node, each wrapped as a
 * {@link Spiderman.Node} object.
 *
 * @returns {Array.<Spiderman.Node>} An array containing this node's direct
 *     children, wrapped as {@link Spiderman.Node} objects.
 */
Spiderman.Node.prototype.children = function children() {
  this.wrappedChildren || (this.wrappedChildren = this._children().map(function(child) {
    return new Spiderman.Node(child);
  }));
  return this.wrappedChildren;
};

/**
 * Gets all of the children of an AST node.
 *
 * This method was implemented by going one-by-one through every node type in
 * the SpiderMonkey Parser API docs:
 *
 * https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API
 *
 * @returns {Array.<Node>} An array containing this node's direct children.
 *
 * @example
 * Spiderman(ast)._children().map(function(n) { return n.type; });
 * // => [
 *   'VariableDeclaration',
 *   'ForStatement',
 *   'FunctionDeclaration',
 *   'ExpressionStatement',
 *   'ExpressionStatement'
 * ]
 */
Spiderman.Node.prototype._children = function _children() {
  var node = this.node;

  switch (node.type) {
    case 'Program':
      return node.body;

    case 'FunctionDeclaration':
    case 'FunctionExpression':
      return [node.body];

    case 'EmptyStatement':
      return [];

    case 'BlockStatement':
      return node.body;

    case 'ExpressionStatement':
      return [node.expression];

    case 'IfStatement':
      return [node.test, node.consequent].concat(
        node.alternate ? [node.alternate] : []);

    case 'LabeledStatement':
      return [node.body];

    case 'BreakStatement':
    case 'ContinueStatement':
      return [];

    case 'WithStatement':
      return [node.object, node.body];

    case 'SwitchStatement':
      return [node.discriminant].concat(node.cases);

    case 'ReturnStatement':
      return node.argument ? [node.argument] : [];

    case 'ThrowStatement':
      return [node.block].concat(
        node.handler ? [node.handler] : []).concat(
        node.finalizer ? [node.finalizer] : []);

    case 'WhileStatement':
      return [node.test, node.body];

    case 'DoWhileStatement':
      return [node.body, node.test];

    case 'ForStatement':
      return [].concat(
        node.init ? [node.init] : []).concat(
        node.test ? [node.test] : []).concat(
        node.update ? [node.update] : []).concat([node.body]);

    case 'ForInStatement':
    case 'ForOfStatement':
      return [node.left, node.right, node.body];

    case 'LetStatement':
      return [node.head, node.body];

    case 'DebuggerStatement':
      return [];

    case 'VariableDeclaration':
      return node.declarations;

    case 'VariableDeclarator':
      return [node.init];

    case 'ThisExpression':
      return [];

    case 'ArrayExpression':
      return node.elements;

    case 'ObjectExpression':
      return node.properties;

    case 'Property':
      return [node.key, node.value];

    case 'ArrowExpression':
      return [node.body];

    case 'SequenceExpression':
      return node.expressions;

    case 'UnaryExpression':
      return [node.argument];

    case 'BinaryExpression':
      return [node.left, node.right];

    case 'AssignmentExpression':
      return [node.left, node.right];

    case 'UpdateExpression':
      return [node.argument];

    case 'LogicalExpression':
      return [node.left, node.right];

    case 'ConditionalExpression':
      return [node.test, node.consequent, node.alternate];

    case 'NewExpression':
      return [node.callee].concat(node.arguments);

    case 'CallExpression':
      return [node.callee].concat(node.arguments);

    case 'MemberExpression':
      return [node.object, node.property];

    case 'YieldExpression':
      return [node.argument];

    // Skipping a bunch of SpiderMonkey-specific things just to expedite things.

    case 'SwitchCase':
      return (node.test ? [node.test] : []).concat(node.consequent);

    case 'CatchClause':
      return [node.param, node.body];

    case 'Identifier':
      return [];

    case 'Literal':
      return [];

    default:
      throw 'Unknown node type: ' + Spiderman.formatNode(node) + '\n\n' +
        'Report this to https://github.com/dtao/spiderman/issues';
  }
};

/**
 * Provides a useful string representation of a node.
 *
 * @param {Node} node
 * @returns {string}
 */
Spiderman.formatNode = function formatNode(node) {
  var properties = Object.keys(node).map(function(key) {
    var value = node[key];

    if (value && value.type) {
      return key + ':' + value.type;
    } else if (value instanceof Array) {
      return key + ':[]';
    } else if (value) {
      return key + ':' + typeof value;
    } else {
      return key;
    }
  });

  return node.type + ' (' + properties.join(', ') + ')';
};

module.exports = Spiderman;
