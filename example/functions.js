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
Array.prototype.join = function join(delimiter) {
  var result = '';
  for (var i = 0, len = this.length; i < len; ++i) {
    if (i > 0) { result += delimiter; }
    result += this[i];
  }
  return result;
};
