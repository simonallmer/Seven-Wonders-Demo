// --- Core Game Logic ---
class SkyscraperGame {
    constructor() {
        this.gridSize = 19;
        this.grid = new Array(this.gridSize).fill(null).map(() => new Array(this.gridSize).fill(null));
        this.turn = 'ivory';
        this.gameOver = false;
        this.scores = { ivory: 0, onyx: 0 };
        this.validMoves = [];
        this.onStateChange = null;
        this.totalPlayableCells = 164; // (165 total valid cells - 1 blocked center)
        this.winThreshold = 83; // Over half of 164
        this.reset();
    }

    reset() {
        this.grid = new Array(this.gridSize).fill(null).map(() => new Array(this.gridSize).fill(null));
        this.turn = 'ivory';
        this.gameOver = false;
        this.setGlobally(9, 0, 'ivory');
        this.setGlobally(9, 18, 'ivory');
        this.setGlobally(0, 9, 'onyx');
        this.setGlobally(18, 9, 'onyx');
        this.updateValidMoves();
        this.updateScore();
        if (this.onStateChange) this.onStateChange();
    }

    isValidCell(x, y) {
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return false;
        // Block center of the roof (x: 9, y: 9) to force alternate strategies
        if (x === 9 && y === 9) return false;
        const isX = x >= 7 && x <= 11, isY = y >= 7 && y <= 11;
        return isX || isY;
    }

    getZone(x, y) {
        if (x >= 7 && x <= 11 && y >= 7 && y <= 11) return 'center';
        if (x >= 7 && x <= 11 && y < 7) return 'north';
        if (x >= 7 && x <= 11 && y > 11) return 'south';
        if (y >= 7 && y <= 11 && x < 7) return 'west';
        if (y >= 7 && y <= 11 && x > 11) return 'east';
        return 'void';
    }

    get3DCoords(x, y) {
        const zone = this.getZone(x, y);
        let u, v, w;
        if (zone === 'center') { u = x - 7; v = y - 7; w = 6; }
        else if (zone === 'north') { u = x - 7; v = 0; w = y; }
        else if (zone === 'south') { u = x - 7; v = 4; w = 18 - y; }
        else if (zone === 'west') { u = 0; v = y - 7; w = x; }
        else if (zone === 'east') { u = 4; v = y - 7; w = 18 - x; }
        return { u, v, w };
    }

    get2DFrom3D(u, v, w) {
        let cells = [];
        if (w === 6) cells.push({ x: u + 7, y: v + 7 });
        if (v === 0) cells.push({ x: u + 7, y: w });
        if (v === 4) cells.push({ x: u + 7, y: 18 - w });
        if (u === 0) cells.push({ x: w, y: v + 7 });
        if (u === 4) cells.push({ x: 18 - w, y: v + 7 });
        return cells.filter(c => this.isValidCell(c.x, c.y) && this.getZone(c.x, c.y) !== 'void');
    }

    setGlobally(x, y, color) {
        this.getSyncedCells(x, y).forEach(c => {
            if (this.isValidCell(c.x, c.y)) this.grid[c.x][c.y] = color;
        });
    }

    getSyncedCells(startX, startY) {
        let queue = [{ x: startX, y: startY }], visited = new Set(), synced = [];
        while (queue.length > 0) {
            let curr = queue.pop(), key = `${curr.x},${curr.y}`;
            if (visited.has(key)) continue; visited.add(key); synced.push(curr);
            this.get3DNeighbors(curr.x, curr.y).forEach(n => { if (!visited.has(`${n.x},${n.y}`)) queue.push(n); });
        }
        return synced;
    }

