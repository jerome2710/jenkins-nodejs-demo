/**
 * @section : App logic
 * @project : Lanquiz
 * @author  : Jerome Anker <0864155@hr.nl> & Daan Grootenboer <0865052@hr.nl>
 */

var io;
var gameSocket;
var db;

/**
 * This function is called by index.js to initialize a new game instance.
 *
 * @param sio The Socket.IO library
 * @param socket The socket object for the connected client.
 * @param sdb
 */
exports.initGame = function (sio, socket, sdb) {
    io = sio;
    gameSocket = socket;
    db = sdb;
    gameSocket.emit('connected', {message: "You are connected!"});

    //common event
    gameSocket.on('findLeader', findLeader);

    // Host Events
    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostRoomFull', hostPrepareGame);
    gameSocket.on('hostCountdownFinished', hostStartGame);
    gameSocket.on('hostNextRound', hostNextRound);

    // Player Events
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('playerAnswer', playerAnswer);
};

/* *******************************
 *                             *
 *       HOST FUNCTIONS        *
 *                             *
 ******************************* */

/**
 * The 'START' button was clicked and 'hostCreateNewGame' event occurred.
 */
function hostCreateNewGame(data) {

    // Create a unique Socket.IO Room
    var thisGameId = ( Math.random() * 100000 ) | 0;

    // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
    this.emit('newGameCreated', {gameId: thisGameId, levelId: data.level, mySocketId: this.id});

    // Join the Room and wait for the players
    this.join(thisGameId.toString());
}

/**
 * Two players have joined. Alert the host!
 * @param gameId The game ID / room ID
 */
function hostPrepareGame(gameId, levelId) {
    var sock = this;
    var data = {
        mySocketId: sock.id,
        gameId: gameId,
        levelId: levelId
    };

    io.sockets.in(data.gameId).emit('beginNewGame', data);
}

/**
 * The Countdown has finished, and the game begins!
 * @param gameId The game ID / room ID
 * @param levelId The game level ID
 */
function hostStartGame(gameId, levelId) {
    if (levelId === 1) {
        sendWord(0, gameId);
    } else {
        sendQuestion(0, gameId);
    }
}

/**
 * A player answered correctly. Time for the next word.
 * @param data Sent from the client. Contains the current round and gameId (room)
 */
function hostNextRound(data) {

    // Determine pool based on the level
    var pool = null;
    if (data.levelId === 1) {
        pool = wordPool;
    } else {
        pool = questionPool;
    }

    // Next round if we have more questions - else end game
    if (data.round < pool.length && data.levelId == 1) {
        sendWord(data.round, data.gameId);
    } else if (data.round < pool.length && data.levelId == 2) {
        sendQuestion(data.round, data.gameId);
    } else {
        endGame(data);
    }
}

/**
 * End the game if all rounds are played
 *
 * @param data
 */
function endGame(data) {

    if (data.winner && !data.done) {

        // updating players win count
        db.query('SELECT * FROM player WHERE player_name=? LIMIT 1', data.winner, function (err, rows) {

            if (rows) {
                rows.forEach(function (row) {
                    win = row.player_win;
                    win++;
                    db.query('UPDATE player SET player_win = ? WHERE player_name = ?', [win, data.winner], function () {
                    });
                });
            }
        });

        data.done = true;
    } else {
        // If the current round exceeds the number of words, send the 'gameOver' event.
        io.sockets.in(data.gameId).emit('gameOver', data);
    }
}

// function for finding leader
function findLeader() {
    var sock = this;
    var i = 0;
    leader = {};
    db.query("SELECT * FROM player ORDER BY player_win DESC LIMIT 10", function (err, rows) {
        if (rows !== undefined) {
            rows.forEach(function (row) {
                leader[i] = {};
                leader[i].name = row.player_name;
                leader[i].win = row.player_win;
                i++;
            });
        }
        sock.emit('showLeader', leader);
    });

}
/* *****************************
 *                           *
 *     PLAYER FUNCTIONS      *
 *                           *
 ***************************** */

