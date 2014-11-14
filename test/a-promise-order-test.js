#!/usr/bin/env node

const
vows = require('vows'),
assert = require('assert'),
computeCluster = require('../lib/compute-cluster'),
path = require('path'),
events = require('events');

var suite = vows.describe('basic tests');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

suite.addBatch({
  "allocation of a compute cluster": {
    topic: function() {
      return new computeCluster({
        module: path.join(__dirname, 'workers', 'echo.js'),
        promise: true
      });
    },
    "runs without issue": function (cc) {
      assert.isObject(cc);
    },
    "schedule many works, and check order": {
      topic: function(cc) {
        // cb = this.callback;
        var index = 0;
        var total = 4;
        var self = this;
        for (var i = 0; i < total; i++) {
          cc.enqueue(i, function (err, r) {
            assert.equal(r, index);
            index++;
            //console.log(index);
            if (index === total) {
              //cb({ err: err, cc: cc});
              self.callback({ err: err, cc: cc})
            }
          });
        }
      },
      "succeeds": function (r) {
        assert.isNull(r.err);
      },
      "finally, exit": {
        topic: function(r) {
          r.cc.exit(this.callback);
          this.callback(null);
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
