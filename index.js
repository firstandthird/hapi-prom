const prom = require('prom-client');
const collectDefaultMetrics = prom.collectDefaultMetrics;

const defaults = {
  metricsPath: '/metrics',
  defaultMetrics: false,
  labels: {
    duration: ['method', 'path', 'status'],
    buckets: ['method', 'path', 'status']
  }
};

const register = (server, pluginOptions) => {
  const options = Object.assign({}, defaults, pluginOptions);
  if (options.defaultMetrics) {
    collectDefaultMetrics({ timeout: 5000 });
  }
  // set up prom metrics observers:
  const metric = {
    http: {
      requests: {
        duration: new prom.Summary({ name: 'http_request_duration_milliseconds', help: 'request duration in milliseconds', labelNames: options.labels.duration }),
        buckets: new prom.Histogram({ name: 'http_request_buckets_milliseconds', help: 'request duration buckets in milliseconds. Bucket sizes set to .1, .3, 1.2, 5', labelNames: options.labels.buckets, buckets: [ .1, .3, 1.2, 5 ] })
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
    const duration = ms(request.plugins['hapi-prom'].start) / 1000; // log in seconds
    // register the duration, broken down by method, path and HTTP code:
    metric.http.requests.duration.labels(request.method, request.route.path, request.response.statusCode).observe(duration);
    metric.http.requests.buckets.labels(request.method, request.route.path, request.response.statusCode).observe(duration);
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
