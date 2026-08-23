const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 40;
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const SPEED = 5;

// Elements
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const levelCompleteScreen = document.getElementById('level-complete-screen');
const gameWonScreen = document.getElementById('game-won-screen');
const hud = document.getElementById('hud');
const puzzleModal = document.getElementById('puzzle-modal');
const puzzleInput = document.getElementById('puzzle-input');
const puzzleSubmit = document.getElementById('puzzle-submit');
const puzzleError = document.getElementById('puzzle-error');
const puzzleText = document.getElementById('puzzle-text');

let gameState = 'START';
let currentLevelIdx = 0;
let lives = 3;
let keys = 0;
let map = [];
let mapWidth = 0;
let mapHeight = 0;
let camera = { x: 0, y: 0 };
let currentPuzzleTile = null;

let player;
let enemies = [];
let bosses = [];
let checkpoints = [];
let interactables = [];
let activeCheckpoint = null;
let particles = [];

// ================= AUDIO DO SISTEMA =================
let audioCtx = null;
let musicInterval = null;
let notes = [220, 261.63, 329.63, 392.00, 440];
let noteIndex = 0;

function initAudio() {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    
    musicInterval = setInterval(() => {
        if (gameState !== 'PLAYING') return;
        
        let freq = notes[noteIndex % notes.length];
        if (Math.random() > 0.7) freq *= 2;
        
        playTone(freq, 0.15, 'square', 0.05);
        noteIndex++;
        
        if (noteIndex % 4 === 0) {
            playTone(110, 0.3, 'sawtooth', 0.1);
        }
    }, 200);
}

function playTone(freq, duration, type, volume = 0.1) {
    if (!audioCtx) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// ================= SPRITES ========================
const playerImg = new Image();
playerImg.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="6" fill="#00aaff"/><rect x="4" y="8" width="24" height="12" fill="#002244"/><circle cx="10" cy="14" r="3" fill="#00ffff"/><circle cx="22" cy="14" r="3" fill="#00ffff"/><rect x="8" y="24" width="16" height="4" fill="#00ffff"/></svg>`);

const enemyImg = new Image();
enemyImg.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><polygon points="16,0 32,16 16,32 0,16" fill="#ff5500"/><circle cx="10" cy="16" r="3" fill="#000"/><circle cx="22" cy="16" r="3" fill="#000"/><path d="M10,8 L4,2 M22,8 L28,2" stroke="#ff5500" stroke-width="2"/></svg>`);

