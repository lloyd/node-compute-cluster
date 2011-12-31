#!/usr/bin/env node

const
vows = require('vows'),
assert = require('assert'),
computeCluster = require('../lib/compute-cluster'),
path = require('path');

var suite = vows.describe('basic tests');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

suite.addBatch({
  "allocation of a compute cluster": {
    topic: function() {
      return new computeCluster({
        module: path.join(__dirname, 'workers', 'sleep.js'),
        max_processes: 2,
        max_backlog: -1, // no maximum backlog
        max_request_time: 0.5 // 500ms maximum allowed time
      });
    },
    "runs without issue": function (cc) {
      assert.isObject(cc);
    },
    "enqueing too much work": {
      topic: function(cc) {
        // run a bunch of 50ms sleeps
        var cb = this.callback;
        for (var i = 0; i < 50; i++) {
          cc.enqueue(50, function (err, r) {
            if (err) cb({ err: err, cc: cc });
            cc.enqueue(50, function (err, r) {
              if (err) cb({ err: err, cc: cc });
            });
          });
        }
      },
      "fails": function (r) {
        assert.ok(/cannot enqueue work: maximum expected work duration exceeded \(\d.\d+s\)/.test(r.err));
      },
      "finally, exit": {
        topic: function(r) {
          r.cc.exit(this.callback);
        },
        "also succeeds": function(err) {
          assert.isNull(err);
        }
      }
    }
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
