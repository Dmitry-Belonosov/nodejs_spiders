const { assertEq } = require('./assert');
const { countryFromPayload, isUnitedStates } = require('../locale');

assertEq(countryFromPayload({ country: 'us' }), 'US', 'ipinfo country');
assertEq(countryFromPayload({ countryCode: 'RU' }), 'RU', 'ipapi countryCode');
assertEq(isUnitedStates('US'), true, 'US is accepted');
assertEq(isUnitedStates('ru'), false, 'RU is rejected');
console.log('test_locale.js passed');
