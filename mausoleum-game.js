// MAUSOLEUM GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS
// ============================================
const PLAYER_1 = 1;
const PLAYER_2 = 2;
const EMPTY = 0;

// Board layout: 9 rows, 4-5-6-7-8-7-6-5-4 fields
const ROW_LENGTHS = [4, 5, 6, 7, 8, 7, 6, 5, 4];
const TOTAL_ROWS = 9;

// SVG rendering constants
const V_PADDING = 5;
const H_PADDING = 5;
const FIELD_RADIUS = 3.5;
const STONE_RADIUS = 3.0;
const HITBOX_RADIUS = 4.5;

// ============================================
// GAME STATE
// ============================================
let board = [];
let currentPlayer = PLAYER_1;
let selectedStone = null; // { r, c }
let validMoves = [];
let gameOver = false;
let isVsComputer = false;

// Track AI behavior to prevent loops
let aiLastMovedStone = null; // {r, c}
let aiConsecutiveMoveCount = 0;

// Game data maps
let fieldElements = new Map(); // "r,c" -> { spot, hitbox }
let stoneElements = new Map(); // "r,c" -> stone element
let neighborMap = new Map(); // "r,c" -> [{r,c}, ...]
let directionMap = new Map(); // "r,c" -> [[{r,c}, ...], ...] (6 directions)

// ============================================
// DOM ELEMENTS
// ============================================
const svg = document.getElementById('game-board');
const SVG_NS = "http://www.w3.org/2000/svg";

const statusPlayer = document.getElementById('current-player');
const p2CountDisplay = document.getElementById('player2-count');
const resetButton = document.getElementById('reset-button');
const opponentButton = document.getElementById('opponent-btn');
const messageBox = document.getElementById('message-box');
const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');

// ============================================
// BOARD INITIALIZATION
// ============================================

function createBoard() {
    board = [];
    for (let r = 0; r < TOTAL_ROWS; r++) {
        const rowLen = ROW_LENGTHS[r];
        const row = Array(rowLen).fill(EMPTY);

        // Setup Player 1 (White): Rows 0 and 1
        if (r === 0 || r === 1) {
            row.fill(PLAYER_1);
        }
        // Setup Player 2 (Black): Bottom two rows (Rows 7 and 8)
        if (r === TOTAL_ROWS - 2 || r === TOTAL_ROWS - 1) {
            row.fill(PLAYER_2);
        }
        board.push(row);
    }
}

// ============================================
// COORDINATE & RENDERING
// ============================================

function getCoords(r, c) {
    const maxLen = ROW_LENGTHS[Math.floor(TOTAL_ROWS / 2)];
    const rowLen = ROW_LENGTHS[r];

    const offsetX = (maxLen - rowLen) * (100 - 2 * H_PADDING) / (maxLen - 1) / 2;

    const x = H_PADDING + offsetX + c * (100 - 2 * H_PADDING) / (maxLen - 1);
    const y = V_PADDING + r * (100 - 2 * V_PADDING) / (TOTAL_ROWS - 1);

    return { x, y };
}

