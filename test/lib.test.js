import test from 'ava';

const rewire = require("rewire");
const lib = rewire('../common/lib.js');

const plugin = rewire('../common/plugin.js')
const initPlugins = plugin.initPlugins;


test('initPlugins', t=>{
  plugin.__set__("getPluginConfig", function(){
    return {
      server: true,
      client: true
    }
  })
  let configs = initPlugins(['a', 'b'], 'exts');
  t.deepEqual(configs, [{
    name: 'a',
    enable: true,
    server: true,
    client: true
  }, {
    name: 'b',
    enable: true,
    server: true,
    client: true
  }])
})

test('initPlugins2', t=>{
  plugin.__set__("getPluginConfig", function(){
    return {
      server: true,
      client: false
    }
  })
  let configs = initPlugins(['a', 'b'], 'exts');
  t.deepEqual(configs, [{
    name: 'a',
    enable: true,
    server: true,
    client: false
  }, {
    name: 'b',
    enable: true,
    server: true,
    client: false
  }])
})

test('initPlugins dedupes duplicate plugin names', t=>{
  plugin.__set__("getPluginConfig", function(){
    return {
      server: false,
      client: true
    }
  })
  let configs = initPlugins(['a', {name: 'a'}], 'exts');
  t.deepEqual(configs, [{
    name: 'a',
    enable: true,
    server: false,
    client: true
  }])
})

test('initPlugins keeps plugin options', t=>{
  plugin.__set__("getPluginConfig", function(){
    return {
      server: false,
      client: true
    }
  })
  let configs = initPlugins([{
    name: 'a',
    options: {
      a:1,
      t:{
        c:3
      }
    }
  }], 'exts');
  t.deepEqual(configs, [{
    name: 'a',
    enable: true,
    server: false,
    client: true,
    options: {
      a:1,
      t:{
        c:3
      }
    }
  }])
})

test('initPlugins filters disabled server and client plugins', t=>{
  plugin.__set__("getPluginConfig", function(){
    return {
      server: false,
      client: false
    }
  })
  let configs = initPlugins(['a', 'b'], 'exts');
  t.deepEqual(configs, [])
})

test('testJsonEqual', t=>{
  let json1 = {
    a:"1",
    b:2,
    c:{
      t:3,
      x: [11,22]
    }
  };

  let json2 = {    
    c:{
      x: [11,22],
      t:3
    },
    b:2,
    a:"1"
  }
  t.true(lib.jsonEqual(json1, json1));
})

test('testJsonEqualBase', t=>{
  t.true(lib.jsonEqual(1,1));
})

test('testJsonEqualBaseString', t=>{
  t.true(lib.jsonEqual('2', '2'));
})


test('isDeepMatch matches direct object subset', t=>{
  t.true(lib.isDeepMatch({a:'aaaaa', b:2}, {a:'aaaaa'}))
})

test('isDeepMatch matches nested object subset', t=>{
  t.true(lib.isDeepMatch({a:1, b:2, c: {t:'ttt'}}, {c: {t:'ttt'}}))
})

test('isDeepMatch treats undefined expected value as match', t=>{
  t.true(lib.isDeepMatch({}, undefined))
})

test('isDeepMatch treats undefined source and empty expected object as match', t=>{
  t.true(lib.isDeepMatch(undefined, {}))
})

test('isDeepMatch rejects undefined source for non-empty expected object', t=>{
  t.false(lib.isDeepMatch(undefined, {a:1}))
})

test('isDeepMatch compares numeric-like values loosely', t=>{
  t.true(lib.isDeepMatch({ t: 1,
    b: '2',
    ip: '127.0.0.1',
    interface_id: 1857,
    ip_enable: true,
    params: { a: 'x', b: 'y' },
    res_body: '111',
    code: 1 }, {t:'1'}))
})

test('isDeepMatch matches arrays deeply', t=>{
    t.true(lib.isDeepMatch({ t:[{a: 1}]}, { t:[{a: 1}]}))
  })

  test('isDeepMatch rejects partial array object matches', t=>{
    t.false(lib.isDeepMatch({ t:[{a: 1, b: 12}]}, { t:[{a: 1}]}))
  })

  test('isDeepMatch matches root arrays', t=>{
    t.true(lib.isDeepMatch([{a: 1}], [{a: 1}]))
  })
