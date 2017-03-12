"use strict";

const portscanner = require("portscanner");
const WebSocket = require("ws");
let wss;
// let replicaPorts = [];
// const replicas = [];
// let rwss;
// const rwssPorts = [9080, 9081, 9082];
const ports = [8080, 8081, 8082];

const crypto = require("crypto");
const algorithm = "aes-256-ctr";
const password = "dsIsAwesome9001";

class State {
    constructor(deck, maxPlayers) {
        this._cons = [];
        this._deck = deck || null;
        this._turn = -1;
        this._maxPlayers = maxPlayers || null;
        this._lastCard = null;
        this._players = [];
    }

    // GETTERS
    get cons() {
        return this._cons;
    }

    get deck() {
        return this._deck;
    }

    get turn() {
        return this._turn;
    }

    get maxPlayers() {
        return this._maxPlayers;
    }

    get card() {
        this._lastCard = this._deck.pop();
        multiCastStateChange();
        return this._lastCard;
    }

    get nextCard() {
        return this._deck[this._deck.length - 1];
    }

    get lastCard() {
        return this._lastCard;
    }

    get state() {
        return {
            "cons": this.cons,
            "deck": this.deck,
            "turn": this.turn,
            "maxPlayers:": this.maxPlayers,
            "lastCard": this.lastCard,
        };
    }

    get players() {
        return this._players;
    }

    // SETTERS
    set deck(deck) {
        this._deck = deck;
        multiCastStateChange();
    }

    set cons(cons) {
        this._cons = cons;
        multiCastStateChange();
    }

    set turn(turn) {
        this._turn = turn;
        multiCastStateChange();
    }

    // Methods
    addCon(connection) {
        this._cons.push(connection);
        broadCast("PLAYER JOINED", this.players);
        multiCastStateChange();
        return this._cons.length - 1; // Returns the index of the added con
    }

    disconnectCon(index) {
        this._cons[index] = null;
    }

    addPlayer() {
        console.log("adding player");
        this._players.push({
            "name": "Player" + (this._players.length + 1),
            "score": 0,
        });
    }

    setPlayerScore(player, score) {
        this._players[player].score = score;
    }

}

// SATE OBJECT

const state = new State(null, 3);

// UTILS
const createDeck = numOfCards => {
    return [...Array(numOfCards).keys()].map( x => ++x );
};

const shuffleDeck = deck => {
    let a = deck;
    for (let i = a.length; i; i--) {
        let j = Math.floor(Math.random() * i);
        [a[i - 1], a[j]] = [a[j], a[i - 1]];
    }
    return a;
};

const handleTurns = () => {

    state.turn++;
    if (state.turn === state.maxPlayers) state.turn = 0;

    giveTurn(state.cons[state.turn], state.card);
}

const giveTurn = (player, card) => {
    player.send(
        constructMessage("YOUR TURN", state.players, card)
    );
};

const isCorrect = msg => {
    msg = msg.toUpperCase();

    switch (msg) {
        case "BIGGER":
            if (state.nextCard > state.lastCard) {
                return true;
            }
            break;

        case "SMALLER":
            if (state.nextCard < state.lasCard) {
                return true;
            }
            break;

        default:
            throw "Invalid message!";
            break;
    }

    return false;
};

const handleConnection = (ws) => {

    ws.on("message", onMessage.bind(ws));
    ws.on("close", onClose.bind(ws));

    state.addPlayer();
    ws.playerIndex = state.addCon(ws);

    console.log("node connected");
}

const constructMessage = (message, players, card) => {
    var msg = {
        "message": message,
        "players": players,
        "card": card
    };

    return encrypt(JSON.stringify(msg));
};

const broadCast = (message, players) => {
    const msg = constructMessage(message, players);
    state.cons.forEach(con => con.send(msg));
};

// EVENT HANDLERS
const onConnection = ws => {

    if (state.cons.length < state.maxPlayers - 1) {
        handleConnection(ws);

    } else if (state.cons.length === state.maxPlayers - 1) {
        handleConnection(ws);

        // START THE GAME;
        state.deck = shuffleDeck(createDeck(3));
        handleTurns();

    } else if (state.cons.length = state.maxPlayers) {

    } else {
        ws.send(constructMessage("GAME FULL", null));
        ws.close();
    }
};

