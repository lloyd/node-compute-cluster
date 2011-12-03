#!/usr/bin/env node

const
computecluster = require('../lib/compute-cluster'),
os = require('os');

// allocate a compute cluster
var cc = new computecluster({
  module: './worker.js',
  max_processes: os.cpus().length * 10 // 10x more procs than cpus
});

function addWork() {
  cc.enqueue("echome", function(err, r) {
    if (err) {
      process.stderr.write("to err is lame!  err: " + err + "\n");
      process.exit(9);
    }
    if (r != "echome") {
      process.stderr.write("string not problerly echo'd.  LAME!\n");
      process.exit(9);
    }
    addWork();
  });
}

// then you can perform work in parallel
for (var i = 0; i < os.cpus().length * 39; i++) addWork();
