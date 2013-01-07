## Distributed Computation for NodeJS

[![Build Status](https://secure.travis-ci.org/lloyd/node-compute-cluster.png)](http://travis-ci.org/lloyd/node-compute-cluster)

How can you build a responsive and robust nodejs server that does some heavy
computational lifting?  Some node libraries (like the awesome [node-bcrypt][])
do their own threading internally and combine that with an async API.  This
allows libraries to internally thread their calls and use multiple cores.

  [node-bcrypt]: https://github.com/ncb000gt/node.bcrypt.js

While this is pretty awesome, it is significant work for library implementors,
and as this pattern becomes rampant, the application author loses fine grained
control over the resource usage of their server as well as the relative priority
of compute tasks.

If you just naively run computation on the main evaluation thread, you're blocking
node.js from doing *anything else* and making your whole server unresponsive.

## The solution?

`node-compute-cluster` is a tiny abstraction around a group of
processes and the [built-in IPC][] introduced in NodeJS 0.6.x.  It provides a simple
API by which you can allocate and run work on a cluster of computation processes.
This allows you to perform multiprocessing at a more granular level, and produce
a responsive yet efficient computation server.

 [built-in IPC]: http://nodejs.org/docs/v0.6.3/api/all.html#child_process.fork

## Installation

``` sh
$ npm install compute-cluster
```

## Usage

First you write your main program:

``` js
const computecluster = require('compute-cluster');

// allocate a compute cluster
var cc = new computecluster({
  module: './worker.js'
});

var toRun = 10

// then you can perform work in parallel
for (var i = 0; i < toRun; i++) {
  cc.enqueue({}, function(err, r) {
    if (err) console.log("an error occured:", err);
    else console.log("it's nice:", r);
    if (--toRun === 0) cc.exit();
  });
};
```

Next you write your `worker.js` program:

``` js
process.on('message', function(m) {
  for (var i = 0; i < 100000000; i++);
  process.send('complete');
});
```

All done!  Now you're distributing your computational load across multiple processes.

## API

### Constructor - `new require('compute-cluster')(<options>);`

Allocates a computation cluster.  Options include:

  * `module` - **required** the path to the module to load
  * `max_processes` - the maximum number of processes to spawn (default is `ciel(#cpus * 1.25)`)
  * `max_backlog` - the maximum length of the backlog, -1 indicates no limit (default is 10 * max_processes)
                    an error will be returned when max backlog is hit.
  * `max_request_time` - the maximum amount of time a request should take, in seconds.  An error will be returned when we expect a request will take longer.

Example:

``` js
var cc = new require('compute-cluster')({
  module: './foo.js',
  max_backlog: -1
});
```

### Event: 'error'

An error event will be emited in exceptional circumstances.  Like if a child crashes.
Catch error events like this:

``` js
cc.on('error', function(e) { console.log('OMG!', e); });
```

Default behavior is to exit on error if you don't catch.

### Events: 'debug' or 'info'

Events raise that hold an english, developer readable string describing
the state of the implementation.

### cc.enqueue(<args>, [cb])

enqueue a job to be run on the next available compute process, spawning one
if required (and `max_processes` isn't hit).

args will be passed into the process (available via `process.on('message', ...)`).

`cb` is optional, and will be invoked with two params, `err` and `response`.
`err` indicates hard errors, response indicates successful roundtrip to the
compute process and is whatever the decided to `process.send()` in response. 

### cc.exit([cb])

Kill all child processes, invoking callback (with err param) when complete.

## LICENSE

Copyright (c) 2011, Lloyd Hilaiel <lloyd@hilaiel.com>

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
