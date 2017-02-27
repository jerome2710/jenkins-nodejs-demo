var should = require('should');
var io = require('socket.io/node_modules/socket.io-client');

var host = io.connect('http://localhost:3000');
var gameId = 0;
var playerName = 'Jan Janssen';

describe('Lanquiz Multiplayer Language Game', function() {

    // First test - when connected to the socket, register as a host and validate callback
    it('Should start a game host and return game-ID', function(done) {

        host.on('connect', function() {

            // pretend to be a host creating a game
            host.emit('hostCreateNewGame');

            // when the server created a new game
            host.on('newGameCreated', function(data) {
                // the game id should be a number
                data.gameId.should.be.type('number');
                gameId = data.gameId;
                done();
            });
        });
    });

    // Second test - connect to the registered host and validate the callback
    it('Should join the game host', function(done) {

        host.emit('playerJoinGame', {
            gameId: gameId,
            playerName: playerName
        });

        host.on('playerJoinedRoom', function(data) {
            data.gameId.should.equal(gameId);
            data.playerName.should.equal(playerName);
            done();
        });
    });
});