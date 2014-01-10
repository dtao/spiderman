var foo = { bar: null };

for (var i = 0; i < 10; ++i) {
  console.log(i);
}

function f() {
  return foo;
}

f().bar = 'hello';

try {
  console.log(foo.bar);
} catch (e) {
  throw e;
}
