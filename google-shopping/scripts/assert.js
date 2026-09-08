function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log('ok:', msg);
}

function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error('FAIL:', msg, '\n  actual  ', a, '\n  expected', e);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log('ok:', msg);
}

module.exports = { assert, assertEq };
