const
path = require('path'),
child_process = require('child_process');

module.exports = function(options) {
  if (!options || typeof options.module !== 'string') {
    throw "missing required 'module' argument";
  }
  // is module a file?
  if (!path.existsSync(options.module)) {
    throw "module doesn't exist: " + options.module;
  }

  // an array of child processes
  var kids = [];
  const MAX_KIDS =
    (options.num || Math.ceil(require('os').cpus().length * 1.25));
  var work_q = [];

  function getFreeWorker() {
    for (var i = 0; i < kids.length; i ++) {
      if (!kids[i].job) return kids[i];
    }

    // no workers!  can we spawn one?
    if (kids.length < MAX_KIDS) {
      kids.push({ worker: child_process.fork(options.module) });
      return kids[kids.length - 1];
    }
  }

  function runWorkOnWorker(work, worker) {
    worker.worker.once('message', function(m) {
      worker.job.cb(m.error, m.success);
      delete worker.job;
      assignWork();
    });
    worker.worker.send(work.job);
    worker.job = work;
  }

  // assign as many work units from work_q as possible to avialable
  // compute processes
  function assignWork() {
    while (work_q.length > 0) {
      var worker = getFreeWorker();
      if (!worker) break;

      runWorkOnWorker(work_q.shift(), worker);
    }
  }

  return {
    doWork: function(args, cb) {
      work_q.push({ job: args, cb: cb });
      assignWork();
    },
    exit: function() {
      for (var i = 0; i < kids.length; i ++) {
        kids[i].worker.kill();
      }
    }
  }
};