function drawBoard() {
    svg.innerHTML = '';
    fieldElements.clear();
    stoneElements.clear();

    const stoneCounts = { [PLAYER_1]: 0, [PLAYER_2]: 0 };

    const linesGroup = document.createElementNS(SVG_NS, 'g');
    const fieldsGroup = document.createElementNS(SVG_NS, 'g');
    const stonesGroup = document.createElementNS(SVG_NS, 'g');

    // Draw lines first (underneath fields)
    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            const neighbors = getNeighbors(r, c);
            const p1 = getCoords(r, c);

            for (const n of neighbors) {
                // Only draw lines to "future" neighbors to avoid duplicates
                if (n.r > r || (n.r === r && n.c > c)) {
                    const p2 = getCoords(n.r, n.c);
                    const line = document.createElementNS(SVG_NS, 'line');
                    line.setAttribute('x1', p1.x);
                    line.setAttribute('y1', p1.y);
                    line.setAttribute('x2', p2.x);
                    line.setAttribute('y2', p2.y);
                    line.classList.add('grid-line');
                    linesGroup.appendChild(line);
                }
            }
        }
    }

    // Draw fields and stones
    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            const key = `${r},${c}`;
            const { x, y } = getCoords(r, c);
            const stoneValue = board[r][c];

            // Visible field spot
            const spot = document.createElementNS(SVG_NS, 'circle');
            spot.setAttribute('cx', x);
            spot.setAttribute('cy', y);
            spot.setAttribute('r', FIELD_RADIUS);
            spot.classList.add('field-spot');

            // Invisible hitbox
            const hitbox = document.createElementNS(SVG_NS, 'circle');
            hitbox.setAttribute('cx', x);
            hitbox.setAttribute('cy', y);
            hitbox.setAttribute('r', HITBOX_RADIUS);
            hitbox.classList.add('field-hitbox');
            hitbox.dataset.r = r;
            hitbox.dataset.c = c;

            hitbox.addEventListener('click', () => onCellClick(r, c));

            fieldsGroup.appendChild(spot);
            fieldsGroup.appendChild(hitbox);
            fieldElements.set(key, { spot, hitbox });

            if (stoneValue !== EMPTY) {
                stoneCounts[stoneValue]++;
                const stone = document.createElementNS(SVG_NS, 'circle');
                stone.setAttribute('cx', x);
                stone.setAttribute('cy', y);
                stone.setAttribute('r', STONE_RADIUS);
                stone.classList.add('stone', `player-${stoneValue}`);

                if (isTrapped(r, c)) {
                    stone.classList.add('trapped');
                }

                stonesGroup.appendChild(stone);
                stoneElements.set(key, stone);
            }
        }
    }

    svg.appendChild(linesGroup);
    svg.appendChild(fieldsGroup);
    svg.appendChild(stonesGroup);

    // Update UI
    p1CountDisplay.textContent = stoneCounts[PLAYER_1];
    p2CountDisplay.textContent = stoneCounts[PLAYER_2];
    statusPlayer.textContent = currentPlayer === PLAYER_1 ? 'White' : 'Black';
    statusPlayer.style.color = currentPlayer === PLAYER_1 ? '#3b82f6' : '#1f2937';

    // Highlight selected stone and moves
    highlightSelection();
}

function highlightSelection() {
    // Clear all highlights
    fieldElements.forEach(({ spot }) => spot.classList.remove('valid-move'));
    stoneElements.forEach((stone) => stone.classList.remove('selected'));

    // Highlight valid moves
    for (const move of validMoves) {
        const key = `${move.r},${move.c}`;
        fieldElements.get(key)?.spot.classList.add('valid-move');
    }

    // Highlight selected stone
    if (selectedStone) {
        const key = `${selectedStone.r},${selectedStone.c}`;
        stoneElements.get(key)?.classList.add('selected');
    }
}

// ============================================
// NEIGHBOR & DIRECTION LOGIC
// ============================================

function buildNeighborMaps() {
    neighborMap.clear();
    directionMap.clear();

    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            const key = `${r},${c}`;
            const neighbors = [];

            // Dir 0: W
            if (c > 0) neighbors.push({ r, c: c - 1 });
            // Dir 1: E
            if (c < ROW_LENGTHS[r] - 1) neighbors.push({ r, c: c + 1 });

            // Rows above
            if (r > 0) {
                if (ROW_LENGTHS[r] < ROW_LENGTHS[r - 1]) {
                    // Dir 2: NW
                    neighbors.push({ r: r - 1, c: c });
                    // Dir 3: NE
                    neighbors.push({ r: r - 1, c: c + 1 });
                } else {
                    // Dir 2: NW
                    if (c > 0) neighbors.push({ r: r - 1, c: c - 1 });
                    // Dir 3: NE
                    if (c < ROW_LENGTHS[r] - 1) neighbors.push({ r: r - 1, c: c });
                }
            }

            // Rows below
            if (r < TOTAL_ROWS - 1) {
                if (ROW_LENGTHS[r] < ROW_LENGTHS[r + 1]) {
                    // Dir 4: SW
                    neighbors.push({ r: r + 1, c: c });
                    // Dir 5: SE
                    neighbors.push({ r: r + 1, c: c + 1 });
                } else {
                    // Dir 4: SW
                    if (c > 0) neighbors.push({ r: r + 1, c: c - 1 });
                    // Dir 5: SE
                    if (c < ROW_LENGTHS[r] - 1) neighbors.push({ r: r + 1, c: c });
                }
            }
            neighborMap.set(key, neighbors);
        }
    }

    // Build direction paths
    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            const key = `${r},${c}`;
            const paths = [];
            const startNeighbors = getNeighbors(r, c);

            for (const n1 of startNeighbors) {
                const path = [n1];
                let prev = { r, c };
                let curr = n1;
                while (true) {
                    const next = getNextOnLine(prev, curr);
                    if (!next || !isInBounds(next.r, next.c)) break;

                    path.push(next);
                    prev = curr;
                    curr = next;
                }
                paths.push(path);
            }
            directionMap.set(key, paths);
        }
    }
}

