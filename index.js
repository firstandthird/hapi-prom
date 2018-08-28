const prom = require('prom-client');
const collectDefaultMetrics = prom.collectDefaultMetrics;

const defaults = {
  metricsPath: '/metrics'
};

const register = (server, pluginOptions) => {
  const options = Object.assign({}, defaults, pluginOptions);
  const metric = {
    http: {
      requests: {
        duration: new prom.Summary({ name: 'http_request_duration_milliseconds', help: 'request duration in milliseconds', labelNames: ['method', 'path', 'status'] }),
      }
    }
  };
  // these two handlers track request duration times:
  server.ext('onRequest', (request, h) => {
    if (request.path === options.metricsPath) {
      return h.continue;
    }
    request.plugins['hapi-prom'] = { start: new Date().getTime() };
    return h.continue;
  });
  server.events.on('response', (request) => {
    if (request.path === options.metricsPath) {
      return;
    }
    const duration = new Date().getTime() - request.plugins['hapi-prom'].start;
    // todo: register the duration with metrics:
    metric.http.requests.duration.labels(request.method, request.url.path, request.response.statusCode).observe(duration);
  });
  server.route({
    method: 'GET',
    path: options.metricsPath,
    async handler(request, h) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
      return prom.register.metrics();
    }
  });
};

exports.plugin = {
  name: 'hapi-prom',
  register,
  once: true,
  pkg: require('./package.json')
};