    get3DNeighbors(x, y) {
        let n = [];
        if (y === 6 && (x >= 7 && x <= 11)) n.push({ x: x, y: 7 });
        if (y === 7 && (x >= 7 && x <= 11)) n.push({ x: x, y: 6 });
        if (y === 12 && (x >= 7 && x <= 11)) n.push({ x: x, y: 11 });
        if (y === 11 && (x >= 7 && x <= 11)) n.push({ x: x, y: 12 });
        if (x === 6 && (y >= 7 && y <= 11)) n.push({ x: 7, y: y });
        if (x === 7 && (y >= 7 && y <= 11)) n.push({ x: 6, y: y });
        if (x === 12 && (y >= 7 && y <= 11)) n.push({ x: 11, y: y });
        if (x === 11 && (y >= 7 && y <= 11)) n.push({ x: 12, y: y });
        if (x === 7 && y < 7) n.push({ x: y, y: 7 });
        if (y === 7 && x < 7) n.push({ x: 7, y: x });
        if (x === 11 && y < 7) n.push({ x: 18 - y, y: 7 });
        if (y === 7 && x > 11) n.push({ x: 11, y: 18 - x });
        if (x === 7 && y > 11) n.push({ x: 18 - y, y: 11 });
        if (y === 11 && x < 7) n.push({ x: 7, y: 18 - x });
        if (x === 11 && y > 11) n.push({ x: 18 - y, y: 11 });
        if (y === 11 && x > 11) n.push({ x: 11, y: x });
        return n;
    }

    updateValidMoves() {
        this.validMoves = [];
        const pColor = this.turn, pStones = [];
        for (let x = 0; x < 19; x++) {
            for (let y = 0; y < 19; y++) { if (this.grid[x][y] === pColor) pStones.push({ x, y }); }
        }
        for (let x = 0; x < 19; x++) {
            for (let y = 0; y < 19; y++) {
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
        const opponent = this.turn === 'ivory' ? 'onyx' : 'ivory';
        for (let i = 1; i < steps; i++) {
            let u = Math.round(s3.u + (du / steps) * i), v = Math.round(s3.v + (dv / steps) * i), w = Math.round(s3.w + (dw / steps) * i);
            let cands = this.get2DFrom3D(u, v, w);
            for (let c of cands) { if (this.grid[c.x] && this.grid[c.x][c.y] === opponent) return true; }
        }
        return false;
    }

    makeMove(x, y) {
        if (this.gameOver || !this.validMoves.some(m => m.x === x && m.y === y)) return false;
        this.setGlobally(x, y, this.turn);
        this.resolveLines(x, y);
        this.nextTurn();
        return true;
    }

    nextTurn() {
        const lastPlayer = this.turn;
        this.turn = this.turn === 'ivory' ? 'onyx' : 'ivory';
        this.updateValidMoves();

        // Check for new win condition: Over half of all fields occupied by one color
        if (this.scores.ivory >= this.winThreshold || this.scores.onyx >= this.winThreshold) {
            this.gameOver = true;
        }

        if (!this.gameOver && this.validMoves.length === 0) {
            this.turn = this.turn === 'ivory' ? 'onyx' : 'ivory';
            this.updateValidMoves();
            if (this.validMoves.length === 0) this.gameOver = true;
        }
        this.updateScore();
        if (this.onStateChange) this.onStateChange();

        // AI Turn
        if (!this.gameOver && this.aiDifficulty && this.turn === 'onyx') {
            setTimeout(() => {
                const move = SkyscraperAI.getMove(this, this.aiDifficulty);
                if (move) this.makeMove(move.x, move.y);
            }, 600);
        }
    }

    resolveLines(startX, startY) {
        // We evaluate all three axes for the trigger stone.
        // Rule: If you close multiple lines, you get those you won majority in.
        // Importantly, the trigger stone stays your color if you won ANY of those lines.

        const s3 = this.get3DCoords(startX, startY);
        const axes = ['u', 'v', 'w'];
        const triggerPlayer = this.turn;

        let ivoryCaptures = new Set();
        let onyxCaptures = new Set();
        let triggerWonByPlayer = false;

        axes.forEach(axis => {
            let line = [];
            const lineLength = (axis === 'w' ? 7 : 5);

            for (let i = 0; i < lineLength; i++) {
                let coords = { ...s3 };
                coords[axis] = i;
                const cells = this.get2DFrom3D(coords.u, coords.v, coords.w);
                if (cells.length > 0) line.push(cells[0]);
            }

            if (line.length === lineLength) {
                let ivoryCount = 0, onyxCount = 0, isFull = true;
                line.forEach(c => {
                    const color = this.grid[c.x][c.y];
                    if (!color) isFull = false;
                    if (color === 'ivory') ivoryCount++;
                    else if (color === 'onyx') onyxCount++;
                });

                if (isFull && ivoryCount !== onyxCount) {
                    const winner = ivoryCount > onyxCount ? 'ivory' : 'onyx';
                    line.forEach(c => {
                        const key = `${c.x},${c.y}`;
                        if (winner === 'ivory') ivoryCaptures.add(key);
                        else onyxCaptures.add(key);
                    });
                    if (winner === triggerPlayer) triggerWonByPlayer = true;
                }
            }
        });

        // Apply captures
        ivoryCaptures.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            this.setGlobally(x, y, 'ivory');
        });
        onyxCaptures.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            this.setGlobally(x, y, 'onyx');
        });

        // Invincible trigger stone: if you won at least one line, the stone you placed stays yours
        if (triggerWonByPlayer) {
            this.setGlobally(startX, startY, triggerPlayer);
        }
    }

    updateScore() {
        let i = 0, o = 0;
        for (let x = 0; x < 19; x++) { for (let y = 0; y < 19; y++) { if (this.grid[x][y] === 'ivory') i++; else if (this.grid[x][y] === 'onyx') o++; } }
        this.scores = { ivory: i, onyx: o };
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
        let min = 20;
        for (let ix = 0; ix < 19; ix++) {
            for (let iy = 0; iy < 19; iy++) {
                if (game.grid[ix][iy] === 'onyx') {
                    const d = Math.abs(x - ix) + Math.abs(y - iy);
                    if (d < min) min = d;
                }
            }
        }
        return min;
    }

    static isBlockingOpponent(game, x, y) {
        // Simple check: are we next to an ivory stone
        const neighbors = [{ x: x + 1, y: y }, { x: x - 1, y: y }, { x: x, y: y + 1 }, { x: x, y: y - 1 }];
        return neighbors.some(n => n.x >= 0 && n.x < 19 && n.y >= 0 && n.y < 19 && game.grid[n.x][n.y] === 'ivory');
    }
}

