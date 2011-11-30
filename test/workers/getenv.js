process.on('message', function(m) {
  process.send({ key: m, value: process.env[m] });
});