/**
 * A player clicked the 'START GAME' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
function playerJoinGame(data) {

    // A reference to the player's Socket.IO socket object
    var sock = this;

    // Look up the room ID in the Socket.IO manager object.
    // var room = gameSocket.manager.rooms["/" + data.gameId];
    var room = gameSocket.adapter.rooms[data.gameId];

    // If the room exists...
    if (room !== undefined) {
        // attach the socket id to the data object.
        data.mySocketId = sock.id;

        // Join the room
        sock.join(data.gameId);

        // add username if unknown
        db.query('SELECT * FROM player WHERE player_name = ?', data.playerName, function (err, rows) {
            if (err) throw err;

            if (!rows.length) {
                var user = {player_name: data.playerName, player_win: 0};
                db.query('INSERT INTO player SET ?', user, function (err, res) {
                    if (err) throw err;
                });
            }
        });

        // Emit an event notifying the clients that the player has joined the room.
        io.sockets.in(data.gameId).emit('playerJoinedRoom', data);

    } else {
        // Otherwise, send an error message back to the player.
        this.emit('gameError', {message: "This room does not exist."});
    }
}

/**
 * A player has tapped a word in the word list.
 * @param data gameId
 */
function playerAnswer(data) {
    // The player's answer is attached to the data object.  \
    // Emit an event with the answer so it can be checked by the 'Host'
    io.sockets.in(data.gameId).emit('hostCheckAnswer', data);
}

/* *************************
 *                       *
 *      GAME LOGIC       *
 *                       *
 ************************* */

/**
 * Get a word for the host, and a list of words for the player.
 *
 * @param wordPoolIndex
 * @param gameId The room identifier
 */
function sendWord(wordPoolIndex, gameId) {
    var data = getWordData(wordPoolIndex);
    io.sockets.in(gameId).emit('newWordData', data);
}

/**
 * Get a question for the host, and a list of words for the player.
 *
 * @param wordPoolIndex
 * @param gameId The room identifier
 */
function sendQuestion(wordPoolIndex, gameId) {

    var data = getQuestionData(wordPoolIndex);
    io.sockets.in(gameId).emit('newQuestionData', data);
}

/**
 * This function does all the work of getting a new words from the pile
 * and organizing the data to be sent back to the clients.
 *
 * @param i The index of the wordPool.
 * @returns {{round: *, word: *, answer: *, list: Array}}
 */
function getWordData(i) {
    // Randomize the order of the available words.
    // The first element in the randomized array will be displayed on the host screen.
    // The second element will be hidden in a list of decoys as the correct answer
    var words = shuffle(wordPool[i].words);

    // Randomize the order of the decoy words and choose the first 5
    var decoys = shuffle(wordPool[i].decoys).slice(0, 5);

    // Pick a random spot in the decoy list to put the correct answer
    var rnd = Math.floor(Math.random() * 5);
    decoys.splice(rnd, 0, words[1]);

    // Package the words into a single object.
    return {
        round: i,
        word: words[0],   // Displayed Word
        answer: words[1], // Correct Answer
        list: decoys      // Word list for player (decoys and answer)
    };
}

/**
 * This function does all the work of getting a new question from the pile
 * and organizing the data to be sent back to the clients.
 *
 * @param i The index of the questionPool.
 * @returns {{round: *, question: *, answer: *, list: Array}}
 */
function getQuestionData(i) {
    // Randomize the order of the available questions.
    // The first element in the randomized array will be displayed on the host screen.
    // The second element will be hidden in a list of answer options as the correct answer

    // Randomize the order of the answer options
    var options = shuffle(questionPool[i].options);

    // Pick a random spot in the options list to put the correct answer
    var rnd = Math.floor(Math.random() * 5);
    options.splice(rnd, 0, questionPool[i].answer);

    // Package the words into a single object.
    return {
        round: i,
        question: questionPool[i].question,   // Displayed Question
        answer: questionPool[i].answer, // Correct Answer
        list: options      // Answer options list for player
    };
}