// --- 2D Implementation ---
class View2D {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.colors = { ivory: '#FDF5E6', onyx: '#FF4D4D', structure: '#1A1A1A', neutral: '#1a1a1a', highlight: 'rgba(197, 160, 89, 0.3)' };
    }
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height);
        this.canvas.width = size; this.canvas.height = size;
        this.cellSize = size / 19;
        this.draw();
    }
    draw() {
        if (!this.ctx) return;
        const ctx = this.ctx, c = this.cellSize;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = this.colors.structure;
        ctx.fillRect(7 * c, 0, 5 * c, 19 * c); ctx.fillRect(0, 7 * c, 19 * c, 5 * c);
        for (let x = 0; x < 19; x++) {
            for (let y = 0; y < 19; y++) {
                // Special styling for inaccessible center cell
                if (x === 9 && y === 9) {
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(x * c + 2, y * c + 2, c - 4, c - 4);
                    ctx.strokeStyle = '#C5A059';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x * c + 8, y * c + 8, c - 16, c - 16);
                    continue;
                }
                if (!this.game.isValidCell(x, y)) continue;
                const state = this.game.grid[x][y], px = x * c, py = y * c;
                ctx.fillStyle = this.colors.neutral;
                if (state === 'ivory') { ctx.fillStyle = this.colors.ivory; ctx.shadowBlur = 10; ctx.shadowColor = this.colors.ivory; }
                else if (state === 'onyx') { ctx.fillStyle = this.colors.onyx; ctx.shadowBlur = 10; ctx.shadowColor = this.colors.onyx; }
                else if (this.game.validMoves.some(m => m.x === x && m.y === y)) {
                    ctx.fillStyle = this.colors.highlight;
                    ctx.strokeStyle = 'rgba(197,160,89,0.5)';
                    ctx.strokeRect(px + 0.5, py + 0.5, c - 1, c - 1);
                }
                ctx.fillRect(px + 0.5, py + 0.5, c - 1, c - 1);
                ctx.shadowBlur = 0;
            }
        }
        ctx.strokeStyle = 'rgba(197,160,89,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(7 * c, 7 * c, 5 * c, 5 * c);
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
        // Limit zoom distance to preserve immersion
        this.controls.minDistance = 10;
        this.controls.maxDistance = 60;

        this.composer = new THREE.EffectComposer(this.renderer);
        this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
        const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.2;
        bloomPass.strength = 1.5;
        bloomPass.radius = 0.6;
        this.composer.addPass(bloomPass);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(10, 20, 10);
        this.scene.add(sun);

        this.createSkyscraper();
        this.createCityBackground();
        this.createRain();
        this.setupRaycaster();
        this.setupKeyboard();
        this.animate();
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
    createCityBackground() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#010101';
        ctx.fillRect(0, 0, 1024, 512);
        for (let i = 0; i < 500; i++) {
            const x = Math.random() * 1024, y = 300 + Math.random() * 212;
            const size = Math.random() * 10 + 5, opacity = Math.random() * 0.5 + 0.1;
            const col = ['255, 220, 150', '150, 220, 255', '255, 255, 255'][Math.floor(Math.random() * 3)];
            const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
            grad.addColorStop(0, `rgba(${col}, ${opacity})`);
            grad.addColorStop(1, `rgba(${col}, 0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(x - size, y - size, size * 2, size * 2);
        }
        this.cityTexture = new THREE.CanvasTexture(canvas);
        this.cityTexture.wrapS = THREE.RepeatWrapping; this.cityTexture.repeat.set(2, 1);
        const city = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 24), new THREE.MeshBasicMaterial({ map: this.cityTexture, side: THREE.BackSide, transparent: true, opacity: 0.8, fog: false }));
        city.position.y = -20;
        this.scene.add(city);
    }
    createSkyscraper() {
        const bodyMat = new THREE.MeshPhysicalMaterial({
            color: 0x050505, roughness: 0.05, metalness: 0.8, clearcoat: 1.0, clearcoatRoughness: 0.05
        });
        const decoMat = new THREE.MeshPhysicalMaterial({
            color: 0xC5A059, metalness: 1.0, roughness: 0.1, emissive: 0xC5A059, emissiveIntensity: 0.3
        });

        for (let u = 0; u < 5; u++) {
            for (let v = 0; v < 5; v++) {
                for (let w = 0; w <= 6; w++) {
                    if (u > 0 && u < 4 && v > 0 && v < 4 && w < 6) continue;
                    // Prevent rendering window at the blocked center of the roof
                    if (u === 2 && v === 2 && w === 6) continue;
                    const block = new THREE.Mesh(new THREE.BoxGeometry(0.992, 0.992, 0.992), bodyMat);
                    block.position.set(u - 2, w + 3.51, v - 2);
                    block.userData = { u, v, w };
                    this.scene.add(block);
                    this.addWindows(u, v, w, block);
                }
            }
        }

        // Solid Core to prevent "lookthrough"
        const core = new THREE.Mesh(new THREE.BoxGeometry(3, 7, 3), bodyMat);
        core.position.set(0, 6.5, 0);
        this.scene.add(core);

        this.addMassiveBase(bodyMat, decoMat);

        const sp1 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.0, 5, 4), bodyMat);
        sp1.position.set(0, 10.5, 0); sp1.rotation.y = Math.PI / 4;
        this.scene.add(sp1);
        const sp2 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.5, 10, 4), bodyMat);
        sp2.position.set(0, 16.5, 0); sp2.rotation.y = Math.PI / 4;
        this.scene.add(sp2);

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
        if (w === 6) addW(0, 0.501, 0, -Math.PI / 2, 0);
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
        const diff = this.game.scores.ivory - this.game.scores.onyx;
        if (Math.abs(diff) <= 1) {
            this.beacon.material.color.setHex(0x111111);
            this.beaconLight.intensity = 0;
        } else if (diff > 1) {
            this.beacon.material.color.setHex(0xFFFFFF);
            this.beaconLight.color.setHex(0xFFFFFF);
            this.beaconLight.intensity = 8;
        } else {
            this.beacon.material.color.setHex(0xFF0000);
            this.beaconLight.color.setHex(0xFF0000);
            this.beaconLight.intensity = 8;
        }

        this.windowMeshes.forEach((meshes, key) => {
            const [u, v, w] = key.split(',').map(Number);
            const cells = this.game.get2DFrom3D(u, v, w);
            let color = 0x111111, glow = false, intensity = 0;
            const isValid = this.game.validMoves.some(m => cells.some(c => c.x === m.x && c.y === m.y));
            const isHovered = this.hoveredKey === key;

            if (cells.some(c => this.game.grid[c.x][c.y] === 'ivory')) { color = 0xFFFFFF; glow = true; intensity = 2.5; }
            else if (cells.some(c => this.game.grid[c.x][c.y] === 'onyx')) { color = 0xFF0000; glow = true; intensity = 2.5; }
            else if (isValid) {
                const hoverColor = this.game.turn === 'ivory' ? 0xFFFFFF : 0xFF0000;
                color = isHovered ? hoverColor : 0xC5A059;
                intensity = isHovered ? 2.0 : 0; // Removed glow for idle valid fields
                glow = isHovered;
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
    const v2d = new View2D(document.getElementById('canvas2d'), game);
    const v3d = new View3D(document.getElementById('canvas3d'), game);

    game.onStateChange = () => {
        document.getElementById('score-ivory').textContent = game.scores.ivory;
        document.getElementById('score-onyx').textContent = game.scores.onyx;
        document.getElementById('turn-ivory').style.opacity = game.turn === 'ivory' ? '1' : '0.2';
        document.getElementById('turn-onyx').style.opacity = game.turn === 'onyx' ? '1' : '0.2';
        v2d.draw(); v3d.update();
        if (game.gameOver) {
            document.getElementById('msg-title').textContent = game.scores.ivory > game.scores.onyx ? 'IVORY VICTORIOUS' : 'CRIMSON VICTORIOUS';
            document.getElementById('msg-body').textContent = `Final Score: ${game.scores.ivory} - ${game.scores.onyx}`;
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
        btn.onclick = () => {
            const diff = btn.getAttribute('data-diff');
            game.aiDifficulty = diff === 'none' ? null : diff;
            aiBtn.textContent = btn.textContent;
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
        const x = Math.floor(((e.clientX - rect.left) / rect.width) * 19);
        const y = Math.floor(((e.clientY - rect.top) / rect.height) * 19);
        if (x >= 0 && x < 19 && y >= 0 && y < 19) {
            game.makeMove(x, y);
        }
    };

    document.getElementById('reset-btn').onclick = () => game.reset();
    document.getElementById('rules-btn').onclick = () => document.getElementById('rules-modal').style.display = 'flex';

    window.onresize = () => { v2d.resize(); v3d.resize(); };
    setTimeout(() => { v2d.resize(); v3d.resize(); game.onStateChange(); }, 100);
});
