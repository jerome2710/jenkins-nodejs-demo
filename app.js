// http
var http = require('http');
var server = http.createServer();
var port = parseInt(process.env.SERVER_PORT || '30043', 10) || 30043;
var host = process.env.SERVER_HOST || 'localhost';
server.listen(port, host, function () {
    var host = server.address();
    console.log('Listening on %s:%s', host.address, host.port);
});