/**
 * Javascript implementation of Fisher-Yates shuffle algorithm
 * http://stackoverflow.com/questions/2450954/how-to-randomize-a-javascript-array
 */
function shuffle(array) {
    var currentIndex = array.length;
    var temporaryValue;
    var randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

/**
 * Each element in the array provides data for a single round in the game.
 *
 * In each round, two random "words" are chosen as the host word and the correct answer.
 * Five random "decoys" are chosen to make up the list displayed to the player.
 * The correct answer is randomly inserted into the list of chosen decoys.
 *
 * @type {Array}
 */
var wordPool = [
    {
        "words": ["sale", "seal", "ales", "leas"],
        "decoys": ["lead", "lamp", "seed", "eels", "lean", "cels", "lyse", "sloe", "tels", "self"]
    },

    {
        "words": ["item", "time", "mite", "emit"],
        "decoys": ["neat", "team", "omit", "tame", "mate", "idem", "mile", "lime", "tire", "exit"]
    },

    {
        "words": ["spat", "past", "pats", "taps"],
        "decoys": ["pots", "laps", "step", "lets", "pint", "atop", "tapa", "rapt", "swap", "yaps"]
    },

    {
        "words": ["nest", "sent", "nets", "tens"],
        "decoys": ["tend", "went", "lent", "teen", "neat", "ante", "tone", "newt", "vent", "elan"]
    },

    {
        "words": ["pale", "leap", "plea", "peal"],
        "decoys": ["sale", "pail", "play", "lips", "slip", "pile", "pleb", "pled", "help", "lope"]
    },

    {
        "words": ["races", "cares", "scare", "acres"],
        "decoys": ["crass", "scary", "seeds", "score", "screw", "cager", "clear", "recap", "trace", "cadre"]
    },

    {
        "words": ["bowel", "elbow", "below", "beowl"],
        "decoys": ["bowed", "bower", "robed", "probe", "roble", "bowls", "blows", "brawl", "bylaw", "ebola"]
    },

    {
        "words": ["dates", "stead", "sated", "adset"],
        "decoys": ["seats", "diety", "seeds", "today", "sited", "dotes", "tides", "duets", "deist", "diets"]
    },

    {
        "words": ["spear", "parse", "reaps", "pares"],
        "decoys": ["ramps", "tarps", "strep", "spore", "repos", "peris", "strap", "perms", "ropes", "super"]
    },

    {
        "words": ["stone", "tones", "steno", "onset"],
        "decoys": ["snout", "tongs", "stent", "tense", "terns", "santo", "stony", "toons", "snort", "stint"]
    }
];

/**
 * Each element in the array provides data for a single round in the game.
 *
 * Five random "options" are chosen to make up the list displayed to the player.
 * The correct answer is randomly inserted into the list of chosen options.
 *
 * @type {Array}
 */
var questionPool = [
    {
        'question': 'Great Britain is made up of which three countries?',
        'answer': 'England, Wales, and Scotland',
        'options': ['Spain, England, and Portugal', 'Greece, Turkey, and Egypt']
    },
    {
        'question': 'What is the form of currency used in England?',
        'answer': 'British pound',
        'options': ['Euro', 'British dollar']
    },
    {
        'question': 'In which of the following cities was Shakespeare born?',
        'answer': 'Stratford',
        'options': ['Bath', 'London']
    },
    {
        'question': 'Which city offers the "Magical Mystery Tour" of famous Beatles landmarks?',
        'answer': 'Liverpool',
        'options': ['Cambridge', 'London']
    },
    {
        'question': 'Who is Margaret Thatcher?',
        'answer': 'Britain\'s first woman Prime Minister',
        'options': ['Britain\'s longest-ruling monarch', 'The daughter of King Henry VIII']
    },
    {
        'question': 'What clothing do the British call "jumpers?"',
        'answer': 'Sweaters',
        'options': ['Jackets', 'Jeans']
    }
];