process.on('message', function(args) {
  // do work
  for (var i = 0; i < 100000000; i++);
  process.send('complete');
});
