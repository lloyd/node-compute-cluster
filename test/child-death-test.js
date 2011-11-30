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
        module: path.join(__dirname, 'workers', 'echo.js')
      });
    },
    "runs without issue": function (cc) {
      assert.isObject(cc);
    },
    "and invocation against this cluster": {
      topic: function(cc) {
        var cb = this.callback;
        cc.enqueue("hello", function(e, r) {
          cb.call(self, { cc: cc, r: r });
        });

      },
      "succeeds": function (r) {
        assert.equal(r.r, 'hello');
      },
      "and killing a child": {
        topic: function(r) {
          var cb = this.callback;
          r.cc.on('error', function(e) {
            cb(e);
          });
          process.kill(Object.keys(r.cc._kids)[0]);
        },
        "causes an error event": function(err) {
          assert.isString(err);
          assert.match(err, /^compute process \(\d+\) dies with code: 1$/);
        }
      }
    }
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
