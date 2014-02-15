function foo() {}
var bar = function() {};
bar.baz = function() {};
this.onmessage = function() {};
Object.prototype.toString = function() {};
var trim = String.prototype.trim = function() {
  return this.valueOf().replace(/^\s+|\s+$/g, '');
};
this['alert'] = function(message) { console.log(message); };
Array.prototype['peek'] = function() { return this[this.length - 1]; };
var outer = {
  inner: function() {}
};
var nativeRequire = typeof require === 'function' ? require : function(lib) {};