const handleGameEnd = () => {
    const winner = state.players.reduce((a, b) => {
        if (a.score > b.score) {
            return state.players.indexOf(a);
        }
        return state.players.indexOf(b);
    });
    // const losers = state.cons.filter(a => a !== winner);
    const losers = [...Array(state.maxPlayers).keys()].filter(a => a !== winner);

    broadCast("GAME OVER", state.players);
    state.cons[winner].send(constructMessage("YOU WIN", state.players, null));
    losers.forEach(l => state.cons[l].send(constructMessage("YOU LOST", state.players, null)));
};

const onClose = function(message) {
    // this needs to be binded to the socket that was closed

    const index = state.cons.indexOf(this);

    state.disconnectCon(index);

    console.log(`Node ${index} disconnected.`);
};

const onMessage = function(message) {
    // this needs to be binded to the socket that received the message

    const msg = decrypt(message);
    let index = state.cons.indexOf(this);
    let newMessage;

    if (state.turn > -1 && state.turn === index) {

        if (isCorrect(msg)) {
            state.players[this.playerIndex].score++;
            newMessage = "RIGHT";
        } else {
            state.players[this.playerIndex].score--;
            newMessage = "WRONG";
        }

        this.send(constructMessage(newMessage, null, state.nextCard));

        if (!state.deck.length) {
            handleGameEnd();
            return;
        }

        broadCast("SCORE", state.players, null);
        handleTurns();
    }
};

// // REPLICA CONNECTIONS
//
const multiCastStateChange = (state) => {
    // replicas.forEach(r => {
    //     const message = {
    //         "message": "STATE CHANGE",
    //         "state": state.state
    //     }
    //     r.send(encrypt(JSON.stringify(message)));
    // });
    // console.log("Multicasted state chage");
};
//
// const onReplicaMessage = msg => {
//     const message = decrypt(msg);
//
//     switch(message.message) {
//         case "STATE CHANGE":
//             // SAVE STATE CHANGE
//             console.log("Received state change");
//             break;
//
//         default:
//             console.log("Unknown replica message");
//             break;
//     }
//
// };
//
// const onReplicaConnection = rws => {
//     rws.onmessage = onReplicaMessage;
//     replicas.push(rws);
//     console.log("New replica connection open");
// };
//
// const connectToReplicas = replicaPorts => {
//     let port;
//     portscanner.findAPortNotInUse(rwssPorts[0], rwssPorts[rwssPorts.length - 1], "127.0.0.1")
//         .then(port => {
//             rwss = new WebSocket.Server({ port: port });
//             rwss.on("connection", onReplicaConnection);
//             console.log("Listening for replicas on " + port);
//         })
//         .then(() => {
//             return portscanner.findAPortNotInUse(
//                 replicaPorts[0],
//                 replicaPorts[replicaPorts.length - 1],
//                 "127.0.0.1"
//             );
//         })
//         .then(port => {
//             console.log(port);
//             let rws = new WebSocket("ws://127.0.0.1");
//             // rws.on("connection", function() {
//             //     console.log("rws connected");
//             // });
//         })
//         .catch(err => {
//             console.log("No replicas found");
//         });
// };

// ENCRYPTION UTILS
const encrypt = (text) => {
    const cipher = crypto.createCipher(algorithm, password);
    let crypted = cipher.update(text, "utf8", "hex");
    crypted += cipher.final("hex");
    return crypted;
};

const decrypt = (text) => {
    const decipher = crypto.createDecipher(algorithm, password);
    let dec = decipher.update(text, "hex", "utf8");
    dec += decipher.final("utf8");
    return dec;
};

// CONNECT
portscanner.findAPortNotInUse(ports[0], ports[2], "127.0.0.1", (err, port) => {
    wss = new WebSocket.Server({ port: port });
    wss.on("connection", onConnection);
    console.log(`Listening to port ${port}`);
    // replicaPorts = ports.filter(p => p !== port);

    // connectToReplicas(replicaPorts);
});