function getNextOnLine(prev, curr) {
    const neighbors = getNeighbors(curr.r, curr.c);

    const prev_pos = getCoords(prev.r, prev.c);
    const curr_pos = getCoords(curr.r, curr.c);

    const EPSILON = 0.01;
    const dx = curr_pos.x - prev_pos.x;
    const dy = curr_pos.y - prev_pos.y;

    for (const n of neighbors) {
        if (n.r === prev.r && n.c === prev.c) continue;

        const n_pos = getCoords(n.r, n.c);
        const ndx = n_pos.x - curr_pos.x;
        const ndy = n_pos.y - curr_pos.y;

        if (Math.abs(ndx - dx) < EPSILON && Math.abs(ndy - dy) < EPSILON) {
            return n;
        }
    }

    return null;
}

function getNeighbors(r, c) {
    const key = `${r},${c}`;
    return neighborMap.get(key) || [];
}

function isInBounds(r, c) {
    return r >= 0 && r < TOTAL_ROWS && c >= 0 && c < ROW_LENGTHS[r];
}

// ============================================
// GAME LOGIC
// ============================================

function calculateValidMoves(r, c) {
    validMoves = [];

    // If a stone is trapped, it cannot move
    if (isTrapped(r, c)) {
        return;
    }

    const paths = directionMap.get(`${r},${c}`);

    if (!paths) return;

    for (const path of paths) {
        for (const pos of path) {
            if (board[pos.r][pos.c] !== EMPTY) {
                // Stop on the space immediately before it
                const stopPos = path[path.indexOf(pos) - 1];
                if (stopPos) {
                    validMoves.push(stopPos);
                }
                break;
            }

            // If this is the last spot on the path (edge)
            if (path.indexOf(pos) === path.length - 1) {
                validMoves.push(pos);
            }
        }
    }
}

function isTrapped(r, c) {
    if (board[r][c] === EMPTY) return false;

    let emptyNeighbors = 0;
    const neighbors = getNeighbors(r, c);

    for (const n of neighbors) {
        if (board[n.r][n.c] === EMPTY) {
            emptyNeighbors++;
        }
    }
    return emptyNeighbors === 1;
}

function onCellClick(r, c) {
    if (gameOver) return;

    const clickedCell = board[r][c];

    // 1. Try to move a stone
    if (selectedStone && validMoves.some(m => m.r === r && m.c === c)) {
        moveStone(selectedStone.r, selectedStone.c, r, c);
        return;
    }

    // 2. Deselect stone
    if (selectedStone && selectedStone.r === r && selectedStone.c === c) {
        selectedStone = null;
        validMoves = [];
        highlightSelection();
        return;
    }

    // 3. Select a new stone
    if (clickedCell === currentPlayer) {
        selectedStone = { r, c };
        calculateValidMoves(r, c);
        highlightSelection();
    } else {
        selectedStone = null;
        validMoves = [];
        highlightSelection();
    }
}

function moveStone(r1, c1, r2, c2) {
    board[r2][c2] = board[r1][c1];
    board[r1][c1] = EMPTY;

    selectedStone = null;
    validMoves = [];

    resolveEncirclements();

    if (checkWinCondition()) {
        drawBoard();
        return;
    }

    // Track AI consecutive moves to prevent loops
    if (currentPlayer === PLAYER_2) {
        if (aiLastMovedStone &&
            aiLastMovedStone.r === r1 &&
            aiLastMovedStone.c === c1) {
            aiConsecutiveMoveCount++;
        } else {
            aiLastMovedStone = { r: r2, c: c2 }; // Update to new position
            aiConsecutiveMoveCount = 1;
        }
        // Update position for next turn's check
        aiLastMovedStone = { r: r2, c: c2 };
    } else {
        aiLastMovedStone = null;
        aiConsecutiveMoveCount = 0;
    }

    currentPlayer = currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1;
    drawBoard();

    if (!gameOver && isVsComputer && currentPlayer === PLAYER_2) {
        setTimeout(makeAIMove, 600);
    }
}

