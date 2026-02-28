// --- Core Game Logic ---
class SkyscraperGame {
    constructor(numPlayers = 2) {
        this.setMode(numPlayers);
    }

    setMode(numPlayers) {
        this.numPlayers = numPlayers;
        this.H = 9;
        this.wStart = numPlayers === 2 ? 5 : 0;
        this.gridSize = 2 * this.H + 5;
        this.colors = ['white', 'red', 'blue', 'green'].slice(0, numPlayers);
        this.totalPlayableCells = ((this.H - this.wStart) * 5 * 4) + (5 * 5); // 4 sides + roof
        this.winThreshold = Math.floor(this.totalPlayableCells / this.numPlayers) + 1;
        this.onStateChange = null;
        this.reset();
    }

    reset() {
        this.grid = new Array(this.gridSize).fill(null).map(() => new Array(this.gridSize).fill(null));
        this.turnIndex = 0;
        this.turn = this.colors[0];
        this.gameOver = false;
        this.lastMove = null;
        this.scores = {};
        this.colors.forEach(c => this.scores[c] = 0);

        const H = this.H;
        const ws = this.wStart;
        this.setGlobally(H + 2, ws, this.colors[0]); // North (White)
        if (this.numPlayers >= 2) this.setGlobally(H + 2, 2 * H + 4 - ws, this.colors[1]); // South (Red)
        if (this.numPlayers >= 3) this.setGlobally(2 * H + 4 - ws, H + 2, this.colors[2]); // East (Blue)
        if (this.numPlayers >= 4) this.setGlobally(ws, H + 2, this.colors[3]); // West (Green)

        this.updateValidMoves();
        this.updateScore();
        if (this.onStateChange) this.onStateChange();
    }

    isValidCell(x, y) {
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return false;
        const isX = x >= this.H && x <= this.H + 4, isY = y >= this.H && y <= this.H + 4;
        if (!(isX || isY)) return false;

        let w;
        if (isX && isY) return true; // center roof always valid
        if (isX && y < this.H) w = y;
        else if (isX && y > this.H + 4) w = (2 * this.H + 4) - y;
        else if (isY && x < this.H) w = x;
        else if (isY && x > this.H + 4) w = (2 * this.H + 4) - x;

        return w >= this.wStart;
    }

    getZone(x, y) {
        const H = this.H;
        if (x >= H && x <= H + 4 && y >= H && y <= H + 4) return 'center';
        if (x >= H && x <= H + 4 && y < H) return 'north';
        if (x >= H && x <= H + 4 && y > H + 4) return 'south';
        if (y >= H && y <= H + 4 && x < H) return 'west';
        if (y >= H && y <= H + 4 && x > H + 4) return 'east';
        return 'void';
    }

    get3DCoords(x, y) {
        const zone = this.getZone(x, y);
        const H = this.H;
        let u, v, w;
        if (zone === 'center') { u = x - H; v = y - H; w = H; }
        else if (zone === 'north') { u = x - H; v = 0; w = y; }
        else if (zone === 'south') { u = x - H; v = 4; w = (2 * H + 4) - y; }
        else if (zone === 'west') { u = 0; v = y - H; w = x; }
        else if (zone === 'east') { u = 4; v = y - H; w = (2 * H + 4) - x; }
        return { u, v, w };
    }

    get2DFrom3D(u, v, w) {
        const H = this.H;
        let cells = [];
        if (w === H) cells.push({ x: u + H, y: v + H });
        if (v === 0 && w < H) cells.push({ x: u + H, y: w });
        if (v === 4 && w < H) cells.push({ x: u + H, y: (2 * H + 4) - w });
        if (u === 0 && w < H) cells.push({ x: w, y: v + H });
        if (u === 4 && w < H) cells.push({ x: (2 * H + 4) - w, y: v + H });
        return cells.filter(c => this.isValidCell(c.x, c.y) && this.getZone(c.x, c.y) !== 'void');
    }

    setGlobally(x, y, color) {
        if (!this.isValidCell(x, y)) return;
        this.getSyncedCells(x, y).forEach(c => {
            if (this.isValidCell(c.x, c.y)) this.grid[c.x][c.y] = color;
        });
    }

    getSyncedCells(startX, startY) {
        const c3 = this.get3DCoords(startX, startY);
        return this.get2DFrom3D(c3.u, c3.v, c3.w);
    }

    get3DNeighbors(x, y) {
        return [];
    }

