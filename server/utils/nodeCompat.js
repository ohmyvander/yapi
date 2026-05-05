const Module = require('module');
const { parseUrl, resolveUrl } = require('../../common/url.js');

let patched = false;
let urlParsePatched = false;

function preferUserlandPunycode() {
  if (patched) {
    return;
  }

  const userlandPunycode = require('punycode/');
  const load = Module._load;

  Module._load = function(request) {
    if (request === 'punycode') {
      return userlandPunycode;
    }
    return load.apply(this, arguments);
  };

  patched = true;
}

function preferWhatwgUrlParse() {
  if (urlParsePatched) {
    return;
  }

  const url = require('url');
  url.parse = parseUrl;
  url.resolve = resolveUrl;
  urlParsePatched = true;
}

function applyNodeCompat() {
  preferUserlandPunycode();
  preferWhatwgUrlParse();
}

exports.preferUserlandPunycode = preferUserlandPunycode;
exports.preferWhatwgUrlParse = preferWhatwgUrlParse;
exports.applyNodeCompat = applyNodeCompat;
