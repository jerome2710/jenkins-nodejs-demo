jQuery(function ($) {
    'use strict';

    /**
     * All the code relevant to Socket.IO is collected in the IO namespace.
     *
     * @type {{init: Function, bindEvents: Function, onConnected: Function, onNewGameCreated: Function, playerJoinedRoom: Function, beginNewGame: Function, onNewWordData: Function, newQuestionData: Function, hostCheckAnswer: Function, gameOver: Function, error: Function}}
     */
    var IO = {

        /**
         * This is called when the page is displayed. It connects the Socket.IO client
         * to the Socket.IO server
         */
        init: function () {
            IO.socket = io.connect();
            IO.bindEvents();
        },

        /**
         * While connected, Socket.IO will listen to the following events emitted
         * by the Socket.IO server, then run the appropriate function.
         */
        bindEvents: function () {
            IO.socket.on('connected', IO.onConnected);
            IO.socket.on('newGameCreated', IO.onNewGameCreated);
            IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom);
            IO.socket.on('beginNewGame', IO.beginNewGame);
            IO.socket.on('newWordData', IO.onNewWordData);
            IO.socket.on('newQuestionData', IO.onNewQuestionData);
            IO.socket.on('hostCheckAnswer', IO.hostCheckAnswer);
            IO.socket.on('gameOver', IO.gameOver);
            IO.socket.on('gameError', IO.error);
            IO.socket.on('showLeader', IO.showLeader);
        },

        /**
         * The client is successfully connected!
         */
        onConnected: function () {
            // Cache a copy of the client's socket.IO session ID on the App
            App.mySocketId = IO.socket.id;
        },

        //function for showing leader
        showLeader: function (data) {
            App.$gameArea.html(App.$leaderGame);
            var table = '<div id="tablearea"><table id="leadertable"><tr><th>Player Name</th><th>Total Win</th></tr>';
            var i = Object.keys(data).length;
            for (var j = 0; j < i; j++) {
                table += '<tr><td>' + data[j].name + '</td><td>' + data[j].win + '</td></tr>';
            }
            table += '</table></div>';
            table += "<div id='mid'><button id='back' class='btn'>BACK</button></div>";
            App.$gameArea.append(table);
        },

        /**
         * A new game has been created and a random game ID has been generated.
         * @param data {{ gameId: int, mySocketId: * }}
         */
        onNewGameCreated: function (data) {
            App.Host.gameInit(data);
        },

        /**
         * A player has successfully joined the game.
         * @param data {{playerName: string, gameId: int, mySocketId: int}}
         */
        playerJoinedRoom: function (data) {
            // When a player joins a room, do the updateWaitingScreen function.
            // There are two versions of this function: one for the 'host' and
            // another for the 'player'.
            //
            // So on the 'host' browser window, the App.Host.updateWiatingScreen function is called.
            // And on the player's browser, App.Player.updateWaitingScreen is called.
            App[App.myRole].updateWaitingScreen(data);
        },

        /**
         * Both players have joined the game.
         * @param data
         */
        beginNewGame: function (data) {
            App[App.myRole].gameCountdown(data);
        },

        /**
         * A new set of words for the round is returned from the server.
         * @param data
         */
        onNewWordData: function (data) {
            // Update the current round
            App.currentRound = data.round;

            // Change the word for the Host and Player
            App[App.myRole].newWord(data);
        },

        onNewQuestionData: function (data) {
            // Update the current round
            App.currentRound = data.round;

            // Change the word for the Host and Player
            App[App.myRole].newQuestion(data);
        },

        /**
         * A player answered. If this is the host, check the answer.
         * @param data
         */
        hostCheckAnswer: function (data) {
            if (App.myRole === 'Host') {
                App.Host.checkAnswer(data);
            }
        },

        /**
         * Let everyone know the game has ended.
         * @param data
         */
        gameOver: function (data) {
            App[App.myRole].endGame(data);
        },

        /**
         * An error has occurred.
         * @param data
         */
        error: function (data) {
            alert(data.message);
        }

    };

    var App = {

        /**
         * Keep track of the gameId, which is identical to the ID
         * of the Socket.IO Room used for the players and host to communicate
         *
         */
        gameId: 0,

        /**
         * Keep track of the chosen level, currently only 1 or 2
         */
        levelId: 1,

        /**
         * This is used to differentiate between 'Host' and 'Player' browsers.
         */
        myRole: '',   // 'Player' or 'Host'

        /**
         * The Socket.IO socket object identifier. This is unique for
         * each player and host. It is generated when the browser initially
         * connects to the server when the page loads for the first time.
         */
        mySocketId: '',

        /**
         * Identifies the current round. Starts at 0 because it corresponds
         * to the array of word data stored on the server.
         */
        currentRound: 0,

        /* *************************************
         *                Setup                *
         * *********************************** */

        /**
         * This runs when the page initially loads.
         */
        init: function () {
            App.cacheElements();
            App.showInitScreen();
            App.bindEvents();

            // Initialize the fastclick library
            FastClick.attach(document.body);
        },

        /**
         * Create references to on-screen elements used throughout the game.
         */
        cacheElements: function () {
            App.$doc = $(document);

            // Templates
            App.$gameArea = $('#gameArea');
            App.$templateIntroScreen = $('#intro-screen-template').html();
            App.$templateNewGame = $('#create-game-template').html();
            App.$templateJoinGame = $('#join-game-template').html();
            App.$hostGame = $('#host-game-template').html();
            App.$leaderGame = $('#leaderboard-template').html();
        },

        /**
         * Create some click handlers for the various buttons that appear on-screen.
         */
        bindEvents: function () {
            // Host
            App.$doc.on('click', '#btnCreateGameLevelOne', {level: 1}, App.Host.onCreateClick);
            App.$doc.on('click', '#btnCreateGameLevelTwo', {level: 2}, App.Host.onCreateClick);

            // Player
            App.$doc.on('click', '#btnJoinGame', App.Player.onJoinClick);
            App.$doc.on('click', '#btnStart', App.Player.onPlayerStartClick);
            App.$doc.on('click', '.btnAnswer', App.Player.onPlayerAnswerClick);
            App.$doc.on('click', '#btnPlayerRestart', App.Player.onPlayerRestart); // @TODO restart
            App.$doc.on('click', '#leaderboard', App.onLeaderboardClick);
            App.$doc.on('click', '#back', App.onBackClick);
        },

        /* *************************************
         *             Game Logic              *
         * *********************************** */

        /**
         * Show the initial Anagrammatix Title Screen
         * (with Start and Join buttons)
         */
        showInitScreen: function () {
            App.$gameArea.html(App.$templateIntroScreen);
        },

        onLeaderboardClick: function () {
            IO.socket.emit('findLeader');
        },

        onBackClick: function () {
            App.$gameArea.html(App.$templateIntroScreen);
        },


        /* *******************************
         *         HOST CODE           *
         ******************************* */
        Host: {

            /**
             * Contains references to player data
             */
            players: [],

            /**
             * Flag to indicate if a new game is starting.
             * This is used after the first game ends, and players initiate a new game
             * without refreshing the browser windows.
             */
            isNewGame: false,

            /**
             * Keep track of the number of players that have joined the game.
             */
            numPlayersInRoom: 0,

            /**
             * A reference to the correct answer for the current round.
             */
            currentCorrectAnswer: '',

            /**
             * Handler for the "Start" button on the Title Screen.
             * @param event Object
             */
            onCreateClick: function (event) {
                IO.socket.emit('hostCreateNewGame', {level: event.data.level});
            },

            /**
             * The Host screen is displayed for the first time.
             * @param data{{ gameId: int, mySocketId: *, levelId: int}}
             */
            gameInit: function (data) {
                App.gameId = data.gameId;
                App.levelId = data.levelId;
                App.mySocketId = data.mySocketId;
                App.myRole = 'Host';
                App.Host.numPlayersInRoom = 0;

                App.Host.displayNewGameScreen();
            },

            /**
             * Show the Host screen containing the game URL and unique game ID
             */
            displayNewGameScreen: function () {
                // Fill the game screen with the appropriate HTML
                App.$gameArea.html(App.$templateNewGame);

                // Display level on screen
                $('#gameLevel').text(App.levelId);

                // Display the URL on screen
                $('#gameURL').text(window.location.href);

                // Show the gameId / room id on screen
                $('#spanNewGameCode').text(App.gameId);
            },

            /**
             * Update the Host screen when the first player joins
             * @param data{{playerName: string}}
             */
            updateWaitingScreen: function (data) {
                // If this is a restarted game, show the screen.
                if (App.Host.isNewGame) {
                    App.Host.displayNewGameScreen();
                }
                // Update host screen
                $('#playersWaiting')
                    .append('<p/>')
                    .text('Player ' + data.playerName + ' joined the game.');

                // Store the new player's data on the Host.
                App.Host.players.push(data);

                // Increment the number of players in the room
                App.Host.numPlayersInRoom += 1;

                // If two players have joined, start the game!
                if (App.Host.numPlayersInRoom === 2) {
                    // Let the server know that two players are present.
                    IO.socket.emit('hostRoomFull', App.gameId, App.levelId);
                }
            },

            /**
             * Show the countdown screen
             */
            gameCountdown: function () {

                // Prepare the game screen with new HTML
                App.$gameArea.html(App.$hostGame);

                // Begin the on-screen countdown timer
                var $secondsLeft = $('#hostWord');
                App.countDown($secondsLeft, 5, function () {
                    IO.socket.emit('hostCountdownFinished', App.gameId, App.levelId);
                });

                // Display the players' names on screen
                $('#player1Score')
                    .find('.playerName')
                    .html(App.Host.players[0].playerName);

                $('#player2Score')
                    .find('.playerName')
                    .html(App.Host.players[1].playerName);

                // Set the Score section on screen to 0 for each player.
                $('#player1Score').find('.score').attr('id', App.Host.players[0].mySocketId);
                $('#player2Score').find('.score').attr('id', App.Host.players[1].mySocketId);
            },

            /**
             * Show the word for the current round on screen.
             * @param data{{round: *, word: *, answer: *, list: Array}}
             */
            newWord: function (data) {
                // Insert the new word into the DOM
                $('#hostWord').text(data.word);

                // Update the data for the current round
                App.Host.currentCorrectAnswer = data.answer;
                App.Host.currentRound = data.round;
            },

            newQuestion: function (data) {
                // Insert the new word into the DOM
                $('#hostWord').text(data.question);

                // Update the data for the current round
                App.Host.currentCorrectAnswer = data.answer;
                App.Host.currentRound = data.round;
            },

            /**
             * Check the answer clicked by a player.
             * @param data{{round: *, playerId: *, answer: *, gameId: *}}
             */
            checkAnswer: function (data) {
                // Verify that the answer clicked is from the current round.
                // This prevents a 'late entry' from a player whos screen has not
                // yet updated to the current round.

                if (data.round === App.currentRound) {

                    // Get the player's score
                    var $pScore = $('#' + data.playerId);

                    // Advance player's score if it is correct
                    if (App.Host.currentCorrectAnswer === data.answer) {
                        // Add 5 to the player's score
                        $pScore.text(+$pScore.text() + 5);

                        // Advance the round
                        App.currentRound += 1;

                        // Prepare data to send to the server
                        var nextRound = {
                            gameId: App.gameId,
                            levelId: App.levelId,
                            round: App.currentRound
                        };

                        // Notify the server to start the next round.
                        IO.socket.emit('hostNextRound', nextRound);

                    } else {
                        // A wrong answer was submitted, so decrement the player's score.
                        $pScore.text(+$pScore.text() - 3);
                    }
                }
            },


            /**
             * All 10 rounds have played out. End the game.
             * @param data
             */
            endGame: function (data) {
                // Get the data for player 1 from the host screen
                var $p1 = $('#player1Score');
                var p1Score = +$p1.find('.score').text();
                var p1Name = $p1.find('.playerName').text();

                // Get the data for player 2 from the host screen
                var $p2 = $('#player2Score');
                var p2Score = +$p2.find('.score').text();
                var p2Name = $p2.find('.playerName').text();

                // Find the winner based on the scores
                var winner = (p1Score < p2Score) ? p2Name : p1Name;
                var tie = (p1Score === p2Score);

                // Display the winner (or tie game message)
                if (tie) {
                    $('#hostWord').text("It's a tie!");
                } else {
                    $('#hostWord').text(winner + ' wins this game!');
                }

                data.winner = winner;
                data.done = false;

                // Reset game data
                App.Host.numPlayersInRoom = 0;
                App.Host.isNewGame = true;
                IO.socket.emit('hostNextRound', data);
            }
        },


        /* *****************************
         *        PLAYER CODE        *
         ***************************** */

        Player: {

            /**
             * A reference to the socket ID of the Host
             */
            hostSocketId: '',

            /**
             * The player's name entered on the 'Join' screen.
             */
            myName: '',

            /**
             * Click handler for the 'JOIN' button
             */
            onJoinClick: function () {
                // Display the Join Game HTML on the player's screen.
                App.$gameArea.html(App.$templateJoinGame);
            },

            /**
             * The player entered their name and gameId (hopefully)
             * and clicked Start.
             */
            onPlayerStartClick: function () {
                // collect data to send to the server
                var data = {
                    gameId: +($('#inputGameId').val()),
                    playerName: $('#inputPlayerName').val() || 'anon'
                };

                // Send the gameId and playerName to the server
                IO.socket.emit('playerJoinGame', data);

                // Set the appropriate properties for the current player.
                App.myRole = 'Player';
                App.Player.myName = data.playerName;
            },

            /**
             *  Click handler for the Player hitting a word in the word list.
             */
            onPlayerAnswerClick: function () {
                var $btn = $(this);      // the tapped button
                var answer = $btn.val(); // The tapped word

                // Send the player info and tapped word to the server so
                // the host can check the answer.
                var data = {
                    gameId: App.gameId,
                    playerId: App.mySocketId,
                    answer: answer,
                    round: App.currentRound
                };
                IO.socket.emit('playerAnswer', data);
            },

            /**
             *  Just reload the thing if you want to play again.
             */
            onPlayerRestart: function () {
                location.reload();
            },

            /**
             * Display the waiting screen for player 1
             * @param data
             */
            updateWaitingScreen: function (data) {
                if (IO.socket.id === data.mySocketId) {
                    App.myRole = 'Player';
                    App.gameId = data.gameId;

                    $('#playerWaitingMessage')
                        .append('<p/>')
                        .text('Joined Game ' + data.gameId + '. Please wait for game to begin.');
                }
            },

            /**
             * Display 'Get Ready' while the countdown timer ticks down.
             * @param hostData
             */
            gameCountdown: function (hostData) {
                App.Player.hostSocketId = hostData.mySocketId;
                $('#gameArea')
                    .html('<div class="gameOver">Get Ready!</div>');
            },

            /**
             * Show the list of words for the current round.
             * @param data{{round: *, word: *, answer: *, list: Array}}
             */
            newWord: function (data) {
                // Create an unordered list element
                var $list = $('<ul/>').attr('id', 'ulAnswers');

                // Insert a list item for each word in the word list
                // received from the server.
                $.each(data.list, function () {
                    $list                                //  <ul> </ul>
                        .append($('<li/>')              //  <ul> <li> </li> </ul>
                            .append($('<button/>')      //  <ul> <li> <button> </button> </li> </ul>
                                .addClass('btnAnswer')   //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                                .addClass('btn')         //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                                .val(this)               //  <ul> <li> <button class='btnAnswer' value='word'> </button> </li> </ul>
                                .html(this)              //  <ul> <li> <button class='btnAnswer' value='word'>word</button> </li> </ul>
                            )
                        );
                });

                // Insert the list onto the screen.
                $('#gameArea').html($list);
            },

            newQuestion: function (data) {
                // Create an unordered list element
                var $list = $('<ul/>').attr('id', 'ulAnswers');

                // Insert a list item for each word in the word list
                // received from the server.
                $.each(data.list, function () {
                    $list                                //  <ul> </ul>
                        .append($('<li/>')              //  <ul> <li> </li> </ul>
                            .append($('<button/>')      //  <ul> <li> <button> </button> </li> </ul>
                                .addClass('btnAnswer')   //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                                .addClass('btn')         //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                                .val(this)               //  <ul> <li> <button class='btnAnswer' value='word'> </button> </li> </ul>
                                .html(this)              //  <ul> <li> <button class='btnAnswer' value='word'>word</button> </li> </ul>
                            )
                        )
                });

                // Insert the list onto the screen.
                $('#gameArea').html($list);
            },

            /**
             * Show the "Game Over" screen.
             */
            endGame: function () {
                $('#gameArea')
                    .html('<div class="gameOver">Game Over!</div>')
                    .append(
                        // Create a button to start a new game.
                        $('<button>Start Again</button>')
                            .attr('id', 'btnPlayerRestart')
                            .addClass('btn')
                            .addClass('btnGameOver')
                    );
            }
        },


        /* **************************
         UTILITY CODE
         ************************** */

        /**
         * Display the countdown timer on the Host screen
         *
         * @param $el The container element for the countdown timer
         * @param startTime
         * @param callback The function to call when the timer ends.
         */
        countDown: function ($el, startTime, callback) {

            // Display the starting time on the screen.
            $el.text(startTime);

            // Start a 1 second timer
            var timer = setInterval(countItDown, 1000);

            // Decrement the displayed timer value on each 'tick'
            function countItDown() {
                startTime -= 1;
                $el.text(startTime);

                if (startTime <= 0) {
                    // Stop the timer and do the callback.
                    clearInterval(timer);
                    callback();
                    return;
                }
            }

        }
    };

    IO.init();
    App.init();

}($));