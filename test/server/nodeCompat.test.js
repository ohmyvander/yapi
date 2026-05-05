import test from 'ava';
import url from 'url';
import { preferWhatwgUrlParse } from '../../server/utils/nodeCompat.js';

function captureDep0169(fn) {
  const warnings = [];
  const emitWarning = process.emitWarning;

  process.emitWarning = function(warning, type, code) {
    if (
      code === 'DEP0169' ||
      (warning && warning.code === 'DEP0169') ||
      String(warning).indexOf('url.parse()') !== -1
    ) {
      warnings.push({ warning: String(warning), type, code });
      return;
    }

    return emitWarning.apply(this, arguments);
  };

  try {
    return { result: fn(), warnings };
  } finally {
    process.emitWarning = emitWarning;
  }
}

test('preferWhatwgUrlParse replaces url.resolve without DEP0169', t => {
  preferWhatwgUrlParse();

  const { result, warnings } = captureDep0169(() =>
    url.resolve('http://example.com/schemas/root.json#/defs/root', '../common.json#/defs/name')
  );

  t.is(result, 'http://example.com/common.json#/defs/name');
  t.deepEqual(warnings, []);
});
