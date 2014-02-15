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
 *     path    = require('path'),
 *     esprima = require('esprima');
 *     files   = fs.readdirSync('example/');
 *
 * var examples = files.reduce(function(map, file) {
 *   var key = path.basename(file, '.js'),
 *       js  = fs.readFileSync('example/' + file, 'utf-8'),
 *       ast = esprima.parse(js);
 *
 *   map[key] = Spiderman(ast);
 *   return map;
 * }, {});
 *
 * function get(name) {
 *   return examples[name];
 * }
 *
 * @example
 * get('example'); // instanceof Spiderman.Node
 */
function Spiderman(ast) {
  return new Spiderman.Node(ast);
}

Spiderman.VERSION = '0.1.4';

// Declare these variables where they will be visible throughout the file;
// but only assign them if/when necessary (from calling #toString).
var esprima, codegen;

/**
 * Parses a single JavaScript expression as a {@link Spiderman.Node}.
 *
 * @example
 * Spiderman.parseExpression('var foo = "foo";').unwrap(); // => {
 *   type: 'VariableDeclaration',
 *   declarations: [
 *     {
 *       type: 'VariableDeclarator',
 *       id: { type: 'Identifier', name: 'foo' },
 *       init: { type: 'Literal', value: 'foo' }
 *     }
 *   ],
 *   kind: 'var'
 * }
 */
Spiderman.parseExpression = function parseExpression(expression) {
  if (!esprima) {
    esprima = require('esprima');
  }

  var ast = esprima.parse(expression);
  return new Spiderman.Node(ast.body[0]);
};

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

  if (this.hasName()) {
    this.name = node.id.name;
  }
};

/**
 * Produces raw JavaScript code for an AST node.
 *
 * @example
 * var example = get('example'),
 *     fooDecl = example.children[0],
 *     fooAssn = fooDecl.children[0],
 *     objExpr = fooAssn.children[0];
 *
 * fooDecl.toSource(); // => 'var foo = { bar: null };'
 * fooAssn.toSource(); // => 'foo = { bar: null }'
 * objExpr.toSource(); // => '{ bar: null }'
 */
Spiderman.Node.prototype.toSource = function toSource() {
  if (!codegen) {
    codegen = require('escodegen');
  }

  return codegen.generate(this.unwrap());
};

/**
 * Gets the scope defined by this node, if it exists, or else the scope this
 * node belongs to.
 */
Object.defineProperty(Spiderman.Node.prototype, 'scope', {
  get: function getScope() {
    this._cachedScope || (this._cachedScope = this._scope());
    return this._cachedScope;
  }
});

/**
 * Provides a map of names (of functions) to scopes.
 */
Object.defineProperty(Spiderman.Node.prototype, 'scopeMap', {
  get: function getScopeMap() {
    var self  = this,
        scope = this.scope;

    this._cachedScopeMap || (this._cachedScopeMap = this.descendents().reduce(function(map, node) {
      if (node.parentScope() !== scope) {
        return map;
      }

      if (node.isFunction()) {
        map[node.name] = node.scope;
      }

      return map;

    }, {}));

    return this._cachedScopeMap;
  }
});

/**
 * Gets the direct children of this node.
 */
Object.defineProperty(Spiderman.Node.prototype, 'children', {
  get: function getChildren() {
    var self = this;
    this._cachedChildren || (this._cachedChildren = this._children().map(function(child) {
      if (!child) {
        throw 'Missing child: ' + formatNode(self);
      }

      return new Spiderman.Node(child, self);
    }));
    return this._cachedChildren;
  }
});

/**
 * Invalidates any cached data (such as children).
 */
Spiderman.Node.prototype.dirty = function dirty() {
  this._cachedScope = null;
  this._cachedScopeMap = null;
  this._cachedChildren = null;
  this._cachedIdentifiers = null;
};

/**
 * Gets the raw AST node wrapped by this {@link Spiderman.Node}.
 *
 * @returns {Node} The raw AST node.
 */
Spiderman.Node.prototype.unwrap = function unwrap() {
  return this.node;
};

/**
 * Guesses a name for a function:
 *
 * - If the function has a name (i.e., isn't an anonymous function expression),
 *   just uses that.
 * - If the function is assigned to an identifier (either a variable declaration
 *   or a member expression), uses that instead.
 *
 * TODO: The logic of this method is TERRIBLE. It should do something much
 * simpler, like walk up the node's ancestors to find out if it's being assigned
 * to something in a much more generic way.
 *
 * @returns {?string} The inferred name, if determined, otherwise `null`.
 *
 * @example
 * var functions = get('functions').query('Function');
 *
 * functions[0].inferName();  // => 'foo'
 * functions[1].inferName();  // => 'bar'
 * functions[2].inferName();  // => 'bar.baz'
 * functions[3].inferName();  // => 'onmessage'
 * functions[4].inferName();  // => 'Object.prototype.toString'
 * functions[5].inferName();  // => 'String.prototype.trim'
 * functions[6].inferName();  // => 'alert'
 * functions[7].inferName();  // => 'Array.prototype.peek'
 * functions[8].inferName();  // => 'outer.inner'
 * functions[9].inferName();  // => 'nativeRequire'
 * functions[10].inferName(); // => 'Array.prototype.join'
 */
