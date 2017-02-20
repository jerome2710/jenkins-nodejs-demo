// Import the Express module
var express = require('express');

// Create a new instance of Express
var app = express();

// Serve static html, js, css, and image files from the 'public' directory
app.use(express.static('public'));

// Import the fs
var fs = require('fs');

// Import the Lanquiz game file.
var lanquiz = require('./lanquiz');

// Creating database file if not exists
var file = 'playerstats.db';
var exists = fs.existsSync(file);

if (!exists) {
    fs.openSync(file, 'w');
}

var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(file);

db.serialize(function() {
    if (!exists) {
        db.run('CREATE TABLE player (player_name TEXT, player_win INT)');
    }
});

// Create a Node.js based http server on port 3000
var server = require('http').createServer(app).listen(process.env.PORT || 3000);

// Create a Socket.IO server and attach it to the http server
var io = require('socket.io').listen(server);

// Listen for Socket.IO Connections. Once connected, start the game logic.
io.sockets.on('connection', function (socket) {
    lanquiz.initGame(io, socket, db);
});

console.log('Listening on port ' + (process.env.PORT || 3000));