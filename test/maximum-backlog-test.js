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
        module: path.join(__dirname, 'workers', 'echo.js'),
        max_processes: 1,
        max_backlog: 2
      });
    },
    "runs without issue": function (cc) {
      assert.isObject(cc);
    },
    "enqueing too much work": {
      topic: function(cc) {
        var cb = this.callback;
        for (var i = 0; i < 4; i++) {
          cc.enqueue(i, function (err, r) {
            if (err) cb({ err: err, cc: cc });
          });
        }
      },
      "succeeds": function (r) {
        assert.equal(r.err, 'cannot enqueue work: maximum backlog exceeded (2)');
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
