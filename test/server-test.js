const tap = require('tap');
const Hapi = require('hapi');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// todo: tests don't do anything interesting yet:
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
  t.match(res.payload, `hapi_method_cache_hits{method="sum"} 0`);
  t.match(res.payload, `hapi_method_cache_gets{method="sum"} 50`);
  t.match(res.payload, `hapi_method_cache_sets{method="sum"} 5`);
  t.match(res.payload, `hapi_method_cache_misses{method="sum"} NaN`);
  t.match(res.payload, `hapi_method_cache_stales{method="sum"} 0`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="0.1",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="0.3",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="1.2",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="5",method="get",path="/slow",status="200"}`);
  t.match(res.payload, `hapi_request_duration_seconds_bucket{le="+Inf",method="get",path="/slow",status="200"}`);
  await server.stop();
  t.end();
});
