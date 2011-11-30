const os = require('os');

var computeCluster = require('../lib/compute-cluster.js')({
  module: "./after_worker.js"
});

var workDone = 0;

var starttime = new Date();
var lastoutput = starttime;

var outstanding = 0;

function addWork() {
  while (outstanding < os.cpus().length * 2) {
    outstanding++;
    computeCluster.doWork({}, function(err, r) {
      outstanding--;
      workDone++;

      if (lastoutput.getTime() + (3 * 1000) < (new Date()).getTime())
      {
        lastoutput = new Date();
        console.log((workDone / ((lastoutput - starttime) / 1000.0)).toFixed(2),
                    "units work performed per second");
      } 
      
      addWork();
    });
  }
}

addWork();