const bossImg = new Image();
bossImg.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="60" rx="10" fill="#cc00ff"/><circle cx="30" cy="30" r="15" fill="#000"/><circle cx="30" cy="30" r="8" fill="#ff0000"/><path d="M0,30 L60,30" stroke="#000" stroke-width="2"/><path d="M30,0 L30,60" stroke="#000" stroke-width="2"/></svg>`);

const input = {
    left: false, right: false, up: false, down: false, interact: false
};

window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') input.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') input.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') input.up = true;
    if (e.key === 'e' || e.key === 'E') input.interact = true;

    if (e.key === 'Enter') {
        if (gameState === 'START' || gameState === 'GAMEOVER' || gameState === 'LEVEL_COMPLETE') {
            initAudio();
            handleTransition();
        } else if (gameState === 'PUZZLE') {
            submitPuzzle();
        }
    }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (gameState === 'PLAYING') {
            gameState = 'PAUSED';
            pauseScreen.classList.remove('hidden');
        } else if (gameState === 'PAUSED') {
            gameState = 'PLAYING';
            pauseScreen.classList.add('hidden');
            requestAnimationFrame(gameLoop);
        }
    }
});

window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') input.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') input.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') input.up = false;
    if (e.key === 'e' || e.key === 'E') input.interact = false;
});

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = TILE_SIZE * 0.8;
        this.height = TILE_SIZE * 0.8;
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
        this.invulnerableTimer = 0;
    }

    update() {
        if (this.invulnerableTimer > 0) this.invulnerableTimer--;

        if (input.left) this.vx = -SPEED;
        else if (input.right) this.vx = SPEED;
        else this.vx = 0;

        this.x += this.vx;
        this.checkCollisions(true);

        this.vy += GRAVITY;
        if (input.up && this.grounded) {
            this.vy = JUMP_FORCE;
            this.grounded = false;
            playTone(600, 0.1, 'sine', 0.1);
        }
        
        this.y += this.vy;
        this.grounded = false;
        this.checkCollisions(false);

        if (this.y > mapHeight * TILE_SIZE) {
            die();
        }
    }

    checkCollisions(isX) {
        let left = Math.floor(this.x / TILE_SIZE);
        let right = Math.floor((this.x + this.width - 0.1) / TILE_SIZE);
        let top = Math.floor(this.y / TILE_SIZE);
        let bottom = Math.floor((this.y + this.height - 0.1) / TILE_SIZE);

        for (let y = top; y <= bottom; y++) {
            for (let x = left; x <= right; x++) {
                if (y >= 0 && y < mapHeight && x >= 0 && x < mapWidth) {
                    let tile = map[y][x];
                    
                    if (tile === '#' || tile === 'D') {
                        if (isX) {
                            if (this.vx > 0) this.x = x * TILE_SIZE - this.width;
                            else if (this.vx < 0) this.x = (x + 1) * TILE_SIZE;
                            this.vx = 0;
                        } else {
                            if (this.vy > 0) {
                                this.y = y * TILE_SIZE - this.height;
                                this.grounded = true;
                            } else if (this.vy < 0) {
                                this.y = (y + 1) * TILE_SIZE;
                            }
                            this.vy = 0;
                        }
                    } else if (tile === 'X') {
                        die();
                    } else if (tile === '$') {
                        keys++; // Chaves agora são apenas para pontuação! Não abrem mais a porta.
                        updateHUD();
                        map[y][x] = ' ';
                        createParticles(x * TILE_SIZE + 20, y * TILE_SIZE + 20, '#ffff00');
                        playTone(1200, 0.2, 'square', 0.2);
                    } else if (tile === 'C') {
                        activeCheckpoint = { x: x * TILE_SIZE, y: y * TILE_SIZE };
                        map[y][x] = 'c';
                        createParticles(x * TILE_SIZE + 20, y * TILE_SIZE + 20, '#00aaff');
                        playTone(800, 0.3, 'sine', 0.2);
                    } else if (tile === 'E') {
                        completeLevel();
                    }
                }
            }
        }
    }

    draw() {
        if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 100) % 2 === 0) return;
        ctx.drawImage(playerImg, this.x, this.y, this.width, this.height);
    }
}

class Enemy {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.width = TILE_SIZE * 0.8;
        this.height = TILE_SIZE * 0.8;
        this.vx = 2;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        let left = Math.floor(this.x / TILE_SIZE);
        let right = Math.floor((this.x + this.width) / TILE_SIZE);
        let bottom = Math.floor((this.y + this.height + 5) / TILE_SIZE);
        let y = Math.floor(this.y / TILE_SIZE);

        if (this.vx > 0) {
            if (map[y][right] === '#' || map[bottom][right] === ' ') this.vx *= -1;
        } else {
            if (map[y][left] === '#' || map[bottom][left] === ' ') this.vx *= -1;
        }

        if (checkCollision(player, this)) {
            if (player.vy > 0 && player.y < this.y) {
                player.vy = -10;
                this.dead = true;
                createParticles(this.x + 20, this.y + 20, this.color);
                playTone(200, 0.1, 'sawtooth', 0.2);
            } else {
                die();
            }
        }
    }
    draw() {
        ctx.drawImage(enemyImg, this.x, this.y, this.width, this.height);
    }
}

class Boss {
    constructor(x, y, levelData) {
        this.x = x;
        this.y = y;
        this.width = TILE_SIZE * 1.5;
        this.height = TILE_SIZE * 1.5;
        this.vx = 3;
        this.hp = levelData.bossHP;
        this.maxHp = this.hp;
        this.color = currentLevelIdx === 9 ? '#ff0000' : '#bb00ff';
        this.name = levelData.enemyName;
    }
    update() {
        this.x += this.vx;
        let left = Math.floor(this.x / TILE_SIZE);
        let right = Math.floor((this.x + this.width) / TILE_SIZE);
        let y = Math.floor(this.y / TILE_SIZE);

        if (this.vx > 0 && map[y][right] === '#') this.vx *= -1;
        if (this.vx < 0 && map[y][left] === '#') this.vx *= -1;

        if (checkCollision(player, this)) {
            if (player.vy > 0 && player.y < this.y + 20) {
                player.vy = -12;
                this.hp--;
                createParticles(this.x + this.width/2, this.y, '#ffffff');
                playTone(300, 0.1, 'sawtooth', 0.3);
                if (this.hp <= 0) {
                    this.dead = true;
                    createParticles(this.x + this.width/2, this.y + this.height/2, this.color, 30);
                    playTone(100, 0.5, 'square', 0.5);
                }
            } else {
                die();
            }
        }
    }
    draw() {
        ctx.drawImage(bossImg, this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#f00';
        ctx.fillRect(this.x, this.y - 15, this.width, 5);
        ctx.fillStyle = '#00aaff';
        ctx.fillRect(this.x, this.y - 15, this.width * (this.hp / this.maxHp), 5);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Share Tech Mono';
        ctx.fillText(this.name, this.x, this.y - 20);
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.05;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.fillRect(this.x, this.y, 4, 4);
        ctx.globalAlpha = 1.0;
    }
}

function createParticles(x, y, color, count=10) {
    for(let i=0; i<count; i++) particles.push(new Particle(x, y, color));
}

function checkCollision(r1, r2) {
    return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x &&
           r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
}

function loadLevel(idx) {
    let data = LEVEL_DATA[idx];
    mapWidth = data.layout[0].length;
    mapHeight = data.layout.length;
    map = [];
    enemies = [];
    bosses = [];
    interactables = [];
    particles = [];
    
    for (let y = 0; y < mapHeight; y++) {
        let row = [];
        for (let x = 0; x < mapWidth; x++) {
            let char = data.layout[y][x];
            if (char === '@') {
                player = new Player(x * TILE_SIZE, y * TILE_SIZE);
                if(activeCheckpoint) {
                    player.x = activeCheckpoint.x;
                    player.y = activeCheckpoint.y;
                }
                row.push(' ');
            } else if (char === '*') {
                enemies.push(new Enemy(x * TILE_SIZE, y * TILE_SIZE, data.enemyColor));
                row.push(' ');
            } else if (char === 'B') {
                bosses.push(new Boss(x * TILE_SIZE, y * TILE_SIZE, data));
                row.push(' ');
            } else if (char === 'T') {
                interactables.push({ x: x, y: y, type: 'T', puzzle: data.puzzle });
                row.push('T');
            } else {
                row.push(char);
            }
        }
        map.push(row);
    }
    
    document.getElementById('level-indicator').innerText = data.id;
    updateHUD();
}

function die() {
    if (player.invulnerableTimer > 0) return;
    lives--;
    updateHUD();
    createParticles(player.x, player.y, '#00aaff', 20);
    playTone(150, 0.4, 'sawtooth', 0.4);
    
    if (lives <= 0) {
        gameState = 'GAMEOVER';
        gameOverScreen.classList.remove('hidden');
    } else {
        player.invulnerableTimer = 60;
        if (activeCheckpoint) {
            player.x = activeCheckpoint.x;
            player.y = activeCheckpoint.y;
        } else {
            let tempKeys = keys;
            let tempCp = activeCheckpoint;
            loadLevel(currentLevelIdx);
            keys = tempKeys;
            activeCheckpoint = tempCp;
            player.invulnerableTimer = 60;
        }
    }
}

function completeLevel() {
    gameState = 'LEVEL_COMPLETE';
    levelCompleteScreen.classList.remove('hidden');
    playTone(800, 0.1, 'square');
    setTimeout(() => playTone(1200, 0.3, 'square'), 150);
}

function updateHUD() {
    document.getElementById('lives-count').innerText = lives;
    document.getElementById('keys-count').innerText = keys;
}

function handleTransition() {
    if (gameState === 'START') {
        startScreen.classList.add('hidden');
        hud.classList.remove('hidden');
        resetGame();
    } else if (gameState === 'GAMEOVER') {
        gameOverScreen.classList.add('hidden');
        resetGame();
    } else if (gameState === 'LEVEL_COMPLETE') {
        levelCompleteScreen.classList.add('hidden');
        currentLevelIdx++;
        if (currentLevelIdx >= LEVEL_DATA.length) {
            gameState = 'WON';
            gameWonScreen.classList.remove('hidden');
            hud.classList.add('hidden');
        } else {
            activeCheckpoint = null;
            loadLevel(currentLevelIdx);
            gameState = 'PLAYING';
            requestAnimationFrame(gameLoop);
        }
    }
}

function resetGame() {
    currentLevelIdx = 0;
    lives = 3;
    keys = 0;
    activeCheckpoint = null;
    loadLevel(currentLevelIdx);
    gameState = 'PLAYING';
    requestAnimationFrame(gameLoop);
}

function interact() {
    let px = Math.floor((player.x + player.width/2) / TILE_SIZE);
    let py = Math.floor((player.y + player.height/2) / TILE_SIZE);

    // CHAVES NÃO ABREM MAIS PORTAS! Isso torna o PUZZLE obrigatório.
    
    let tObj = interactables.find(i => Math.abs(i.x - px) <= 1 && Math.abs(i.y - py) <= 1 && i.type === 'T');
    if (tObj) {
        gameState = 'PUZZLE';
        currentPuzzleTile = tObj;
        puzzleText.innerText = tObj.puzzle.q;
        puzzleInput.value = '';
        puzzleError.classList.add('hidden');
        puzzleModal.classList.remove('hidden');
        puzzleInput.focus();
    }
}

puzzleSubmit.addEventListener('click', submitPuzzle);

function submitPuzzle() {
    let val = puzzleInput.value.trim().toLowerCase();
    if (val === currentPuzzleTile.puzzle.a.toLowerCase()) {
        puzzleModal.classList.add('hidden');
        gameState = 'PLAYING';
        for(let y=0; y<mapHeight; y++) {
            for(let x=0; x<mapWidth; x++) {
                if(map[y][x] === 'D') {
                    map[y][x] = ' ';
                    createParticles(x*TILE_SIZE, y*TILE_SIZE, '#00aaff');
                }
            }
        }
        map[currentPuzzleTile.y][currentPuzzleTile.x] = 't';
        interactables = interactables.filter(i => i !== currentPuzzleTile);
        playTone(1500, 0.3, 'sine', 0.2); 
        requestAnimationFrame(gameLoop);
    } else {
        puzzleError.classList.remove('hidden');
        playTone(200, 0.3, 'sawtooth', 0.3); 
    }
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;

    player.update();
    if (input.interact) {
        interact();
        input.interact = false;
    }

    enemies.forEach(e => e.update());
    enemies = enemies.filter(e => !e.dead);
    
    bosses.forEach(b => b.update());
    bosses = bosses.filter(b => !b.dead);

    particles.forEach(p => p.update());
    particles = particles.filter(p => p.life > 0);

    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
    camera.x = Math.max(0, Math.min(camera.x, mapWidth * TILE_SIZE - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, mapHeight * TILE_SIZE - canvas.height));

    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            let tile = map[y][x];
            let tx = x * TILE_SIZE;
            let ty = y * TILE_SIZE;
            
            if (tx + TILE_SIZE < camera.x || tx > camera.x + canvas.width || 
                ty + TILE_SIZE < camera.y || ty > camera.y + canvas.height) continue;

            if (tile === '#') {
                ctx.fillStyle = '#001133';
                ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#00aaff';
                ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);
            } else if (tile === '?') {
                ctx.fillStyle = '#001133';
                ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#00aaff';
                ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);
            } else if (tile === 'X') {
                ctx.fillStyle = '#ff003c';
                ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillText("ERR", tx+5, ty+25);
            } else if (tile === '$') {
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.arc(tx + 20, ty + 20, 10, 0, Math.PI * 2);
                ctx.fill();
            } else if (tile === 'C') {
                ctx.fillStyle = '#00aaff';
                ctx.fillRect(tx + 10, ty + 10, 20, 30);
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(tx + 20, ty + 10, 8, 0, Math.PI * 2);
                ctx.fill();
            } else if (tile === 'c') {
                ctx.fillStyle = '#005588';
                ctx.fillRect(tx + 10, ty + 10, 20, 30);
            } else if (tile === 'T') {
                ctx.fillStyle = '#0033ff';
                ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#00ffff';
                ctx.fillRect(tx + 5, ty + 5, 30, 20);
            } else if (tile === 't') {
                ctx.fillStyle = '#001133';
                ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            } else if (tile === 'D') {
                ctx.fillStyle = '#002244';
                ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#00aaff';
                ctx.fillRect(tx + 15, ty + 15, 10, 10);
            } else if (tile === 'E') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(tx + 10, ty, 20, TILE_SIZE);
                ctx.fillStyle = '#000000';
                ctx.fillText("EXIT", tx+5, ty+20);
            }
        }
    }

    enemies.forEach(e => e.draw());
    bosses.forEach(b => b.draw());
    particles.forEach(p => p.draw());
    player.draw();

    ctx.restore();

    requestAnimationFrame(gameLoop);
}
