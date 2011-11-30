#!/usr/bin/env node

function doWork() {
  for (var i = 0; i < 100000000; i++);
}

var workDone = 0;

var starttime = new Date();
var lastoutput = starttime;

while (true) {
  doWork();
  workDone++;
  if (lastoutput.getTime() + (3 * 1000) < (new Date()).getTime())
  {
    lastoutput = new Date();
    console.log((workDone / ((lastoutput - starttime) / 1000.0)).toFixed(2),
                "units work performed per second");
  } 
}
