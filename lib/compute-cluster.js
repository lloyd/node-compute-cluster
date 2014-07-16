const
util = require('util'),
existsSync = require('fs').existsSync || require('path').existsSync,
child_process = require('child_process'),
events = require('events');

// decaying factor for heurstics calculating how much work costs.
const MAX_HISTORY = 100;

function ComputeCluster(options) {
  if (!options || typeof options.module !== 'string') {
    throw "missing required 'module' argument";
  }
  // is module a file?
  if (!existsSync(options.module)) {
    throw "module doesn't exist: " + options.module;
  }
  if (options.max_processes &&
      (typeof options.max_processes !== 'number' || options.max_processes < 1)) {
    throw "when provided, max_processes must be an integer greater than one";
  }
  if (options.max_backlog && typeof options.max_backlog != 'number') {
    throw "when provided, max_backlog must be a number";
  }
  if (options.max_request_time && typeof options.max_request_time != 'number') {
    throw "when provided, max_request_time must be a number";
  }

  events.EventEmitter.call(this);

  // an array of child processes
  this._kids = {};
  this._MAX_KIDS = (options.max_processes || Math.ceil(require('os').cpus().length * 1.25));
  this._work_q = [];
  this._exiting = false;
  this._exit_cb;
  this._module = options.module;
  // how long shall we allow our queue to get before we stop accepting work?
  // (negative implies no limit.  careful, there.)
  this._MAX_BACKLOG = options.max_backlog || this._MAX_KIDS * 10;
  this._MAX_REQUEST_TIME = options.max_request_time || 0;
  this._work_duration = 0;
  this._jobs_run = 0;
};

util.inherits(ComputeCluster, events.EventEmitter);

ComputeCluster.prototype._onWorkerExit = function(pid) {
  var self = this;
  return function (code) {
    // inform the callback the process quit
    var worker = self._kids[pid];
    if (worker && worker.job && worker.job.cb) {
      worker.job.cb("compute process (" + pid + ") dies with code: " + code);
    }
    // if _exiting is false, we don't expect to be shutting down!
    if (!self._exiting) {
      self.emit('error',
                "compute process (" + pid + ") dies with code: " + code);
    }

    self.emit('info', "compute process (" + pid + ") exits with code " + code);

    delete self._kids[pid];
    if (self._exit_cb) {
      if (Object.keys(self._kids).length === 0) {
        self._exit_cb(null);
        _exit_cb = undefined;
      }
    }
  }
};

ComputeCluster.prototype._getEnvForWorker = function() {
  var env = {};
  for (var i in process.env) {
    env[i] = process.env[i];
  }

  delete env.NODE_WORKER_ID; //Node.js cluster worker marker for v0.6
  delete env.NODE_UNIQUE_ID; //Node.js cluster worker marker for v0.7

  return env;
};

ComputeCluster.prototype._getFreeWorker = function() {
  var self = this;

  for (var i in this._kids) {
    if (!this._kids[i].job) return this._kids[i];
  }

  // no workers!  can we spawn one?
  if (Object.keys(this._kids).length < this._MAX_KIDS) {
    var k = {
      worker: child_process.fork(
        this._module,
        [],
        { env: this._getEnvForWorker() }
      ) };
    k.worker.on('exit', this._onWorkerExit(k.worker.pid));
    this._kids[k.worker.pid] = k;

    this.emit('info', "spawned new worker process (" +  k.worker.pid + ") " +
              Object.keys(this._kids).length + "/" + this._MAX_KIDS + " processes running");

    return k;
  }
};

ComputeCluster.prototype._runWorkOnWorker = function(work, worker) {
  var self = this;
  this.emit("debug", "passing compute job to process " + worker.worker.pid);
  var startTime = new Date();
  worker.worker.once('message', function(m) {
    // clear the in-progress job
    var cb = worker.job.cb;
    delete worker.job;

    // start the next
    self._assignWork();

    // call our client's callback
    if (cb) cb(null, m);
    // emit some debug info
    var timeMS = (new Date() - startTime);
    self.emit("debug", "process " + worker.worker.pid + " completed work in " +
              (timeMS / 1000.0).toFixed(2) + "s");

    // if there is a maximum request time, perform some math to estimate how
    // long requests take, favoring history to current job in proportion:
    // MAX_HISTORY:1
    if (self._MAX_REQUEST_TIME && self._jobs_run >= (2 * self._MAX_KIDS)) {
      var history = (self._jobs_run > MAX_HISTORY) ? MAX_HISTORY : self._jobs_run;
      self._work_duration = ((self._work_duration * history) + timeMS) / (history + 1);
    }

    self._jobs_run++;
  });
  worker.worker.send(work.job);
  worker.job = work;
};

  // assign as many work units from work_q as possible to avialable
  // compute processes
ComputeCluster.prototype._assignWork = function() {
  while (this._work_q.length > 0) {
    var worker = this._getFreeWorker();
    if (!worker) break;

    this._runWorkOnWorker(this._work_q.shift(), worker);
  }
};

ComputeCluster.prototype.enqueue = function(args, cb) {
  // maximum allowed request time check
  if (this._MAX_REQUEST_TIME && this._jobs_run > (2 * this._MAX_KIDS)) {
    var numWorkers = Object.keys(this._kids).length * 1.0;
    if (numWorkers) {
      // how long would this work take?
      var expected = ((this._work_q.length / numWorkers) * this._work_duration + this._work_duration) / 1000.0;
      if (expected > this._MAX_REQUEST_TIME) {
        this.emit('info', "maximum expected work duration hit hit (work would take about " + expected +
                  "s, which is greater than "+ this._MAX_REQUEST_TIME +")!  cannot enqueue!");
        process.nextTick(function() {
          cb("cannot enqueue work: maximum expected work duration exceeded (" + expected + "s)");
        });
        return this;
      }
    }
  }

  // backlog size check
  if (this._MAX_BACKLOG > 0 && this._work_q.length >= this._MAX_BACKLOG) {
    this.emit('info', "maximum work backlog hit (" + this._MAX_BACKLOG +
              ")!  cannot enqueue additional work!");
    var mb = this._MAX_BACKLOG;
    process.nextTick(function() {
      cb("cannot enqueue work: maximum backlog exceeded (" + mb + ")");
    });
    return this;
  }

  this._work_q.push({ job: args, cb: cb });
  this._assignWork();
  return this;
};

ComputeCluster.prototype.exit = function(cb) {
  if (Object.keys(this._kids).length === 0) {
    if (cb) setTimeout(function() { cb(null); }, 0);
  } else {
    this._exiting = true;
    this._exit_cb = cb;
    this.emit('info', "exit called, shutting down " + Object.keys(this._kids).length +
              " child processes");
    for (var i in this._kids) {
      this._kids[i].worker.kill();
    }
  }
  return this;
};

module.exports = ComputeCluster;
