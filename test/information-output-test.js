#!/usr/bin/env node

const
vows = require('vows'),
assert = require('assert'),
computeCluster = require('../lib/compute-cluster'),
path = require('path');

var suite = vows.describe('basic tests');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

var messages = [
];

suite.addBatch({
  "allocation of a compute cluster": {
    topic: function() {
      return new computeCluster({
        module: path.join(__dirname, 'workers', 'echo.js')
      }).on('info', function(m) {
        messages.push({ type: 'info', msg: m });
      }).on('debug', function(m) {
        messages.push({ type: 'debug', msg: m });
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
      "finally, exit": {
        topic: function(r) {
          r.cc.exit(this.callback);
        },
        "also succeeds": function(err) {
          assert.isNull(err);
        },
        "and once complete": {
          topic: messages,
          "we have expected informational messages": function (m) {
            // verify that we've got some messages
            assert.isTrue(m.length > 0);
            // verify we've got some info and some debug msgs
            var numInfo = 0, numDebug = 0, numUnknown = 0;
            m.forEach(function(m) {
              if (m.type === 'info') numInfo++;
              else if (m.type === 'debug') numDebug++;
              else numUnknown++;
            });
            assert.isTrue(numInfo > 0);
            assert.isTrue(numDebug > 0);
            assert.strictEqual(numUnknown, 0);
          }
        }
      }
    }
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