Spiderman.Node.prototype.inferName = function inferName() {
  var node       = this.node,
      parent     = this.parent,
      parentNode = parent.unwrap();

  switch (node.type) {
    case 'FunctionDeclaration':
      return node.id.name;

    case 'FunctionExpression':
      switch (parent.type) {
        case 'VariableDeclarator':
          if (node === parentNode.init) { return parentNode.id.name; }
          break;

        case 'AssignmentExpression':
          if (node === parentNode.right) { return guessExposedName(parentNode.left); }
          break;

        case 'ConditionalExpression':
          if (node === parentNode.consequent || node === parentNode.alternate) {
            parent = parent.parent;
            if (parent.type === 'VariableDeclarator') {
              return parent.name;
            } else if (parent.type === 'AssignmentExpression') {
              return guessExposedName(parent.unwrap().left);
            }
          }
          break;

        case 'Property':
          parent = parent
            .parent  // ObjectExpression
            .parent; // ?

          if (parent.type === 'AssignmentExpression') {
            return guessExposedName(parent.unwrap().left) + '.' + parentNode.key.name;
          } else if (parent.type === 'VariableDeclarator') {
            return guessExposedName(parent.unwrap().id) + '.' + parentNode.key.name;
          }
          break;
      }

    default:
      return null;
  }
};

/**
 * Gets all descendent nodes matching a given selector.
 *
 * @param {string} selector Right now, this only supports regex matches against
 *     node type.
 * @return {Array.<Spiderman.Node>} All nodes matching the selector.
 *
 * @example
 * var functions = get('functions').query('Function');
 *
 * functions.length;  // => 11
 * functions[0].type; // => 'FunctionDeclaration'
 * functions[1].type; // => 'FunctionExpression'
 */
Spiderman.Node.prototype.query = function query(selector) {
  var pattern = new RegExp(selector);

  return this.descendents().filter(function(node) {
    return pattern.test(node.type);
  });
};

/**
 * Appends the current node to another.
 *
 * @example
 * var simpleProgram = get('single');
 * var newDeclaration = Spiderman.parseExpression('var bar = "bar";');
 *
 * newDeclaration.appendTo(simpleProgram);
 * simpleProgram.toSource(); // => [
 *   "var foo = 'foo';",
 *   "var bar = 'bar';"
 * ].join('\n')
 */
Spiderman.Node.prototype.appendTo = function appendTo(other) {
  switch (other.type) {
    case 'Program':
    case 'BlockStatement':
      other.unwrap().body.push(this.unwrap());
      other.dirty();
      break;

    case 'FunctionDeclaration':
    case 'FunctionExpression':
      other.unwrap().body.body.push(this.unwrap());
      other.dirty();
      break;

    default:
      throw 'You cannot append to a "' + other.type + '" node!';
  }
};

/**
 * Finds a child scope by name.
 *
 * @param {string} name The name (function name) of the child scope.
 * @returns {?Spiderman.Scope} The scope, if found, or else `null`.
 *
 * @example
 * get('example').findScope('f'); // instanceof Spiderman.Scope
 * get('example').findScope('g'); // => null
 */
Spiderman.Node.prototype.findScope = function findScope(name) {
  return this.scopeMap[name];
};

/**
 * Gets all descendents (children, grandchildren, etc.) of an AST node, each
 * wrapped as a {@link Spiderman.Node} object.
 *
 * @returns {Array.<Spiderman.Node>} An array containing all of this node's
 *     descendents.
 *
 * @example
 * get('example').descendents()
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
 * get('example')._children().map(function(n) { return n.type; });
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
      return node.init ? [node.init] : [];

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
 * Tests whether this node introduces a new scope or not.
 *
 * @returns {boolean} Whether or not this node introduces a new scope.
 */
Spiderman.Node.prototype.introducesScope = function introducesScope() {
  return this.isFunction() || this.type === 'Program';
};

/**
 * Tests whether this node represents a function.
 *
 * @returns {boolean} Whether or not this node represents a function.
 */
Spiderman.Node.prototype.isFunction = function isFunction() {
  return this.type === 'FunctionDeclaration' || this.type === 'FunctionExpression';
};

/**
 * Tests whether this node has a name (i.e., it's a function or a variable).
 *
 * @returns {boolean} Whether or not this node has a name.
 */
Spiderman.Node.prototype.hasName = function hasName() {
  var node = this.unwrap();
  return node.id && node.id.type === 'Identifier';
};

/**
 * Gets the scope of this node. For most nodes, this is the same thing as
 * {@link Spiderman.Node#parentScope}. For functions, this represents the scope
 * created by the function.
 *
 * @returns {Spiderman.Scope} The scope of this node.
 *
 * @example
 * get('example')._scope().node.type             // => 'Program'
 * get('example').children[2]._scope().node.type // => 'FunctionDeclaration'
 */
Spiderman.Node.prototype._scope = function _scope() {
  return this.introducesScope() ? new Spiderman.Scope(this) : this.parent.scope;
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

/**
 * Gets the identifiers defined in the current scope.
 */
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
 * get('example').scope._identifiers(); // => ['foo', 'i', 'f']
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
}

/**
 * Guesses what a node's "exposed" name (i.e., how you would access it from
 * downstream code) might be. This method is pretty stupid at the moment.
 * Eventually it should be a lot smarter.
 *
 * @param {Node} node
 * @returns {string}
 */
function guessExposedName(node) {
  switch (node.type) {
    case 'Identifier':
      return node.name;

    case 'Literal':
      return node.value;

    case 'MemberExpression':
      return node.object.type === 'ThisExpression' ?
        guessExposedName(node.property) :
        guessExposedName(node.object) + '.' + guessExposedName(node.property);

    default:
      throw "Don't know how to stringify a " + node.type + " node!";
  }
}

module.exports = Spiderman;
