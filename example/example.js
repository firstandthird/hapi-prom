const Hapi = require('hapi');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const f = async () => {
  const server = new Hapi.Server({ port: 8080 });
  await server.register(require('../index.js'));
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
    path: '/error',
    handler(request, h) {
      throw new Error('an error!');
    }
  })
  await server.start();
  console.log('Server started on port 8080');
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
  }
  await Promise.all(promisepromises);
  const metrics = await server.inject({
    url: '/metrics',
    method: 'get'
  });
  console.log(metrics.payload);
  await server.stop();
};

f();
