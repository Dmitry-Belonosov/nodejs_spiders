const { assert, assertEq } = require('./assert');
const { withCaptchaLock, isCaptchaSolving, setRecaptchaTilePicker } = require('../recaptcha');

(async () => {
  assertEq(isCaptchaSolving(), false, 'not solving at start');

  const order = [];
  const first = withCaptchaLock(async () => {
    order.push('a-start');
    await new Promise((r) => setTimeout(r, 40));
    order.push('a-end');
    return 'A';
  });
  const second = withCaptchaLock(async () => {
    order.push('b-start');
    order.push('b-end');
    return 'B';
  });

  const [a, b] = await Promise.all([first, second]);
  assertEq(a, 'A', 'first solve result');
  assertEq(b, 'B', 'second solve result');
  assertEq(order, ['a-start', 'a-end', 'b-start', 'b-end'], 'tabs run one after another');
  assertEq(isCaptchaSolving(), false, 'lock released');
  setRecaptchaTilePicker(null);
  console.log('test_recaptcha.js passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
