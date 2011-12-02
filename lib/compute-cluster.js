const
util = require('util'),
path = require('path'),
child_process = require('child_process'),
events = require('events');

function ComputeCluster(options) {
  if (!options || typeof options.module !== 'string') {
    throw "missing required 'module' argument";
  }
  // is module a file?
  if (!path.existsSync(options.module)) {
    throw "module doesn't exist: " + options.module;
  }
  if (options.max_processes &&
      (typeof options.max_processes !== 'number' || options.max_processes < 1)) {
    throw "when provided, max_processes must be an integer greater than one";
  }
  if (options.max_backlog && typeof options.max_backlog != 'number') {
    throw "when provided, max_backlog must be a number";
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
};

util.inherits(ComputeCluster, events.EventEmitter);

ComputeCluster.prototype._onWorkerExit = function(pid) {
  var self = this;
  return function (code) {
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
        { env: process.env }
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
    self.emit("debug", "process " + worker.worker.pid + " completed work in " +
              ((new Date() - startTime) / 1000.0).toFixed(2) + "s");
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
  // backlog size check
  if (this._MAX_BACKLOG > 0 && this._work_q.length >= this._MAX_BACKLOG) {
    this.emit('info', "maximum work backlog hit (" + this._MAX_BACKLOG +
              ")!  cannot enqueue additional work!");
    var mb = this._MAX_BACKLOG;
    setTimeout(function() {
      cb("cannot enqueue work: maximum backlog exceeded (" + mb + ")");
    }, 0);
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

