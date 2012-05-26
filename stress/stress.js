#!/usr/bin/env node

const
computecluster = require('../lib/compute-cluster'),
os = require('os'),
crypto = require('crypto');

// allocate a compute cluster
var cc = new computecluster({
  module: './worker.js',
  max_processes: os.cpus().length * 10 // 10x more procs than cpus
});

function addWork() {
  crypto.randomBytes(16, function(ex, buf) {
    if (ex) throw ex;
    var str = buf.toString('base64');
    cc.enqueue(str, function(err, r) {
      if (err) {
        process.stderr.write("to err is lame!  err: " + err + "\n");
        process.exit(9);
      }
      if (r !== str) {
        process.stderr.write("string not problerly echo'd.  LAME!\n");
        process.stderr.write("want/got: " + str + "/" + r + "\n");
        process.exit(9);
      }
      console.log(str);
      addWork();
    });
  });
}

// then you can perform work in parallel
for (var i = 0; i < os.cpus().length * 39; i++) addWork();
