const BASE_URL = 'http://yapi.local';
const ABSOLUTE_URL_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

function isAbsoluteUrl(value) {
  return ABSOLUTE_URL_RE.test(value) || value.indexOf('//') === 0;
}

function queryToObject(searchParams) {
  const query = {};

  searchParams.forEach((value, key) => {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      if (!Array.isArray(query[key])) {
        query[key] = [query[key]];
      }
      query[key].push(value);
    } else {
      query[key] = value;
    }
  });

  return query;
}

function stringifyQuery(query) {
  if (!query || typeof query !== 'object') {
    return '';
  }

  const pairs = [];
  Object.keys(query).forEach(key => {
    const value = query[key];
    const values = Array.isArray(value) ? value : [value];
    values.forEach(item => {
      pairs.push(
        encodeURIComponent(key) + '=' + encodeURIComponent(item == null ? '' : String(item))
      );
    });
  });

  return pairs.join('&');
}

function parseUrl(input, parseQueryString) {
  const raw = input == null ? '' : String(input);
  const absolute = isAbsoluteUrl(raw);
  const protocolRelative = raw.indexOf('//') === 0;
  let parsed;

  try {
    parsed = new URL(raw || '/', BASE_URL);
  } catch (err) {
    parsed = new URL('/', BASE_URL);
    parsed.pathname = raw || '/';
  }

  const path = parsed.pathname + parsed.search;
  const query = parseQueryString ? queryToObject(parsed.searchParams) : parsed.search.slice(1);
  const username = decodeURIComponent(parsed.username || '');
  const password = decodeURIComponent(parsed.password || '');
  const auth = username ? username + (password ? ':' + password : '') : null;

  return {
    href: protocolRelative ? '//' + parsed.host + path + parsed.hash : absolute ? parsed.href : path + parsed.hash,
    protocol: protocolRelative ? null : absolute ? parsed.protocol : null,
    slashes: absolute || protocolRelative,
    auth,
    host: absolute || protocolRelative ? parsed.host : null,
    hostname: absolute || protocolRelative ? parsed.hostname : null,
    port: absolute || protocolRelative ? parsed.port : null,
    pathname: parsed.pathname,
    path,
    search: parsed.search || null,
    hash: parsed.hash || null,
    query
  };
}

function normalizeProtocol(protocol) {
  if (!protocol) {
    return '';
  }
  return protocol.charAt(protocol.length - 1) === ':' ? protocol : protocol + ':';
}

function formatUrl(parts) {
  parts = parts || {};
  const protocol = normalizeProtocol(parts.protocol);
  const host = parts.host || '';
  const pathname = parts.pathname || '';
  const query = stringifyQuery(parts.query);
  const search = query ? '?' + query : parts.search || '';
  const hash = parts.hash || '';

  if (protocol) {
    return protocol + '//' + host + pathname + search + hash;
  }

  return (host ? '//' + host : '') + pathname + search + hash;
}

function resolveUrl(from, to) {
  const base = from == null ? '' : String(from);
  const target = to == null ? '' : String(to);

  if (!base) {
    return target;
  }

  const baseAbsolute = isAbsoluteUrl(base);
  const baseProtocolRelative = base.indexOf('//') === 0;
  const baseRootRelative = base.charAt(0) === '/';
  const normalizedBase = baseAbsolute
    ? base
    : BASE_URL + (baseRootRelative ? '' : '/') + base;

  try {
    const resolved = new URL(target, normalizedBase);

    if (baseProtocolRelative && !ABSOLUTE_URL_RE.test(target)) {
      return '//' + resolved.host + resolved.pathname + resolved.search + resolved.hash;
    }

    if (baseAbsolute) {
      return resolved.href;
    }

    const relative = resolved.pathname + resolved.search + resolved.hash;
    return baseRootRelative ? relative : relative.replace(/^\//, '');
  } catch (err) {
    return target || base;
  }
}

exports.parseUrl = parseUrl;
exports.formatUrl = formatUrl;
exports.resolveUrl = resolveUrl;
