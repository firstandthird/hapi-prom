const tap = require('tap');
const Hapi = require('@hapi/hapi');
const cookie = require('@hapi/cookie');
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
  t.ok(server.plugins['hapi-prom'].client, 'expose the prom client');
  t.equal(res.headers['content-type'], 'text/plain; version=0.0.4; charset=utf-8');
  t.match(res.payload, `hapi_method_cache{method="sum",type="hits"} 0`);
  t.match(res.payload, `hapi_method_cache{method="sum",type="sets"}`);
  t.match(res.payload, `hapi_method_cache{method="sum",type="gets"}`);
  t.match(res.payload, `hapi_method_cache{method="sum",type="generates"}`);
  t.match(res.payload, `hapi_method_cache{method="sum",type="errors"}`);
  t.notMatch(res.payload, `hapi_method_cache{method="sum",type="misses"}`, 'does not report NaNs');
  t.match(res.payload, `hapi_method_cache{method="sum",type="stales"} 0`);
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
  server.auth.strategy('session', 'cookie', { cookie: { password: 'password-should-be-32-characters'} });
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
  server.auth.strategy('session', 'cookie', { cookie: { password: 'password-should-be-32-characters'} });
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

tap.test('no cache metrics if server cache disabled', async t => {
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
  t.notMatch(res.payload, `hapi_method_cache{method="sum",type="hits"}`);
  t.notMatch(res.payload, `hapi_method_cache{method="sum",type="misses"}`);
  t.notMatch(res.payload, `hapi_method_cache{method="sum,type="stales"}`);
  t.notMatch(res.payload, `hapi_method_cache{method="sum",type="gets"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="0.1",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="0.3",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="1.2",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="5",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="+Inf",method="get",path="/slow",status="200"}`);
  await server.stop();
  t.end();
});

tap.test('no cache metrics if plugin option disabled', async t => {
  const server = new Hapi.Server({ port: 8080 });
  await server.register({
    plugin: require('../index.js'),
    options: {
      cachePollInterval: false // set to false to skip logging cache
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
  t.notMatch(res.payload, `hapi_method_cache{method="sum",type="hits"}`);
  t.notMatch(res.payload, `hapi_method_cache{method="sum",type="misses"}`);
  t.notMatch(res.payload, `hapi_method_cache{method="sum,type="stales"}`);
  t.notMatch(res.payload, `hapi_method_cache{method="sum",type="gets"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="0.1",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="0.3",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="1.2",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="5",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="+Inf",method="get",path="/slow",status="200"}`);
  await server.stop();
  t.end();
});

tap.test('provides a timing metric', async t => {
  const server = new Hapi.Server({ port: 8080 });
  await server.register({
    plugin: require('../index.js'),
    options: {
      cachePollInterval: 1000 // ms between polling server methods for cache states
    }
  });
  await server.start();
  const end = server.prom.startTimer('response time');
  await wait(500);
  end();
  const end2 = server.prom.startTimer('response time');
  await wait(5000);
  end2();
  const end3 = server.prom.startTimer('another time');
  await wait(5000);
  end3();

  let res = await server.inject({
    url: '/metrics',
    method: 'get'
  });
  await server.stop();
  const rows = res.payload.split('\n');
  let found = 0;
  rows.forEach(row => {
    if (row.startsWith('hapi_timer_sum{name="response time"}')) {
      found++;
    }
    if (row.startsWith('hapi_timer_sum{name="another time"}')) {
      found++;
    }
  })
  t.equal(found, 2, 'contains metrics for both timers');
  t.end();
});

tap.test('provides a counter metric', async t => {
  const server = new Hapi.Server({ port: 8080 });
  await server.register({
    plugin: require('../index.js'),
    options: {
      cachePollInterval: 1000 // ms between polling server methods for cache states
    }
  });
  await server.start();
  server.prom.incCounter('some here');
  server.prom.incCounter('more over there');
  let res = await server.inject({
    url: '/metrics',
    method: 'get'
  });
  await server.stop();
  const rows = res.payload.split('\n');
  let found = 0;
  rows.forEach(row => {
    if (row.startsWith('hapi_counter{name="some here"} 1')) {
      found++;
    }
    if (row.startsWith('hapi_counter{name="more over there"} 1')) {
      found++;
    }
  });
  t.equal(found, 2, 'contains metrics for both counters');
  t.end();
});