    updateValidMoves() {
        this.validMoves = [];
        const pColor = this.turn, pStones = [];
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                if (this.grid[x][y] === pColor) pStones.push({ x, y });
            }
        }
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                if (!this.isValidCell(x, y) || this.grid[x][y] !== null) continue;
                if (pStones.some(s => this.checkConnection(s, { x, y }) && !this.isPathBlocked(s, { x, y }))) {
                    this.validMoves.push({ x, y });
                }
            }
        }
    }

    checkConnection(s, t) {
        const s3 = this.get3DCoords(s.x, s.y), t3 = this.get3DCoords(t.x, t.y);
        let m = 0;
        if (s3.u === t3.u) m++; if (s3.v === t3.v) m++; if (s3.w === t3.w) m++;
        return m >= 2;
    }

    isPathBlocked(source, target) {
        const s3 = this.get3DCoords(source.x, source.y), t3 = this.get3DCoords(target.x, target.y);
        let du = t3.u - s3.u, dv = t3.v - s3.v, dw = t3.w - s3.w, steps = Math.max(Math.abs(du), Math.abs(dv), Math.abs(dw));
        if (steps <= 1) return false;

        for (let i = 1; i < steps; i++) {
            let u = Math.round(s3.u + (du / steps) * i);
            let v = Math.round(s3.v + (dv / steps) * i);
            let w = Math.round(s3.w + (dw / steps) * i);
            let cands = this.get2DFrom3D(u, v, w);
            for (let c of cands) {
                const cellColor = this.grid[c.x][c.y];
                if (cellColor !== null && cellColor !== this.turn) {
                    return true;
                }
            }
        }
        return false;
    }

    makeMove(x, y) {
        if (this.gameOver || !this.validMoves.some(m => m.x === x && m.y === y)) return false;
        this.lastMove = { x, y };
        this.setGlobally(x, y, this.turn);
        this.resolveLines(x, y);
        this.nextTurn();
        return true;
    }

    nextTurn() {
        this.turnIndex = (this.turnIndex + 1) % this.numPlayers;
        this.turn = this.colors[this.turnIndex];
        this.updateValidMoves();

        let maxScore = 0;
        for (let c of this.colors) {
            if (this.scores[c] > maxScore) maxScore = this.scores[c];
        }

        if (maxScore >= this.winThreshold) {
            this.gameOver = true;
        }

        if (!this.gameOver && this.validMoves.length === 0) {
            let skips = 1;
            while (skips < this.numPlayers) {
                this.turnIndex = (this.turnIndex + 1) % this.numPlayers;
                this.turn = this.colors[this.turnIndex];
                this.updateValidMoves();
                if (this.validMoves.length > 0) break;
                skips++;
            }
            if (skips === this.numPlayers) this.gameOver = true;
        }
        this.updateScore();
        if (this.onStateChange) this.onStateChange();

        if (!this.gameOver && this.aiDifficulty && this.turnIndex !== 0) { // AI controls non-white players
            setTimeout(() => {
                const move = SkyscraperAI.getMove(this, this.aiDifficulty);
                if (move) this.makeMove(move.x, move.y);
            }, 600);
        }
    }

    resolveLines(startX, startY) {
        const s3 = this.get3DCoords(startX, startY);
        const axes = ['u', 'v', 'w'];
        const triggerPlayer = this.turn;
        let captures = {};
        this.colors.forEach(c => captures[c] = new Set());
        let triggerWonByPlayer = false;

        axes.forEach(axis => {


            let chunkStart = Math.floor(s3[axis] / 5) * 5;
            let line = [];

            for (let i = chunkStart; i < chunkStart + 5; i++) {
                let coords = { ...s3 };
                coords[axis] = i;
                const cells = this.get2DFrom3D(coords.u, coords.v, coords.w);
                if (cells.length > 0) line.push(cells[0]);
            }

            if (line.length === 5) {
                let cellCounts = {};
                this.colors.forEach(c => cellCounts[c] = 0);
                let emptyCount = 0;

                line.forEach(c => {
                    const color = this.grid[c.x][c.y];
                    if (color) cellCounts[color]++;
                    else emptyCount++;
                });

                if (emptyCount === 0) {
                    let winner = null;
                    let maxCount = -1;
                    let tie = false;
                    for (let c of this.colors) {
                        if (cellCounts[c] > maxCount) {
                            maxCount = cellCounts[c];
                            winner = c;
                            tie = false;
                        } else if (cellCounts[c] === maxCount) {
                            tie = true;
                        }
                    }

                    if (!tie && winner) {
                        line.forEach(c => {
                            const key = `${c.x},${c.y}`;
                            captures[winner].add(key);
                        });
                        if (winner === triggerPlayer) triggerWonByPlayer = true;
                    }
                }
            }
        });

        for (let color of this.colors) {
            captures[color].forEach(key => {
                const [x, y] = key.split(',').map(Number);
                this.setGlobally(x, y, color);
            });
        }

        if (triggerWonByPlayer) {
            this.setGlobally(startX, startY, triggerPlayer);
        }
        this.updateScore();
    }

    updateScore() {
        this.colors.forEach(c => this.scores[c] = 0);
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                const c = this.grid[x][y];
                if (c) this.scores[c]++;
            }
        }
    }
}

