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
        module: path.join(__dirname, 'workers', 'getenv.js')
      });
    },
    "runs without issue": function (cc) {
      assert.isObject(cc);
    },
    "and invocation against this cluster": {
      topic: function(cc) {
        process.env['FOO'] = 'bar';
        var cb = this.callback;
        cc.enqueue("FOO", function(e, r) {
          cb.call(self, { cc: cc, r: r });
        });
      },
      "succeeds": function (r) {
        assert.equal(r.r.key, 'FOO');
        assert.equal(r.r.value, 'bar');
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
