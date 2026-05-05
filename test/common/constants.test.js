import test from 'ava';

const commonVariable = require('../../common/constants/variable.js');
const clientVariable = require('../../client/constants/variable.js');

test('common constants are the canonical variable export', t => {
  t.is(clientVariable, commonVariable);
  t.is(commonVariable.PAGE_LIMIT, 10);
  t.false(commonVariable.HTTP_METHOD.GET.request_body);
  t.true(commonVariable.HTTP_METHOD.POST.request_body);
});