class SkyscraperAI {
    static getMove(game, difficulty) {
        const moves = game.validMoves;
        if (moves.length === 0) return null;

        if (difficulty === 'easy') {
            return moves[Math.floor(Math.random() * moves.length)];
        }

        if (difficulty === 'medium' || difficulty === 'hard') {
            // Heuristic evaluation
            let bestMove = null;
            let bestScore = -Infinity;

            for (const move of moves) {
                let score = 0;

                // 1. Check if move completes a line (Greedy)
                if (this.wouldCompleteLine(game, move.x, move.y)) score += 100;

                // 2. Proximity to existing stones (Clustering)
                const distance = this.getMinDistanceToOwn(game, move.x, move.y);
                score += (10 - distance);

                // 3. Blocking opponent connections (Shadowing)
                if (this.isBlockingOpponent(game, move.x, move.y)) score += 50;

                if (difficulty === 'hard') {
                    // 4. Centrality (Roof is better usually)
                    const zone = game.getZone(move.x, move.y);
                    if (zone === 'center') score += 20;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
            }
            return bestMove || moves[0];
        }
        return moves[0];
    }

    static wouldCompleteLine(game, x, y) {
        const s3 = game.get3DCoords(x, y);
        const axes = ['u', 'v', 'w'];
        return axes.some(axis => {
            const len = axis === 'w' ? 7 : 5;
            let filled = 0;
            for (let i = 0; i < len; i++) {
                let coords = { ...s3 }; coords[axis] = i;
                const cells = game.get2DFrom3D(coords.u, coords.v, coords.w);
                if (cells.length > 0 && game.grid[cells[0].x][cells[0].y] !== null) filled++;
            }
            return filled === len - 1;
        });
    }

    static getMinDistanceToOwn(game, x, y) {
        let min = game.gridSize * 2;
        for (let ix = 0; ix < game.gridSize; ix++) {
            for (let iy = 0; iy < game.gridSize; iy++) {
                if (game.grid[ix][iy] === game.turn) {
                    const d = Math.abs(x - ix) + Math.abs(y - iy);
                    if (d < min) min = d;
                }
            }
        }
        return min;
    }

    static isBlockingOpponent(game, x, y) {
        const neighbors = [{ x: x + 1, y: y }, { x: x - 1, y: y }, { x: x, y: y + 1 }, { x: x, y: y - 1 }];
        return neighbors.some(n => n.x >= 0 && n.x < game.gridSize && n.y >= 0 && n.y < game.gridSize && game.grid[n.x][n.y] !== null && game.grid[n.x][n.y] !== game.turn);
    }
}

// --- 2D Implementation ---
class View2D {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.colors = { white: '#FDF5E6', red: '#FF4D4D', blue: '#0077FF', green: '#00FF00', structure: '#1A1A1A', neutral: '#1a1a1a', highlight: 'rgba(120, 90, 40, 0.4)', lastMove: 'rgba(255, 255, 0, 0.5)' };
    }
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height);
        this.canvas.width = size; this.canvas.height = size;
        this.cellSize = size / this.game.gridSize;
        this.draw();
    }
    draw() {
        if (!this.ctx) return;
        const ctx = this.ctx, c = this.cellSize;
        const H = this.game.H;
        const GS = this.game.gridSize;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = this.colors.structure;
        ctx.fillRect(H * c, 0, 5 * c, GS * c); ctx.fillRect(0, H * c, GS * c, 5 * c);
        for (let x = 0; x < GS; x++) {
            for (let y = 0; y < GS; y++) {
                const isStructural = (x >= H && x <= H + 4) || (y >= H && y <= H + 4);
                if (!isStructural) continue;

                const isValid = this.game.isValidCell(x, y);
                let state = this.game.grid[x][y], px = x * c, py = y * c;

                if (!isValid) {
                    ctx.fillStyle = '#080808'; // Very dark for non-playable areas
                    ctx.fillRect(px + 0.5, py + 0.5, c - 1, c - 1);
                    continue;
                }

                ctx.fillStyle = this.colors.neutral;
                if (state === 'white') { ctx.fillStyle = this.colors.white; ctx.shadowBlur = 10; ctx.shadowColor = this.colors.white; }
                else if (state === 'red') { ctx.fillStyle = this.colors.red; ctx.shadowBlur = 10; ctx.shadowColor = this.colors.red; }
                else if (state === 'blue') { ctx.fillStyle = this.colors.blue; ctx.shadowBlur = 10; ctx.shadowColor = this.colors.blue; }
                else if (state === 'green') { ctx.fillStyle = this.colors.green; ctx.shadowBlur = 10; ctx.shadowColor = this.colors.green; }
                else if (this.game.validMoves.some(m => m.x === x && m.y === y)) {
                    ctx.fillStyle = this.colors.highlight;
                    ctx.strokeStyle = 'rgba(138, 109, 59, 0.6)'; // Darker bronze border
                    ctx.strokeRect(px + 0.5, py + 0.5, c - 1, c - 1);
                }

                // Last Move Indicator
                if (this.game.lastMove && this.game.lastMove.x === x && this.game.lastMove.y === y) {
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = '#FFFF00';
                    ctx.strokeStyle = '#FFFF00';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(px + 2, py + 2, c - 4, c - 4);
                }

                ctx.fillRect(px + 0.5, py + 0.5, c - 1, c - 1);
                ctx.shadowBlur = 0;
            }
        }
        ctx.strokeStyle = 'rgba(197,160,89,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(this.game.H * c, this.game.H * c, 5 * c, 5 * c);
    }
}

