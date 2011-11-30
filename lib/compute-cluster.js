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
  var kids = {};
  const MAX_KIDS =
    (options.num || Math.ceil(require('os').cpus().length * 1.25));
  var work_q = [];
  var exiting = false;
  var exit_cb;

  function onWorkerExit(pid) {
    return function (code) {
      delete kids[pid];

      if (exit_cb) {
        if (Object.keys(kids).length === 0) {
          exit_cb(null);
          exit_cb = undefined;
        }
      }
    }
  }

  function getFreeWorker() {
    for (var i in kids) {
      if (!kids[i].job) return kids[i];
    }

    // no workers!  can we spawn one?
    if (Object.keys(kids).length < MAX_KIDS) {
      var k = { worker: child_process.fork(options.module) };
      k.worker.on('exit', onWorkerExit(k.worker.pid));
      kids[k.worker.pid] = k;
      return k;
    }
  }

  function runWorkOnWorker(work, worker) {
    worker.worker.once('message', function(m) {
      console.log
      worker.job.cb(null, m);
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
    enqueue: function(args, cb) {
      work_q.push({ job: args, cb: cb });
      assignWork();
    },
    exit: function(cb) {
      if (Object.keys(kids).length === 0) {
        setTimeout(function() { cb(null); }, 0);
      } else {
        exit_cb = cb;
        for (var i in kids) {
          kids[i].worker.kill();
        }
      }
    }
  }
};
