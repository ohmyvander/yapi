import test from 'ava';
import { parseUrl, formatUrl } from '../../common/url.js';

test('parseUrl parses relative paths with query objects', t => {
  const parsed = parseUrl('/api/interface/list?project_id=1&tag=a&tag=b', true);

  t.is(parsed.href, '/api/interface/list?project_id=1&tag=a&tag=b');
  t.is(parsed.pathname, '/api/interface/list');
  t.is(parsed.path, '/api/interface/list?project_id=1&tag=a&tag=b');
  t.is(parsed.protocol, null);
  t.is(parsed.host, null);
  t.deepEqual(parsed.query, {
    project_id: '1',
    tag: ['a', 'b']
  });
});

test('parseUrl parses absolute URLs using WHATWG URL', t => {
  const parsed = parseUrl('https://example.com:8443/a/b?name=yapi', true);

  t.is(parsed.href, 'https://example.com:8443/a/b?name=yapi');
  t.is(parsed.protocol, 'https:');
  t.is(parsed.host, 'example.com:8443');
  t.is(parsed.hostname, 'example.com');
  t.is(parsed.port, '8443');
  t.is(parsed.pathname, '/a/b');
  t.deepEqual(parsed.query, { name: 'yapi' });
});

test('parseUrl exposes legacy auth, hash, and slashes fields', t => {
  const parsed = parseUrl('https://user:pass@example.com/a/b?name=yapi#top', true);

  t.is(parsed.href, 'https://user:pass@example.com/a/b?name=yapi#top');
  t.is(parsed.slashes, true);
  t.is(parsed.auth, 'user:pass');
  t.is(parsed.hash, '#top');
  t.is(parsed.path, '/a/b?name=yapi');
});

test('formatUrl formats host, path, and query', t => {
  const url = formatUrl({
    protocol: 'http',
    host: '127.0.0.1:3000',
    pathname: '/api/user/status',
    query: {
      page: 1,
      tag: ['a', 'b']
    }
  });

  t.is(url, 'http://127.0.0.1:3000/api/user/status?page=1&tag=a&tag=b');
});
