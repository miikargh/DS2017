
// MODULES
const crypto = require("crypto");

// COMPONENTS
const menu = document.getElementById("menu");
const ready = document.getElementById("ready");
const game = document.getElementById("game");
const bigger = document.getElementById("bigger");
const smaller = document.getElementById("smaller");
const waiting = document.getElementById("waiting");
const info = document.getElementById("info");
const players = document.getElementById("players");
const controls = [...document.getElementsByClassName("control")];


// ENCRYPTION CONSTANTS
const algorithm = "aes-256-ctr";
const password = "dsIsAwesome9001";

// SOCKETS
let ws;
const maxPort = 8089;

// SOCKET EVENTS
const onConnection = function(event) {
    console.log("Connection open");
};

const onMessage = function(event) {

    const data = JSON.parse(decrypt(event.data));

    console.log(data);

    switch(data.message.toUpperCase()) {
        case "YOUR TURN":
            info.innerHTML = `It's your turn to guess!<br>
                                Is the next card smaller or bigger than
                                ${data.card}`;
            enableControls();
            waiting.classList.add("js-hide");
            game.classList.add("js-show");
            break;

        case "WRONG":
            info.innerHTML = `Sorry. You guessed wrong :(<br>
                                The card was ${data.card}`;
            break;

        case "RIGHT":
            info.innerHTML = `Congratulations! You guessed right!<br>
                                The card was ${data.card}`;
            break;

        case "SCORE":
            updateScoreBoard(data);
            break;

        case "GAME OVER":
            info.innerHTML = "Game is over!";
            break;

        case "YOU WIN":
            info.innerHTML = "Congrats! You win!";
            break;

        case "YOU LOST":
            info.innerHTML = "Sorry. You lost :/";
            break;

        case "PLAYER JOINED":
            info.innerHTML = "New player just joined.";
            updateScoreBoard(data);
            break;

        case "CARD":
            card.innerHTML = data.card;
            break;

        case "GAME FULL":
            info.innerHTML = "The game is full. Please wait for the next game";
            break;

        default:
            console.log("Should this ever happen?");
            break;
    }
};

// DOM EVENTS
ready.addEventListener("click", () => {
    let port = 8080;
    ws = new WebSocket("ws://localhost:" + port);
    ws.onopen = onConnection;
    ws.onmessage = onMessage;

    // ws.onclose = function(event) {
    //     if (event.code === 3001) {
    //         console.log("Connection closed");
    //         ws = null;
    //         return;
    //     }
    //     port++;
    //     if (port > maxPort) {
    //         console.log("Now available servers at this time.");
    //         ws = null;
    //     }
    //     ws = new WebSocket("ws://localhost" + port);
    // };
    menu.classList.add("js-hide");
    waiting.classList.add("js-show");
});

controls.forEach(control => control.addEventListener("click", controlClick))

function controlClick() {
    ws.send(encrypt(this.dataset.msg.toUpperCase()));
    disableControls();
}

// UTILS
function disableControls() {
    controls.forEach(control => control.disabled = true);
}

function enableControls() {
    controls.forEach(control => control.disabled = false);
}

function updateScoreBoard(data) {
    players.innerHTML = "";
    data.players.forEach(player => {
        let li = document.createElement("li");
        li.innerHTML =`${player.name}: ${player.score}`;
        players.appendChild(li);
    });
}

function encrypt(text) {
    const cipher = crypto.createCipher(algorithm, password);
    let crypted = cipher.update(text, "utf8", "hex");
    crypted += cipher.final("hex");
    return crypted;
}

function decrypt(text) {
    const decipher = crypto.createDecipher(algorithm, password);
    let dec = decipher.update(text, "hex", "utf8");
    dec += decipher.final("utf8");
    return dec;
}