// --- 3D Implementation ---
class View3D {
    constructor(container, game) {
        this.container = container;
        this.game = game;
        this.windowMeshes = new Map();
        this.init();
    }
    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x010101);
        this.scene.fog = new THREE.Fog(0x010101, 30, 200);
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        this.camera.position.set(20, 18, 20);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.container.appendChild(this.renderer.domElement);
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.target.set(0, 7, 0);
        // Limit rotation and zoom distance to preserve immersion
        this.controls.minDistance = 10;
        this.controls.maxDistance = 60;
        this.controls.maxPolarAngle = Math.PI * 0.48; // Prevent camera from going below ground level

        this.composer = new THREE.EffectComposer(this.renderer);
        this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
        const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.2;
        bloomPass.strength = 1.5;
        bloomPass.radius = 0.6;
        this.composer.addPass(bloomPass);

        this.scene.add(new THREE.AmbientLight(0x88aacc, 0.55)); // Brighter moonlight ambient

        // Add a warm city glow from below for environmental scale
        const hemi = new THREE.HemisphereLight(0x88aacc, 0x443322, 0.8);
        this.scene.add(hemi);

        const moon = new THREE.DirectionalLight(0x7799bb, 1.6);
        moon.position.set(30, 40, -20);
        const moonTarget = new THREE.Object3D();
        moonTarget.position.set(0, 5, 0);
        this.scene.add(moonTarget);
        moon.target = moonTarget;
        this.scene.add(moon);

        const fillLight = new THREE.DirectionalLight(0x444466, 1.2);
        fillLight.position.set(-30, 20, 30);
        const fillTarget = new THREE.Object3D();
        fillTarget.position.set(0, 5, 0);
        this.scene.add(fillTarget);
        fillLight.target = fillTarget;
        this.scene.add(fillLight);

        const cityLight1 = new THREE.PointLight(0xffaa44, 2.5, 150);
        cityLight1.position.set(25, 2, 25);
        this.scene.add(cityLight1);

        const cityLight2 = new THREE.PointLight(0x4488ff, 1.8, 120);
        cityLight2.position.set(-25, 3, -25);
        this.scene.add(cityLight2);

        this.createSkyscraper();
        this.createCityGrid();
        this.createCityBackground();
        this.createRain();
        this.setupRaycaster();
        this.setupKeyboard();
        this.running = true;
        this.animate();
    }
    destroy() {
        this.running = false;
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
    }
    setupKeyboard() {
        this.keys = {};
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }
    createRain() {
        const count = 3000;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i += 3) {
            pos[i] = Math.random() * 80 - 40;
            pos[i + 1] = Math.random() * 100 - 20;
            pos[i + 2] = Math.random() * 80 - 40;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.1, transparent: true, opacity: 0.4 }));
        this.scene.add(this.rain);
    }
    updateRain() {
        const pos = this.rain.geometry.attributes.position.array;
        for (let i = 0; i < pos.length; i += 3) {
            pos[i + 1] -= 0.8;
            if (pos[i + 1] < -20) pos[i + 1] = 80;
        }
        this.rain.geometry.attributes.position.needsUpdate = true;
    }
    createCityGrid() {
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0x010101, roughness: 0.6, metalness: 0.6, clearcoat: 0.1, clearcoatRoughness: 0.8
        });

        // Add a ground plane for the chessboard streets
        const groundGeo = new THREE.PlaneGeometry(300, 300);
        const groundMat = new THREE.MeshPhysicalMaterial({ color: 0x010101, roughness: 0.9, metalness: 0.1 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01; // Ground level
        this.scene.add(ground);

        // Chessboard street lines - NYC style
        const streetSpread = 150;
        const streetStep = 8.0;
        for (let i = -streetSpread; i <= streetSpread; i += streetStep) {
            const lineXGeo = new THREE.PlaneGeometry(0.15, 300);
            const lineX = new THREE.Mesh(lineXGeo, new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.25 }));
            lineX.rotation.x = -Math.PI / 2;
            lineX.position.set(i, 0.0, 0);
            this.scene.add(lineX);

            const lineZGeo = new THREE.PlaneGeometry(300, 0.15);
            const lineZ = new THREE.Mesh(lineZGeo, new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.25 }));
            lineZ.rotation.x = -Math.PI / 2;
            lineZ.position.set(0, 0.0, i);
            this.scene.add(lineZ);
        }

        // Abstract New York Chessboard Blocks
        const spread = 120;
        const blockSize = 6.0;
        const streetW = 2.0;
        const step = blockSize + streetW;

        const decoWindowMat = new THREE.MeshBasicMaterial({ color: 0x998844 });

        for (let x = -spread; x <= spread; x += step) {
            for (let z = -spread; z <= spread; z += step) {
                // Keep clear of the main skyscraper base
                if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

                const h = Math.random() * 4 + 1.0;
                const b = new THREE.Mesh(new THREE.BoxGeometry(blockSize, h, blockSize), mat);
                b.position.set(x, h / 2, z); // Starts from the street level
                this.scene.add(b);

                // Add tiny emissive windows on background buildings for life
                if (Math.random() > 0.4) {
                    const winH = Math.random() * (h - 0.2) + 0.1;
                    const win = new THREE.Mesh(new THREE.BoxGeometry(blockSize + 0.05, 0.1, blockSize + 0.05), decoWindowMat);
                    win.position.set(x, winH, z);
                    this.scene.add(win);
                }

                if (Math.random() > 0.4) {
                    const h2 = Math.random() * 3 + 1.0;
                    const b2 = new THREE.Mesh(new THREE.BoxGeometry(blockSize * 0.7, h2, blockSize * 0.7), mat);
                    b2.position.set(x, h + h2 / 2, z);

                    if (Math.random() > 0.5) {
                        const winH2 = h + Math.random() * (h2 - 0.2) + 0.1;
                        const win2 = new THREE.Mesh(new THREE.BoxGeometry(blockSize * 0.7 + 0.05, 0.1, blockSize * 0.7 + 0.05), decoWindowMat);
                        win2.position.set(x, winH2, z);
                        this.scene.add(win2);
                    }
                    this.scene.add(b2);
                }
            }
        }
    }

    createCityBackground() {
        const loader = new THREE.TextureLoader();
        loader.load('skyscraper-bg.png', (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.repeat.set(4, 1);

            // Large cylinder surrounding the playable area
            const geometry = new THREE.CylinderGeometry(150, 150, 80, 48);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide,
                transparent: true,
                opacity: 0.95,
                fog: false
            });
            const city = new THREE.Mesh(geometry, material);
            city.position.y = 10;
            this.scene.add(city);
        });
    }
    createSkyscraper() {
        const classicMat = new THREE.MeshPhysicalMaterial({
            color: 0x050505, roughness: 0.05, metalness: 0.8, clearcoat: 1.0, clearcoatRoughness: 0.05
        });
        const solidBaseMat = new THREE.MeshPhysicalMaterial({
            color: 0x050505, roughness: 0.2, metalness: 0.9, clearcoat: 1.0, clearcoatRoughness: 0.1
        });
        const decoMat = new THREE.MeshPhysicalMaterial({
            color: 0xC5A059, metalness: 1.0, roughness: 0.1, emissive: 0xC5A059, emissiveIntensity: 0.3
        });

        const H = this.game.H;
        for (let u = 0; u < 5; u++) {
            for (let v = 0; v < 5; v++) {
                for (let w = 0; w <= H; w++) {
                    if (u > 0 && u < 4 && v > 0 && v < 4 && w < H) continue;

                    if (w < this.game.wStart) {
                        const solid = new THREE.Mesh(new THREE.BoxGeometry(0.992, 0.992, 0.992), solidBaseMat);
                        solid.position.set(u - 2, w + 3.51, v - 2);
                        this.scene.add(solid);
                        continue;
                    }
                    const block = new THREE.Mesh(new THREE.BoxGeometry(0.992, 0.992, 0.992), classicMat);
                    block.position.set(u - 2, w + 3.51, v - 2);
                    block.userData = { u, v, w };
                    this.scene.add(block);
                    this.addWindows(u, v, w, block);
                }
            }
        }

        // Solid Core to prevent "lookthrough" - now styled black like physical game
        const core = new THREE.Mesh(new THREE.BoxGeometry(3, H + 1, 3), solidBaseMat);
        core.position.set(0, (H + 1) / 2 + 3.0, 0);
        this.scene.add(core);

        // Subtle NYC metallic stand with Art Deco stepped corners matching the physical model
        const standBody = new THREE.Mesh(new THREE.BoxGeometry(5.0, 3.0, 5.0), solidBaseMat);
        standBody.position.set(0, 1.5, 0); // Center at 1.5, height from 0 to 3.0
        this.scene.add(standBody);

        // Add the 4 thicker pillars stepping outwards at the exact corners
        for (let x of [-2.4, 2.4]) {
            for (let z of [-2.4, 2.4]) {
                const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 1.2), solidBaseMat);
                pillar.position.set(x, 1.0, z); // Center 1.0, height from 0 to 2.0 (extends outwards by 0.5 units)
                this.scene.add(pillar);

                const basePillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), solidBaseMat);
                basePillar.position.set(x, 0.3, z); // Step down slightly wider at the bottom
                this.scene.add(basePillar);
            }
        }

        const standTrim = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.4, 6.6), solidBaseMat);
        standTrim.position.set(0, -0.2, 0);
        this.scene.add(standTrim);

        // Update Spire/Sting to be extremely thin so center field is mostly visible
        const spH = H * 1.5;
        const sp1y = H + 3.51 + 0.5 + 2.5;
        const sp1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.25, 5, 8), solidBaseMat);
        sp1.position.set(0, sp1y, 0);
        this.scene.add(sp1);

        const sp2 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.08, spH, 8), solidBaseMat);
        sp2.position.set(0, sp1y + 2.5 + spH / 2, 0);
        this.scene.add(sp2);

        // Optional sharp sting ring on the needle
        const spRing = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 16), solidBaseMat);
        spRing.position.set(0, sp1y + 2.5 + spH * 0.7, 0);
        spRing.rotation.x = Math.PI / 2;
        this.scene.add(spRing);

        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), new THREE.MeshBasicMaterial({ color: 0x111111 }));
        beacon.position.set(0, 21.5, 0); this.scene.add(beacon);
        const light = new THREE.PointLight(0xffffff, 0, 40);
        light.position.copy(beacon.position); this.scene.add(light);
        this.beacon = beacon;
        this.beaconLight = light;
    }
    addMassiveBase(bodyMat, decoMat) {
        // Tier ends where core begins (y=3.5 - 0.5 = 3.0)
        this.createBlockStack(-4.5, 4.5, -4, 3.0, bodyMat, decoMat, true);

        const baseSize = 8;
        const baseDepth = -150;
        this.createBlockStack(-baseSize, baseSize, baseDepth, -4, bodyMat, decoMat, true);
    }
    createBlockStack(uRange, vRange, wStart, wEnd, bodyMat, decoMat, addDecoWindows) {
        const winMat = new THREE.MeshPhysicalMaterial({
            color: 0xFFF5E1, emissive: 0xFFF5E1, emissiveIntensity: 2.5, transparent: true, opacity: 1.0
        });
        const h = wEnd - wStart;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry((uRange * 2) + 1, h, (vRange * 2) + 1), bodyMat);
        mesh.position.set(0, wStart + h / 2, 0);
        this.scene.add(mesh);
        if (addDecoWindows) {
            for (let w = -h / 2 + 2; w < h / 2 - 2; w += 4) {
                for (let i = -uRange + 1; i <= uRange - 1; i += 3) {
                    this.addStaticWindow(mesh, i, w, (vRange + 0.51), 0, 0, winMat);
                    this.addStaticWindow(mesh, i, w, -(vRange + 0.51), 0, Math.PI, winMat);
                    this.addStaticWindow(mesh, (uRange + 0.51), w, i, 0, Math.PI / 2, winMat);
                    this.addStaticWindow(mesh, -(uRange + 0.51), w, i, 0, -Math.PI / 2, winMat);
                }
            }
        }
    }
    addStaticWindow(parent, x, y, z, rx, ry, mat) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), mat);
        win.position.set(x, y, z); win.rotation.set(rx, ry, 0); parent.add(win);
        const interior = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.6), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }));
        interior.position.z = -0.01; win.add(interior);
    }
    addWindows(u, v, w, parent) {
        const mat = () => new THREE.MeshPhysicalMaterial({
            color: 0x111111, metalness: 0.5, roughness: 0.1,
            transparent: false, opacity: 1.0, side: THREE.FrontSide,
            emissive: 0x000000, emissiveIntensity: 0
        });
        const key = `${u},${v},${w}`;
        if (!this.windowMeshes.has(key)) this.windowMeshes.set(key, []);
        const addW = (px, py, pz, rx, ry) => {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), mat());
            win.position.set(px, py, pz); win.rotation.set(rx, ry, 0); win.userData = { u, v, w };
            parent.add(win); this.windowMeshes.get(key).push(win);
            const interior = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ color: 0xFFF5E1, transparent: true, opacity: 0.3 }));
            interior.position.z = -0.05; win.add(interior);
        };
        if (w === this.game.H) addW(0, 0.501, 0, -Math.PI / 2, 0);
        if (u === 0) addW(-0.501, 0, 0, 0, -Math.PI / 2);
        if (u === 4) addW(0.501, 0, 0, 0, Math.PI / 2);
        if (v === 0) addW(0, 0, -0.501, 0, Math.PI);
        if (v === 4) addW(0, 0, 0.501, 0, 0);
    }
    setupRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredKey = null;
        let isDragging = false;
        let startPos = { x: 0, y: 0 };

        const getTarget = (clientX, clientY) => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children, true);
            const hit = intersects.find(i => i.object.userData && i.object.userData.u !== undefined);
            return hit ? hit.object.userData : null;
        };

        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            isDragging = false;
            startPos = { x: e.clientX, y: e.clientY };
        });

        this.renderer.domElement.addEventListener('pointermove', (e) => {
            if (Math.abs(e.clientX - startPos.x) > 5 || Math.abs(e.clientY - startPos.y) > 5) {
                isDragging = true;
            }
            const data = getTarget(e.clientX, e.clientY);
            const newKey = data ? `${data.u},${data.v},${data.w}` : null;
            if (this.hoveredKey !== newKey) {
                this.hoveredKey = newKey;
                this.update();
            }
        });

        this.renderer.domElement.addEventListener('pointerup', (e) => {
            if (isDragging) return;
            const data = getTarget(e.clientX, e.clientY);
            if (data) {
                const { u, v, w } = data;
                const cells = this.game.get2DFrom3D(u, v, w);
                const move = cells.find(c => this.game.validMoves.some(m => m.x === c.x && m.y === c.y));
                if (move) {
                    this.game.makeMove(move.x, move.y);
                }
            }
        });
    }
    update() {
        // Update Beacon Lead Indicator
        const diff = this.game.scores.white - this.game.scores.red;
        if (Math.abs(diff) <= 1) {
            this.beacon.material.color.setHex(0x111111);
            this.beaconLight.intensity = 0;
        } else if (diff > 1) {
            this.beacon.material.color.setHex(0xFFFFFF);
            this.beaconLight.color.setHex(0xFFFFFF);
            this.beaconLight.intensity = 1.0; // Minimal glow as requested
        } else {
            this.beacon.material.color.setHex(0xFF0000);
            this.beaconLight.color.setHex(0xFF0000);
            this.beaconLight.intensity = 1.5; // Minimal red glow
        }

        this.windowMeshes.forEach((meshes, key) => {
            const [u, v, w] = key.split(',').map(Number);
            const cells = this.game.get2DFrom3D(u, v, w);
            let color = 0x111111, glow = false, intensity = 0;
            const isValid = this.game.validMoves.some(m => cells.some(c => c.x === m.x && c.y === m.y));
            const isHovered = this.hoveredKey === key;

            if (cells.some(c => this.game.grid[c.x][c.y] === 'white')) { color = 0xFFFFFF; glow = true; intensity = 2.5; }
            else if (cells.some(c => this.game.grid[c.x][c.y] === 'red')) { color = 0xFF0000; glow = true; intensity = 2.5; }
            else if (cells.some(c => this.game.grid[c.x][c.y] === 'blue')) { color = 0x0077FF; glow = true; intensity = 2.5; }
            else if (cells.some(c => this.game.grid[c.x][c.y] === 'green')) { color = 0x00FF00; glow = true; intensity = 2.5; }
            else if (isValid) {
                const hoverColor = this.game.turn === 'white' ? 0xFFFFFF : (this.game.turn === 'red' ? 0xFF7777 : (this.game.turn === 'blue' ? 0x77CCFF : 0x77FF77));
                color = isHovered ? hoverColor : 0x8A6D3B; // Darker gold/bronze
                intensity = isHovered ? 2.0 : 0.3; // Much lower idle glow
                glow = true;
            }

            // Highlight Last Move
            const isLastMove = this.game.lastMove && cells.some(c => c.x === this.game.lastMove.x && c.y === this.game.lastMove.y);
            if (isLastMove) {
                glow = true;
                intensity = 5.0; // Extra glow for last move
            }

            meshes.forEach(m => {
                m.material.color.setHex(glow ? color : (isValid ? color : 0x111111));
                if (glow || isValid) {
                    m.material.emissive.setHex(color);
                    m.material.emissiveIntensity = intensity;
                } else {
                    m.material.emissive.setHex(0x000000);
                    m.material.emissiveIntensity = 0;
                }
                m.material.opacity = (glow || isValid) ? 1.0 : 0.9;
            });
        });
    }
    resize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }
    animate() {
        if (!this.running) return;
        requestAnimationFrame(() => this.animate());

        // Camera Controls (WASD + Arrows)
        const rotSpeed = 0.03;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) this.controls.rotateUp(rotSpeed);
        if (this.keys['KeyS'] || this.keys['ArrowDown']) this.controls.rotateUp(-rotSpeed);
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.controls.rotateLeft(rotSpeed);
        if (this.keys['KeyD'] || this.keys['ArrowRight']) this.controls.rotateLeft(-rotSpeed);

        this.controls.update();
        this.updateRain();
        this.composer.render();
    }
}

