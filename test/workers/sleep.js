process.on('message', function(m) {
  setTimeout(function() {
    process.send(m);
  }, m);
});
