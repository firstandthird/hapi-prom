const prom = require('prom-client');
const collectDefaultMetrics = prom.collectDefaultMetrics;

const defaults = {
  metricsPath: '/metrics'
};

const register = (server, pluginOptions) => {
  const options = Object.assign({}, defaults, pluginOptions);
  // set up prom metrics observers:
  const metric = {
    http: {
      requests: {
        duration: new prom.Summary({ name: 'http_request_duration_milliseconds', help: 'request duration in milliseconds', labelNames: ['method', 'path', 'status'] }),
        buckets: new prom.Histogram({ name: 'http_request_buckets_milliseconds', help: 'request duration buckets in milliseconds. Bucket size set to 500 and 2000 ms to enable apdex calculations with a T of 300ms', labelNames: ['method', 'path', 'status'], buckets: [ 500, 2000 ] })
      }
    }
  };
  // time method:
  const ms = (start) => {
    var diff = process.hrtime(start)
    return Math.round((diff[0] * 1e9 + diff[1]) / 1000000)
  };
  // these two handlers track request duration times:
  server.ext('onRequest', (request, h) => {
    if (request.path === options.metricsPath) {
      return h.continue;
    }
    request.plugins['hapi-prom'] = { start: process.hrtime() };
    return h.continue;
  });
  server.events.on('response', (request) => {
    if (request.path === options.metricsPath) {
      return;
    }
    const duration = ms(request.plugins['hapi-prom'].start);
    // register the duration, broken down by method, path and HTTP code:
    metric.http.requests.duration.labels(request.method, request.url.path, request.response.statusCode).observe(duration);
    metric.http.requests.buckets.labels(request.method, request.url.path, request.response.statusCode).observe(duration);
  });
  server.route({
    method: 'GET',
    path: options.metricsPath,
    async handler(request, h) {
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
