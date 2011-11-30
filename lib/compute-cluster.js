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

  events.EventEmitter.call(this);

  // an array of child processes
  this._kids = {};
  this._MAX_KIDS = (options.num || Math.ceil(require('os').cpus().length * 1.25));
  this._work_q = [];
  this._exiting = false;
  this._exit_cb;
  this._module = options.module;
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

    delete self._kids[pid];
    if (self._exit_cb) {
      if (Object.keys(self._kids).length === 0) {
        self._exit_cb(null);
        _exit_cb = undefined;
      }
    }
  }
}

ComputeCluster.prototype._getFreeWorker = function() {
  var self = this;

  for (var i in this._kids) {
    if (!this._kids[i].job) return this._kids[i];
  }

  // no workers!  can we spawn one?
  if (Object.keys(this._kids).length < this._MAX_KIDS) {
    var k = { worker: child_process.fork(this._module) };
    k.worker.on('exit', this._onWorkerExit(k.worker.pid));
    this._kids[k.worker.pid] = k;
    return k;
  }
};

ComputeCluster.prototype._runWorkOnWorker = function(work, worker) {
  var self = this;
  worker.worker.once('message', function(m) {
    if (worker.job.cb) worker.job.cb(null, m);
    delete worker.job;
    self._assignWork();
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
  this._work_q.push({ job: args, cb: cb });
  this._assignWork();
  return this;
};

ComputeCluster.prototype.exit = function(cb) {
  if (Object.keys(this._kids).length === 0) {
    setTimeout(function() { cb(null); }, 0);
  } else {
    this._exiting = true;
    this._exit_cb = cb;
    for (var i in this._kids) {
      this._kids[i].worker.kill();
    }
  }
  return this;
};

module.exports = ComputeCluster;

