#!/usr/bin/env node

const
os = require('os'),
path = require('path'),
ComputeCluster = require('../lib/compute-cluster.js');

// allocate a compute cluster
var computeCluster = new ComputeCluster({
  module: path.join(__dirname, "after_worker.js")
});

// if you don't handle errors, they will take down the process
computeCluster.on('error', function(e) {
  process.stderr.write('unexpected error from compute cluster: ' + e + "\n");
  process.exit(1);
});

var workDone = 0;
var starttime = new Date();
var lastoutput = starttime;

var outstanding = 0;
const MAX_OUTSTANDING = os.cpus().length * 2;

function addWork() {
  while (outstanding < MAX_OUTSTANDING) {
    outstanding++;
    computeCluster.enqueue({}, function(err, r) {
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
