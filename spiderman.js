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
Spiderman.Node = function Node(node, parent) {
  this.node   = node;
  this.type   = node.type;
  this.parent = parent;
};

Object.defineProperty(Spiderman.Node.prototype, 'scope', {
  get: function getScope() {
    this._cachedScope || (this._cachedScope = this._scope());
    return this._cachedScope;
  }
});

Object.defineProperty(Spiderman.Node.prototype, 'children', {
  get: function getChildren() {
    var self = this;
    this._cachedChildren || (this._cachedChildren = this._children().map(function(child) {
      if (!child) {
        throw 'Missing child: ' + Spiderman.formatNode(self);
      }

      return new Spiderman.Node(child, self);
    }));
    return this._cachedChildren;
  }
});

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
  var children = this.children,
      list     = arguments.length > 0 ? arguments[0] : [];

  for (var i = 0, len = children.length; i < len; ++i) {
    list.push(children[i]);
    children[i].descendents(list);
  }

  return list;
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
 *   'TryStatement'
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
      return [node.argument];

    case 'TryStatement':
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
      throw 'Unknown node type: ' + formatNode(node) + '\n\n' +
        'Report this to https://github.com/dtao/spiderman/issues';
  }
};

/**
 * Gets the scope in which this node is defined.
 *
 * @returns {Spiderman.Scope} The scope of this node's parent.
 */
Spiderman.Node.prototype.parentScope = function parentScope() {
  return this.parent.scope;
};

/**
 * Gets the scope of this node. For most nodes, this is the same thing as
 * {@link Spiderman.Node#parentScope}. For functions, this represents the scope
 * created by the function.
 *
 * @returns {Spiderman.Scope} The scope of this node.
 *
 * @example
 * var program = Spiderman(ast);
 *
 * program._scope().node.type               // => 'Program'
 * program.children[2]._scope().node.type // => 'FunctionDeclaration'
 */
Spiderman.Node.prototype._scope = function _scope() {
  switch (this.type) {
    case 'Program':
    case 'FunctionDeclaration':
    case 'FunctionExpression':
      return new Spiderman.Scope(this);

    default:
      return this.parent.scope;
  }
};

/**
 * Provides a JSON representation of a node.
 *
 * @returns {string} A JSON representation of this node.
 */
Spiderman.Node.prototype.toJSON = function toJSON() {
  return JSON.stringify.apply(JSON, [this.node].concat(arguments));
};

/**
 * Represents a JavaScript scope.
 *
 * @constructor
 * @param {Spiderman.Node} node
 */
Spiderman.Scope = function Scope(node) {
  this.node = node;
};

Object.defineProperty(Spiderman.Scope.prototype, 'identifiers', {
  get: function getIdentifiers() {
    this._cachedIdentifiers || (this._cachedIdentifiers = this._identifiers());
    return this._cachedIdentifiers;
  }
});

/**
 * Gets all of the identifiers in a JavaScript scope.
 *
 * @returns {Array.<string>} An array containing all of the identifiers defined
 *     within the current scope.
 *
 * @example
 * Spiderman(ast).scope._identifiers(); // => ['foo', 'i', 'f']
 */
Spiderman.Scope.prototype._identifiers = function _identifiers() {
  var scope = this,
      list  = [];

  this.node.descendents().forEach(function(node) {
    if (node.parentScope() !== scope) {
      return;
    }

    node = node.node;
    if (node.id && node.id.type === 'Identifier') {
      list.push(node.id.name);
    }
  });

  return list;
};

/**
 * Provides a useful string representation of a node.
 *
 * @param {Node} node
 * @returns {string}
 */
function formatNode(node) {
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
