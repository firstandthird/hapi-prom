const tap = require('tap');
const Hapi = require('hapi');
const cookie = require('hapi-auth-cookie');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

tap.test('provides a metrics route', async t => {
  const server = new Hapi.Server({ port: 8080 });
  await server.register({
    plugin: require('../index.js'),
    options: {
      cachePollInterval: 1000 // ms between polling server methods for cache states
    }
  });
  // declare a method that has a cache:
  const add = (a, b) => (a + b);
  server.method('sum', add, { cache: { expiresIn: 200, generateTimeout: 100 } });
  for (let i = 0; i < 50; i++) {
    server.methods.sum(i % 5, 5);
  }
  // declare a route that takes a random amount of time before returning:
  server.route({
    method: 'get',
    path: '/slow',
    async handler(request, h) {
      await wait(Math.random() * 1000);
      return 'ok';
    }
  });
  await server.start();
  for (let i = 0; i < 5; i++) {
    await server.inject({
      url: '/slow',
      method: 'get'
    });
  }
  let res = await server.inject({
    url: '/metrics',
    method: 'get'
  });
  t.match(res.payload, `hapi_method_cache_hits{method="sum"} 0`);
  t.match(res.payload, `hapi_method_cache_gets{method="sum"} 50`);
  t.match(res.payload, `hapi_method_cache_sets{method="sum"} 5`);
  t.notMatch(res.payload, `hapi_method_cache_misses{method="sum"} NaN`, 'does not report NaNs');
  t.match(res.payload, `hapi_method_cache_stales{method="sum"} 0`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="0.1",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="0.3",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="1.2",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="5",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="+Inf",method="get",path="/slow",status="200"}`);
  await server.stop();
  t.end();
});

tap.test('auth is false by default', async t => {
  const server = new Hapi.Server({ port: 8080 });
  await server.register({
    plugin: require('../index.js'),
  });
  await server.register(cookie);
  server.auth.strategy('session', 'cookie', { password: 'password-should-be-32-characters'});
  server.auth.default('session');
  await server.start();

  let res = await server.inject({
    url: '/metrics',
    method: 'get'
  });
  t.equal(res.statusCode, 200);
  await server.stop();
  t.end();
});

tap.test('only use cache if cache server is enabled', async t => {
  const server = new Hapi.Server({ port: 8080, cache: false });
  await server.register({
    plugin: require('../index.js'),
  });
  await server.register(cookie);
  server.auth.strategy('session', 'cookie', { password: 'password-should-be-32-characters'});
  server.auth.default('session');
  await server.start();

  let res = await server.inject({
    url: '/metrics',
    method: 'get'
  });
  t.equal(res.statusCode, 200);
  await server.stop();
  t.end();
});

tap.test('no cache metrics if cache disabled', async t => {
  const server = new Hapi.Server({ port: 8080, cache: false });
  await server.register({
    plugin: require('../index.js'),
    options: {
      cachePollInterval: 1000 // ms between polling server methods for cache states
    }
  });
  // declare a method that has a cache:
  const add = (a, b) => (a + b);
  server.method('sum', add, { cache: { expiresIn: 200, generateTimeout: 100 } });
  for (let i = 0; i < 50; i++) {
    server.methods.sum(i % 5, 5);
  }
  // declare a route that takes a random amount of time before returning:
  server.route({
    method: 'get',
    path: '/slow',
    async handler(request, h) {
      await wait(Math.random() * 1000);
      return 'ok';
    }
  });
  await server.start();
  for (let i = 0; i < 5; i++) {
    await server.inject({
      url: '/slow',
      method: 'get'
    });
  }
  let res = await server.inject({
    url: '/metrics',
    method: 'get'
  });
  t.notMatch(res.payload, `hapi_method_cache_hits{method="sum"} 0`);
  t.notMatch(res.payload, `hapi_method_cache_gets{method="sum"} 50`);
  t.notMatch(res.payload, `hapi_method_cache_sets{method="sum"} 5`);
  t.notMatch(res.payload, `hapi_method_cache_misses{method="sum"} NaN`);
  t.notMatch(res.payload, `hapi_method_cache_stales{method="sum"} 0`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="0.1",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="0.3",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="1.2",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="5",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="+Inf",method="get",path="/slow",status="200"}`);
  await server.stop();
  t.end();
});
