// Import the Express module
var express = require('express');

// Create a new instance of Express
var app = express();

// Serve static html, js, css, and image files from the 'public' directory
app.use(express.static('public'));

// Import the Lanquiz game file.
var lanquiz = require('./lanquiz');

// Setup database connection
var mysql       = require('mysql');
var connection  = mysql.createConnection({
    host        : 'localhost',
    user        : 'lanquiz',
    password    : '5Gsv77dnCm',
    database    : 'lanquiz'
});

// Connect and create table if not exists
connection.connect(function(err){
    if (!err) {
        connection.query('CREATE TABLE IF NOT EXISTS playerstats (player_name TEXT, score INT)');
    } else {
        console.log('Error connecting database with message ' + err.message);
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