// --- App Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
    const game = new SkyscraperGame();
    let v2d = new View2D(document.getElementById('canvas2d'), game);
    let v3d = new View3D(document.getElementById('canvas3d'), game);

    const modeBtn = document.getElementById('mode-btn');
    const modeMenu = document.getElementById('mode-menu');
    modeBtn.onclick = () => modeMenu.classList.toggle('visible');

    modeMenu.querySelectorAll('button').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const players = parseInt(btn.getAttribute('data-players'), 10);
            game.setMode(players);
            modeBtn.textContent = players + ' Players';
            modeMenu.classList.remove('visible');

            document.getElementById('score-block-blue').style.display = players >= 3 ? 'flex' : 'none';
            document.getElementById('score-block-green').style.display = players >= 4 ? 'flex' : 'none';

            if (v3d) v3d.destroy();
            v3d = new View3D(document.getElementById('canvas3d'), game);
            v2d.resize();
            v3d.resize();
            if (game.onStateChange) game.onStateChange();
        };
    });

    game.onStateChange = () => {
        ['white', 'red', 'blue', 'green'].forEach(c => {
            const elScore = document.getElementById('score-' + c);
            const elTurn = document.getElementById('turn-' + c);
            if (elScore) elScore.textContent = game.scores[c] || 0;
            if (elTurn) elTurn.style.opacity = game.turn === c ? '1' : '0.2';
        });
        v2d.draw(); v3d.update();
        if (game.gameOver) {
            let winColor = 'white';
            let maxSc = -1;
            ['white', 'red', 'blue', 'green'].forEach(c => {
                if (game.scores[c] > maxSc) { maxSc = game.scores[c]; winColor = c; }
            });
            document.getElementById('msg-title').textContent = winColor.toUpperCase() + ' VICTORIOUS';
            document.getElementById('msg-body').textContent = `Winning Score: ${maxSc}`;
            document.getElementById('message-modal').style.display = 'flex';
        }
    };

    document.getElementById('menu-trigger').onclick = () => {
        const trigger = document.getElementById('menu-trigger');
        const header = document.getElementById('main-header');
        const hud = document.getElementById('hud');
        trigger.classList.toggle('active');
        header.classList.toggle('visible');
        hud.classList.toggle('visible');
    };

    const aiBtn = document.getElementById('ai-btn');
    const aiMenu = document.getElementById('ai-menu');
    aiBtn.onclick = () => aiMenu.classList.toggle('visible');

    aiMenu.querySelectorAll('button').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const diff = btn.getAttribute('data-diff');
            game.aiDifficulty = diff === 'none' ? null : diff;
            aiBtn.textContent = 'Opponent: ' + btn.textContent;
            aiMenu.classList.remove('visible');
            game.reset();
        };
    });

    document.getElementById('toggle-2d').onclick = () => {
        document.getElementById('canvas2d').style.display = 'block';
        document.getElementById('canvas3d').style.display = 'none';
        document.getElementById('toggle-2d').classList.add('active');
        document.getElementById('toggle-3d').classList.remove('active');
        v2d.resize();
    };
    document.getElementById('toggle-3d').onclick = () => {
        document.getElementById('canvas2d').style.display = 'none';
        document.getElementById('canvas3d').style.display = 'block';
        document.getElementById('toggle-2d').classList.remove('active');
        document.getElementById('toggle-3d').classList.add('active');
        v3d.resize();
    };

    document.getElementById('canvas2d').onclick = (e) => {
        const rect = e.target.getBoundingClientRect();
        const GS = game.gridSize;
        const x = Math.floor(((e.clientX - rect.left) / rect.width) * GS);
        const y = Math.floor(((e.clientY - rect.top) / rect.height) * GS);
        if (x >= 0 && x < GS && y >= 0 && y < GS) {
            game.makeMove(x, y);
        }
    };

    document.getElementById('reset-btn').onclick = () => game.reset();
    document.getElementById('rules-btn').onclick = () => document.getElementById('rules-modal').style.display = 'flex';

    window.onresize = () => { v2d.resize(); v3d.resize(); };
    setTimeout(() => { v2d.resize(); v3d.resize(); game.onStateChange(); }, 100);
});
