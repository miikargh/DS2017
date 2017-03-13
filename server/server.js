"use strict";

const portscanner = require("portscanner");
const WebSocket = require("ws");
let wss;
const ports = [8080, 8081, 8082];

const crypto = require("crypto");
const algorithm = "aes-256-ctr"; // Encryption algorithm
const password = "dsIsAwesome9001"; // Encryption key

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
    }

    set cons(cons) {
        this._cons = cons;
    }

    set turn(turn) {
        this._turn = turn;
    }

    set players(players) {
        this._players = players;
    }

    set lastCard(card) {
        this._lastCard = card;
    }

    // Methods
    addCon(connection) {
        this._cons.push(connection);
        broadCast("PLAYER JOINED", this.players, null);
        return this._cons.length - 1; // Returns the index of the added con
    }

    disconnectCon(index) {
        this._cons.splice(index, 1);
        this.players.splice(index, 1);
    }

    addPlayer() {
        this._players.push({
            "name": "Player" + (this._players.length + 1),
            "score": 0,
        });
    }

    setPlayerScore(player, score) {
        this._players[player].score = score;
    }

    reset() {
        this.cons = [];
        this.deck = null;
        this.turn = -1;
        this.players = [];
        this.lastCard = null;
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

const giveTurn = (player, card) => {
    player.send(
        constructMessage("YOUR TURN", state.players, card)
    );
};

const isCorrect = msg => {

    // Checks if the answer is correct

    msg = msg.toUpperCase();

    switch (msg) {
        case "BIGGER":
            if (state.nextCard > state.lastCard) {
                return true;
            }
            break;

        case "SMALLER":
            if (state.nextCard < state.lastCard) {
                return true;
            }
            break;

        default:
            throw "Invalid message!";
            break;
    }
    return false;
};

const constructMessage = (message, players, card) => {
    var msg = {
        "message": message,
        "players": players,
        "card": card
    };

    return encrypt(JSON.stringify(msg));
};

const broadCast = (message, players, card) => {
    const msg = constructMessage(message, players, card);
    state.cons.forEach(con => con.send(msg));
};

// EVENT HANDLERS
const handleConnection = (ws) => {

    ws.on("message", onMessage.bind(ws));
    ws.on("close", onClose.bind(ws));

    state.addPlayer();
    state.addCon(ws);

    console.log("node connected");
};

const handleTurns = () => {

    state.turn++;
    if (state.turn === state.players.length) state.turn = 0;

    giveTurn(state.cons[state.turn], state.card);
}

const handleGameEnd = () => {

    if (state.cons.length === 1) { // Just one connection
        state.cons[0].send(constructMessage("YOU WIN", state.players, null));
        return;
    }

    // Get the player with highest score
    const winner = state.players.reduce((a, b) => {
        if (a.score > b.score) {
            return state.players.indexOf(a);
        }
        return state.players.indexOf(b);
    });

    // Other players than the winner
    const losers = [...Array(state.players.length).keys()].filter(a => a !== winner);

    broadCast("GAME OVER", state.players, null);
    state.cons[winner].send(constructMessage("YOU WIN", state.players, null));
    losers.forEach(l => state.cons[l].send(constructMessage("YOU LOST", state.players, null)));

    // Reset everything to enable new game
    state.reset();
};

const onConnection = ws => {

    if (state.turn >= 0) { // GAME ALREADY ON
        ws.send(constructMessage("GAME FULL", null));
        ws.close();
        return;
    }

    if (state.cons.length < state.maxPlayers - 1) {
        handleConnection(ws);

    } else if (state.cons.length === state.maxPlayers - 1) { // Last player
        handleConnection(ws);

        // START THE GAME;
        state.deck = shuffleDeck(createDeck(6));
        handleTurns();

    } else {
        // Only three players allowed.
        ws.send(constructMessage("GAME FULL", null));
        ws.close();
    }
};

const onClose = function(message) {
    // this needs to be binded to the socket that was closed

    // Handles closed connections

    let index = state.cons.indexOf(this);


    state.disconnectCon(index);
    broadCast("PLAYER LEFT", state.players, null);

    if (index === state.turn) {
        if (index === state.players.length) {
            index = 0;
            state.turn = 0;
        };
        giveTurn(state.cons[index], state.nextcard);
    }


    console.log(`node ${index} disconnected`);
    if(!state.cons.length) { // All connections have disconnected
        state.reset();
        return;
    }
};

const onMessage = function(message) {
    // this needs to be binded to the socket that received the message

    // Handles incoming messages

    const msg = decrypt(message);
    let index = state.cons.indexOf(this);
    let newMessage;

    if (state.turn > -1 && state.turn === index) {

        if (isCorrect(msg)) {
            state.players[state.cons.indexOf(this)].score++;
            newMessage = "RIGHT";
        } else {
            state.players[state.cons.indexOf(this)].score--;
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


// ENCRYPTION UTILS
const encrypt = (text) => {
    // Encrypt text using crypto module
    const cipher = crypto.createCipher(algorithm, password);
    let crypted = cipher.update(text, "utf8", "hex");
    crypted += cipher.final("hex");
    return crypted;
};

const decrypt = (text) => {
    // Decrypt text crypto module
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
});
