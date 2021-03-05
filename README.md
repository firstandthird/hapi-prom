# hapi-prom

hapi-prom provides [Prometheus](https://prometheus.io/docs/introduction/overview/) metrics monitoring
via [prom-client](https://github.com/siimon/prom-client)

## Installation

```console
npm install hapi-prom
```

```js
await server.register({
  plugin: require('hapi-prom'),
  options: {
    cachePollInterval: 1000
  }
});
```

   This will make the _prom-client_ available at server.plugins['hapi-prom'].client.  
   It also registers a route at _/metrics_ which will provide the key metrics in text form, for example if you have a cached server method called _foo_ and a route called _/bar_:

```
# HELP hapi_method_cache hapi server method cache
# TYPE hapi_method_cache gauge
hapi_method_cache{method="foo",type="hits"} 0
hapi_method_cache{method="foo",type="sets"} 5
hapi_method_cache{method="foo",type="gets"} 50
hapi_method_cache{method="foo",type="generates"} 5
hapi_method_cache{method="foo",type="errors"} 5
hapi_method_cache{method="foo",type="stales"} 0

# HELP hapi_request_duration_seconds request duration buckets in seconds. Bucket sizes set to .1, .3, 1.2, 5
# TYPE hapi_request_duration_seconds histogram
hapi_request_duration_seconds_bucket{le="0.1",method="get",path="/bar",status="200"} 0
hapi_request_duration_seconds_bucket{le="0.3",method="get",path="/bar",status="200"} 1
hapi_request_duration_seconds_bucket{le="1.2",method="get",path="/bar",status="200"} 5
hapi_request_duration_seconds_bucket{le="5",method="get",path="/bar",status="200"} 5
hapi_request_duration_seconds_bucket{le="+Inf",method="get",path="/bar",status="200"} 5
hapi_request_duration_seconds_sum{method="get",path="/bar",status="200"} 3.146
hapi_request_duration_seconds_count{method="get",path="/bar",status="200"} 5
```

As indicated above, hapi-prom will automatically register two metrics: a [Gauge](https://github.com/siimon/prom-client#gauge) metric named _hapi_method_cache_ that will track server method cache statistics for you and a [Histogram](https://github.com/siimon/prom-client#histogram) metric named _hapi_request_duration_seconds_ that will track how long your requests are taking.

_hapi-prom_ also decorates the server with helpers that make it easy to create [timers](https://github.com/siimon/prom-client#utility-methods and [counters](https://github.com/siimon/prom-client#counter).

To launch a Timer just do:

```js
// start a timer:
const endTimer = server.prom.startTimer('render page');
.  
.   (do some things)
.
endTimer(); //end the timer
server.prom.startTimer('render page');
```
Your metrics will now include:

```hapi_timer_sum{name="render page"}```

To count a value:
```js
server.prom.incCounter('beans'); // number of beans is now 1
for (var i = 0; i < 5; i++) {
  server.prom.incCounter('beans'); // add 1 bean
}
```
Your metrics will now include:
```hapi_counter{name="beans"} 5```

## Options

- __metricsPath__

  The route from which metrics can be fetched. Default is _/metrics_.

- __defaultMetrics__

 hapi-prom has a set of [recommended metrics](https://github.com/siimon/prom-client#default-metrics) (metrics recommended by Prometheus as well as some node-specific data) that are commonly tracked, just set __defaultMetrics__ to _true_ to automatically register and monitor these.  By default they are not tracked.


- __cachePollInterval__

    The rate (expressed in milliseconds) at which the server cache is polled by prom-client. Set this to false to skip cache metrics entirely.  Default is 60000 (1 minute).

- __defaultLabels__


- __labels__


- __auth__

  Specifies the auth scheme to apply to the _/metrics_ route, you can set this to any auth scheme you have registered with your server.  By default this value is false, so _/metrics_ is not a protected route and anyone can access it.
