// app.js

require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.APIKEY,
  authDomain: process.env.AUTHDOMAIN,
  databaseURL: process.env.DATABASEURL,
  projectId: process.env.PROJECTID,
  storageBucket: process.env.STORAGEBUCKET,
  messagingSenderId: process.env.MESSAGINGSENDERID,
  appId: process.env.APPID,
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const game = new Chess();
let board = null;

function onDragStart(source, piece, position, orientation) {
  // Prevent illegal moves
  if (game.game_over()) return false;
  if (
    (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
    (game.turn() === 'b' && piece.search(/^w/) !== -1)
  ) {
    return false;
  }
}

function onDrop(source, target) {
  // See if the move is legal
  const move = game.move({
    from: source,
    to: target,
    promotion: 'q', // Always promote to a queen for simplicity
  });

  // Illegal move
  if (move === null) return 'snapback';

  // Update the game state in Firebase
  updateGameState();

  // Randomize pieces after every set of turns
  if (game.history().length % 2 === 0) {
    randomizePieces('w');
    randomizePieces('b');
    updateGameState();
  }

  updateStatus();
}

function updateStatus() {
  let status = '';

  let moveColor = 'White';
  if (game.turn() === 'b') {
    moveColor = 'Black';
  }

  // Checkmate?
  if (game.in_checkmate()) {
    status = `Game over, ${moveColor} is in checkmate.`;
  }
  // Draw?
  else if (game.in_draw()) {
    status = 'Game over, drawn position.';
  }
  // Game continues
  else {
    status = `${moveColor} to move`;

    // Check?
    if (game.in_check()) {
      status += `, ${moveColor} is in check.`;
    }
  }

  document.getElementById('status').innerHTML = status;
}

function randomizePieces(color) {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    attempts++;

    // Get current positions
    const positions = game.board();
    const nonPawnPieces = [];
    const squares = [];

    // Collect all non-pawn pieces and their positions
    for (let i = 0; i < positions.length; i++) {
      for (let j = 0; j < positions[i].length; j++) {
        const piece = positions[i][j];
        if (piece && piece.color === color && piece.type !== 'p') {
          nonPawnPieces.push(piece);
          squares.push(getSquare(i, j));
        }
      }
    }

    // Shuffle the pieces
    shuffleArray(nonPawnPieces);

    // Create a copy of the game to test the randomization
    const testGame = new Chess(game.fen());

    // Remove original pieces
    for (const square of squares) {
      testGame.remove(square);
    }

    // Place the pieces in new positions
    for (let i = 0; i < squares.length; i++) {
      testGame.put(nonPawnPieces[i], squares[i]);
    }

    // Check if the king is safe
    if (!testGame.in_check() && !testGame.in_checkmate()) {
      // Apply the randomization
      game.load(testGame.fen());
      board.position(game.fen());
      return;
    }
  }

  console.log(
    `Could not randomize pieces for ${color} without putting king in check.`
  );
}

function getSquare(row, col) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  return files[col] + (8 - row);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function onSnapEnd() {
  board.position(game.fen());
}
function updateGameState() {
  const gameState = {
    fen: game.fen(),
    history: game.history(),
    turn: game.turn(),
  };
  database.ref('gameState').set(gameState);
}

database.ref('gameState').on('value', (snapshot) => {
  const data = snapshot.val();
  if (data) {
    if (data.fen !== game.fen()) {
      game.load(data.fen);
      board.position(game.fen());
      updateStatus();
    }
  }
});
const urlParams = new URLSearchParams(window.location.search);
let playerColor = 'w';
if (urlParams.get('color') === 'b') {
  playerColor = 'b';
  board.orientation('black');
}

function onDragStart(source, piece) {
  if (game.game_over()) return false;
  if (game.turn() !== playerColor) return false;
  if (
    (playerColor === 'w' && piece.search(/^b/) !== -1) ||
    (playerColor === 'b' && piece.search(/^w/) !== -1)
  ) {
    return false;
  }
}

const config = {
  draggable: true,
  position: 'start',
  onDragStart,
  onDrop,
  onSnapEnd,
  orientation: 'white',
};

document.getElementById('restartBtn').addEventListener('click', () => {
  game.reset();
  board.start();
  updateGameState();
  updateStatus();
});

board = Chessboard('board', config);

updateStatus();
