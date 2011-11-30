process.on('message', function(m) {
  for (var i = 0; i < 100000000; i++);
  process.send('complete');
});
