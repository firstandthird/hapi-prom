const tap = require('tap');
const Hapi = require('hapi');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// todo: tests don't do anything interesting yet:
tap.test('provides a metrics route', async t => {
  const server = new Hapi.Server({ port: 8080 });
  await server.register(require('../index.js'));
  await server.start();
  // await wait(3000);
  let res = await server.inject({
    url: '/metrics',
    method: 'get'
  });
  await server.stop();
  t.end();
});
