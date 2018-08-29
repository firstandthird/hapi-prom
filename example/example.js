const Hapi = require('hapi');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const f = async () => {
  const server = new Hapi.Server({ port: 8080 });
  await server.register(require('../index.js'));
  // declare a route that takes a random amount of time before returning:
  server.route({
    method: 'get',
    path: '/slow',
    async handler(request, h) {
      await wait(Math.random() * 1000);
      return 'ok';
    }
  });

  server.route({
    method: 'get',
    path: '/user/{slug}',
    async handler(request, h) {
      return request.params.slug;
    }
  });
  // declare a route that errors randomly:
  server.route({
    method: 'get',
    path: '/error',
    handler(request, h) {
      if (Math.random() > .5) {
        throw new Error('an error!');
      }
      return 'whew!';
    }
  });
  // declare a route that has params, all calls will be
  // logged under the route path, regardless of what the actual params are:
  server.route({
    method: 'get',
    path: '/params/{param1}/{param2}',
    handler(request, h) {
      return request.params.param1;
    }
  });
  await server.start();
  console.log('Server started on port 8080');
  // get an array of calls to the /error and /slow routes (they are all Promises):
  const promisepromises = [];
  for (var i = 0; i < 50; i++) {
    promisepromises.push(server.inject({
      method: 'get',
      url: '/error'
    }));
    promisepromises.push(server.inject({
      method: 'get',
      url: '/slow'
    }));
    await server.inject({
      method: 'get',
      // all of these calls will be logged under /params/{param1}/{param2}:
      url: `/params/${Math.random()}/${Math.random()}`
    });
  }
  // now wait for all those calls to return:
  await Promise.all(promisepromises);

  // now get the raw metrics from hapi-prom:
  const metrics = await server.inject({
    url: '/metrics',
    method: 'get'
  });
  console.log('Metrics are:');
  console.log('######################################################################################################');
  console.log(metrics.payload);
  console.log('######################################################################################################');
  await server.stop();
};

f();