function resolveEncirclements() {
    const stonesToRemove = [];

    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            if (board[r][c] !== EMPTY && isEncircled(r, c)) {
                if (shouldBeRemoved(r, c)) {
                    stonesToRemove.push({ r, c });
                }
            }
        }
    }

    let removed = stonesToRemove.length > 0;
    for (const stone of stonesToRemove) {
        board[stone.r][stone.c] = EMPTY;
    }

    if (removed) {
        resolveEncirclements(); // Recursive check
    }
}

function isEncircled(r, c) {
    const neighbors = getNeighbors(r, c);

    for (const n of neighbors) {
        if (board[n.r][n.c] === EMPTY) {
            return false;
        }
    }

    return true;
}

function shouldBeRemoved(r, c) {
    const stoneOwner = board[r][c];
    const opponent = stoneOwner === PLAYER_1 ? PLAYER_2 : PLAYER_1;
    let friendlyCount = 0;
    let opponentCount = 0;
    const neighbors = getNeighbors(r, c);

    for (const n of neighbors) {
        if (board[n.r][n.c] === stoneOwner) {
            friendlyCount++;
        } else if (board[n.r][n.c] === opponent) {
            opponentCount++;
        }
    }
    return opponentCount > friendlyCount;
}

function checkWinCondition() {
    const stoneCounts = { [PLAYER_1]: 0, [PLAYER_2]: 0 };
    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            if (board[r][c] !== EMPTY) {
                if (stoneCounts[board[r][c]] !== undefined) {
                    stoneCounts[board[r][c]]++;
                }
            }
        }
    }

    const p1Loses = stoneCounts[PLAYER_1] < 4;
    const p2Loses = stoneCounts[PLAYER_2] < 4;

    if (p1Loses && p2Loses) {
        showEndGameMessage("Draw!", "Both players have fewer than four stones.");
        return true;
    }
    if (p1Loses) {
        showEndGameMessage("Black Wins!", "White has fewer than four stones.");
        return true;
    }
    if (p2Loses) {
        showEndGameMessage("White Wins!", "Black has fewer than four stones.");
        return true;
    }
    return false;
}

function showEndGameMessage(title, text) {
    gameOver = true;
    messageTitle.textContent = title;
    messageText.textContent = text;
    messageBox.classList.add('visible');
}

function hideEndGameMessage() {
    messageBox.classList.remove('visible');
}

function initGame() {
    createBoard();
    buildNeighborMaps();
    currentPlayer = PLAYER_1;
    selectedStone = null;
    validMoves = [];
    gameOver = false;
    drawBoard();
}

// ============================================
// EVENT LISTENERS
// ============================================
resetButton.addEventListener('click', initGame);
let _opponentBtnTimeout = null;
opponentButton.addEventListener('click', () => {
    // Computer mode is coming soon — revert immediately after showing the message
    clearTimeout(_opponentBtnTimeout);
    isVsComputer = false;
    opponentButton.textContent = 'Computer Coming Soon';
    _opponentBtnTimeout = setTimeout(() => {
        opponentButton.textContent = 'Opponent: Human';
    }, 1500);
});


// ============================================
// AI LOGIC
// ============================================

function makeAIMove() {
    if (gameOver || currentPlayer !== PLAYER_2) return;

    let possibleActions = [];

    // Find all valid moves for all black stones
    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            if (board[r][c] === PLAYER_2 && !isTrapped(r, c)) {
                // Determine valid glide destinations
                const paths = directionMap.get(`${r},${c}`);
                if (paths) {
                    for (const path of paths) {
                        for (let i = 0; i < path.length; i++) {
                            const pos = path[i];
                            if (board[pos.r][pos.c] !== EMPTY) {
                                // Blocked by stone, valid move is the space right before it
                                if (i > 0) {
                                    possibleActions.push({
                                        from: { r, c },
                                        to: path[i - 1]
                                    });
                                }
                                break;
                            } else if (i === path.length - 1) {
                                // Reached edge
                                possibleActions.push({
                                    from: { r, c },
                                    to: pos
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    if (possibleActions.length === 0) {
        // Technically this shouldn't happen unless all stones are trapped
        // Game engine doesn't explicitly handle "no moves left" loss right now, but just in case
        return;
    }

    let bestAction = null;
    let bestScore = -Infinity;

    // Helper: simulate a move and count advantage
    const simulateAndEvaluate = (action) => {
        // We only do a shallow evaluation: does this move encircle an opponent? Does it get us encircled?
        const r1 = action.from.r; const c1 = action.from.c;
        const r2 = action.to.r; const c2 = action.to.c;

        // Deep copy board for pure evaluation (Mausoleum has a simple board array)
        const simBoard = board.map(row => [...row]);

        simBoard[r2][c2] = simBoard[r1][c1];
        simBoard[r1][c1] = EMPTY;

        let score = 0;

        // Count stones to see if this move results in captures
        let bBefore = 0, wBefore = 0;
        board.forEach(row => row.forEach(val => {
            if (val === PLAYER_2) bBefore++;
            if (val === PLAYER_1) wBefore++;
        }));

        // Simulate encirclement resolution
        let simChanged = true;
        while (simChanged) {
            simChanged = false;
            let stonesToRemove = [];

            // Re-implement the exact encirclement logic for the simulation
            for (let r = 0; r < TOTAL_ROWS; r++) {
                for (let c = 0; c < ROW_LENGTHS[r]; c++) {
                    if (simBoard[r][c] !== EMPTY) {
                        // Check if encircled
                        let encircled = true;
                        const neighbors = getNeighbors(r, c);
                        for (const n of neighbors) {
                            if (simBoard[n.r][n.c] === EMPTY) {
                                encircled = false;
                                break;
                            }
                        }

                        // Check if should be removed
                        if (encircled) {
                            const stoneOwner = simBoard[r][c];
                            const opponent = stoneOwner === PLAYER_1 ? PLAYER_2 : PLAYER_1;
                            let friendlyCount = 0;
                            let opponentCount = 0;
                            for (const n of neighbors) {
                                if (simBoard[n.r][n.c] === stoneOwner) friendlyCount++;
                                else if (simBoard[n.r][n.c] === opponent) opponentCount++;
                            }
                            if (opponentCount > friendlyCount) {
                                stonesToRemove.push({ r, c });
                            }
                        }
                    }
                }
            }

            if (stonesToRemove.length > 0) {
                simChanged = true;
                stonesToRemove.forEach(st => {
                    simBoard[st.r][st.c] = EMPTY;
                });
            }
        }

        let bAfter = 0, wAfter = 0;
        simBoard.forEach(row => row.forEach(val => {
            if (val === PLAYER_2) bAfter++;
            if (val === PLAYER_1) wAfter++;
        }));

        const wLost = wBefore - wAfter;
        const bLost = bBefore - bAfter;

        // Big penalty for losing stones, big bonus for capturing
        score += wLost * 1000;
        score -= bLost * 2000; // Penalize losing own stones more

        // Secondary heuristic: Positional
        // Prefer having stones centrally located or forming clusters
        // Rough center is (4, 4)
        const distFromCenter = Math.abs(r2 - 4) + Math.abs(c2 - 4);
        score -= distFromCenter * 2;

        // Loop Prevention: Penalize moving the same stone too many times in a row
        if (aiLastMovedStone &&
            aiLastMovedStone.r === r1 &&
            aiLastMovedStone.c === c1) {
            if (aiConsecutiveMoveCount >= 2) score -= 300;
            else if (aiConsecutiveMoveCount >= 1) score -= 50;
        }

        // Add random tiebreaker
        score += Math.random() * 5;

        return score;
    };

    possibleActions.forEach(action => {
        let score = simulateAndEvaluate(action);
        if (score > bestScore) {
            bestScore = score;
            bestAction = action;
        }
    });

    if (bestAction) {
        // Execute move
        // Update visual selection first for effect
        onCellClick(bestAction.from.r, bestAction.from.c);
        setTimeout(() => {
            onCellClick(bestAction.to.r, bestAction.to.c);
        }, 300);
    }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', initGame);
