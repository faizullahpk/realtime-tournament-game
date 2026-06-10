/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║          AviaTarr — Phase 2: Core Game Engine            ║
 * ║  Provably Fair · Canvas-Animated · Dual Bet · Web Audio  ║
 * ╚══════════════════════════════════════════════════════════╝
 */

'use strict';

/* ═══════════════════════════════════════════════
   CONSTANTS & CONFIG
═══════════════════════════════════════════════ */
const CFG = {
  LOBBY_MS:          5000,   // countdown before flight
  RESULT_MS:         3000,   // result screen duration
  TICK_MS:           50,     // game loop interval
  MULTIPLIER_EXP:    0.00006,// exponential growth constant
  MIN_BET:           10,
  MAX_BET:           10000,
  STARTING_BALANCE:  10000,
  BOT_COUNT_MIN:     8,
  BOT_COUNT_MAX:     15,
  HISTORY_MAX:       10,
  STAR_COUNT:        120,
  CLOUD_COUNT:       6,
  PARTICLE_COUNT:    80,
  TRAIL_LENGTH:      180,
  GRID_LINES_X:      12,
  GRID_LINES_Y:      8,
  COLORS: {
    sky_top:    '#010a1a',
    sky_bot:    '#04142e',
    grid_line:  'rgba(0,245,255,0.07)',
    grid_glow:  'rgba(0,245,255,0.15)',
    trail:      'rgba(0,200,255,',
    neon:       '#00f5ff',
    gold:       '#ffd700',
    green:      '#00ff88',
    red:        '#ff3355',
    orange:     '#ff7700',
    yellow:     '#ffee00',
  }
};

/* ═══════════════════════════════════════════════
   PROVABLY FAIR RNG
═══════════════════════════════════════════════ */
function generateSeed() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
}

function seededRandom(seed) {
  // Simple but effective: hash the seed string into a float [0,1)
  let h = 0xdeadbeef;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b1);
    h ^= h >>> 16;
  }
  h = Math.imul(h, 0x85ebca77);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

function computeCrashPoint(seed) {
  const r = seededRandom(seed);
  if (r >= 0.99) return 1.00; // 1% instant crash
  const cp = (99 / (1 - r)) / 100;
  return Math.min(200, Math.max(1.00, parseFloat(cp.toFixed(2))));
}

/* ═══════════════════════════════════════════════
   WEB AUDIO ENGINE
═══════════════════════════════════════════════ */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineGain = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this._running = false;
  }

  _init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);
  }

  _osc(freq, type, duration, gainVal = 0.3, fadeOut = true) {
    if (this.muted || !this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type      = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    if (fadeOut) gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  startEngine() {
    if (this.muted || this._running) return;
    this._init();
    this._running = true;
    // Two-oscillator drone: fundamental + harmonic
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.08;
    this.engineGain.connect(this.masterGain);

    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 80;
    this.engineOsc.connect(this.engineGain);
    this.engineOsc.start();

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'sine';
    this.engineOsc2.frequency.value = 160;
    this.engineOsc2.connect(this.engineGain);
    this.engineOsc2.start();
  }

  updateEnginePitch(multiplier) {
    if (!this._running || !this.engineOsc || this.muted) return;
    const base = 80 + (multiplier - 1) * 12;
    const freq  = Math.min(440, base);
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.3);
    this.engineOsc2.frequency.setTargetAtTime(freq * 2, this.ctx.currentTime, 0.3);
    const vol = Math.min(0.18, 0.08 + (multiplier - 1) * 0.004);
    this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.3);
  }

  stopEngine() {
    if (!this._running) return;
    this._running = false;
    try {
      this.engineOsc?.stop();
      this.engineOsc2?.stop();
    } catch(e) {}
    this.engineOsc = this.engineOsc2 = null;
  }

  playCrash() {
    if (this.muted) return;
    this._init();
    this.stopEngine();
    // Explosion — low boom + noise burst
    const bufLen = this.ctx.sampleRate * 0.6;
    const buf    = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i/bufLen);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.6, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start();
    // Low punch
    this._osc(55, 'sine', 0.5, 0.5, true);
  }

  playCashout(multiplier) {
    if (this.muted) return;
    this._init();
    const pitch = Math.min(1200, 400 + multiplier * 40);
    // Cha-ching: rising pair of notes
    this._osc(pitch,       'triangle', 0.18, 0.4, true);
    setTimeout(() => this._osc(pitch * 1.25, 'triangle', 0.25, 0.35, true), 80);
    setTimeout(() => this._osc(pitch * 1.5,  'sine',     0.35, 0.25, true), 160);
  }

  playBetPlace() {
    if (this.muted) return;
    this._init();
    this._osc(320, 'sine', 0.12, 0.2, true);
    setTimeout(() => this._osc(480, 'sine', 0.12, 0.15, true), 60);
  }

  playCountdownTick() {
    if (this.muted) return;
    this._init();
    this._osc(220, 'square', 0.08, 0.12, true);
  }

  playCountdownGo() {
    if (this.muted) return;
    this._init();
    this._osc(440, 'sine', 0.15, 0.3, true);
    setTimeout(() => this._osc(880, 'sine', 0.25, 0.5, true), 80);
  }

  setMuted(m) {
    this.muted = m;
    if (m) { this.stopEngine(); }
  }
}

/* ═══════════════════════════════════════════════
   CANVAS RENDERER
═══════════════════════════════════════════════ */
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.W = this.H = 0;
    this.stars  = [];
    this.clouds = [];
    this.particles = [];
    this.trailPoints = [];
    this.gridOffset = 0;
    this.planeX = 0;
    this.planeY = 0;
    this.planeAngle = 0;
    this.exploded = false;
    this.flashAlpha = 0;
    this.targetX = 0;
    this.targetY = 0;
    this._initStars();
    this._initClouds();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.W = this.canvas.width  = this.canvas.offsetWidth;
    this.H = this.canvas.height = this.canvas.offsetHeight;
    this._initStars();
  }

  _initStars() {
    this.stars = [];
    for (let i = 0; i < CFG.STAR_COUNT; i++) {
      this.stars.push({
        x:       Math.random() * (this.W || 800),
        y:       Math.random() * (this.H || 500) * 0.7,
        r:       Math.random() * 1.5 + 0.3,
        alpha:   Math.random() * 0.7 + 0.2,
        twinkle: Math.random() * Math.PI * 2,
        speed:   Math.random() * 0.02 + 0.005,
      });
    }
  }

  _initClouds() {
    this.clouds = [];
    for (let i = 0; i < CFG.CLOUD_COUNT; i++) {
      this.clouds.push(this._newCloud(true));
    }
  }

  _newCloud(init = false) {
    const W = this.W || 800;
    const H = this.H || 500;
    return {
      x:      init ? Math.random() * W : W + 120,
      y:      Math.random() * H * 0.55 + 20,
      speed:  Math.random() * 0.4 + 0.15,
      scale:  Math.random() * 0.7 + 0.4,
      alpha:  Math.random() * 0.07 + 0.03,
    };
  }

  spawnParticles(x, y) {
    this.particles = [];
    const colors = ['#ff3355','#ff7700','#ffee00','#ffffff','#ff9944'];
    for (let i = 0; i < CFG.PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2;
      this.particles.push({
        x, y,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - Math.random() * 4,
        r:     Math.random() * 5 + 2,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot:   Math.random() * Math.PI * 2,
        rotV:  (Math.random() - 0.5) * 0.3,
        life:  1,
        decay: Math.random() * 0.02 + 0.012,
      });
    }
    this.exploded  = true;
    this.flashAlpha = 1;
  }

  _drawBackground(dt) {
    const { ctx, W, H } = this;
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, CFG.COLORS.sky_top);
    sky.addColorStop(0.7, CFG.COLORS.sky_bot);
    sky.addColorStop(1, '#020a14');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
  }

  _drawStars(dt) {
    const { ctx } = this;
    for (const s of this.stars) {
      s.twinkle += s.speed;
      const a = s.alpha * (0.6 + 0.4 * Math.sin(s.twinkle));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,225,255,${a})`;
      ctx.fill();
    }
  }

  _drawClouds(dt, phase) {
    const { ctx, W, H } = this;
    if (phase === 'lobby') return;
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.x -= c.speed;
      if (c.x < -200) { this.clouds[i] = this._newCloud(); continue; }
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);
      ctx.fillStyle = 'rgba(120,200,255,1)';
      // Cloud puffs
      for (const [cx, cy, cr] of [[0,0,40],[40,-15,35],[-40,-15,35],[70,5,28],[-70,5,28],[20,10,30],[-20,10,30]]) {
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawGrid(dt) {
    const { ctx, W, H } = this;
    const groundH = H * 0.18;
    // Scrolling perspective grid
    this.gridOffset = (this.gridOffset + 1.2) % (W / CFG.GRID_LINES_X);
    const vanishX = W * 0.3;
    const vanishY = H - groundH;

    // Ground glow
    const groundGrad = ctx.createLinearGradient(0, vanishY, 0, H);
    groundGrad.addColorStop(0, 'rgba(0,245,255,0.04)');
    groundGrad.addColorStop(0.5, 'rgba(0,245,255,0.02)');
    groundGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, vanishY, W, groundH);

    ctx.save();
    ctx.globalAlpha = 0.5;
    const numV = CFG.GRID_LINES_X;
    for (let i = 0; i <= numV; i++) {
      const t = (i / numV) - (this.gridOffset / W);
      const startX = t * W;
      ctx.beginPath();
      ctx.moveTo(vanishX + (startX - vanishX) * 0.1, vanishY);
      ctx.lineTo(startX, H);
      ctx.strokeStyle = CFG.COLORS.grid_line;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Horizontal lines
    const numH = CFG.GRID_LINES_Y;
    for (let j = 0; j <= numH; j++) {
      const t  = j / numH;
      const y  = vanishY + t * groundH;
      const gl = ctx.createLinearGradient(0, y, W, y);
      gl.addColorStop(0, 'transparent');
      gl.addColorStop(0.2, CFG.COLORS.grid_line);
      gl.addColorStop(0.8, CFG.COLORS.grid_line);
      gl.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.strokeStyle = gl;
      ctx.lineWidth = j === 0 ? 1.5 : 0.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawTrail() {
    const { ctx } = this;
    if (this.trailPoints.length < 2) return;
    ctx.save();
    for (let i = 1; i < this.trailPoints.length; i++) {
      const t   = i / this.trailPoints.length;
      const a   = t * 0.6;
      const p0  = this.trailPoints[i - 1];
      const p1  = this.trailPoints[i];
      const w   = t * 4;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = `rgba(0,200,255,${a})`;
      ctx.lineWidth   = w;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }
    // Inner bright trail
    if (this.trailPoints.length > 5) {
      const recent = this.trailPoints.slice(-20);
      ctx.beginPath();
      ctx.moveTo(recent[0].x, recent[0].y);
      for (const p of recent) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = 'rgba(180,240,255,0.8)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawPlane(flying, multiplier) {
    if (this.exploded) return;
    const { ctx } = this;
    ctx.save();
    ctx.translate(this.planeX, this.planeY);
    ctx.rotate(this.planeAngle);

    // Engine glow
    const glowR = 20 + multiplier * 1.5;
    const g = ctx.createRadialGradient(-30, 0, 0, -30, 0, glowR);
    g.addColorStop(0, 'rgba(0,200,255,0.5)');
    g.addColorStop(0.5, 'rgba(0,100,255,0.15)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(-30, 0, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Afterburner flame
    if (flying) {
      const fl = 20 + Math.sin(Date.now() * 0.02) * 8 + multiplier * 2;
      const flame = ctx.createLinearGradient(-36, 0, -36 - fl, 0);
      flame.addColorStop(0, 'rgba(255,180,0,0.9)');
      flame.addColorStop(0.4, 'rgba(255,80,0,0.7)');
      flame.addColorStop(1, 'rgba(255,20,0,0)');
      ctx.beginPath();
      ctx.moveTo(-28, -5);
      ctx.quadraticCurveTo(-36 - fl * 0.6, (Math.random() - 0.5) * 8, -36 - fl, 0);
      ctx.quadraticCurveTo(-36 - fl * 0.6, (Math.random() - 0.5) * 8, -28,  5);
      ctx.fillStyle = flame;
      ctx.fill();
    }

    // Fuselage
    ctx.beginPath();
    ctx.moveTo(35, 0);
    ctx.bezierCurveTo(25, -7, -10, -9, -30, -7);
    ctx.bezierCurveTo(-35, -5, -35, 5, -30, 7);
    ctx.bezierCurveTo(-10, 9, 25, 7, 35, 0);
    ctx.fillStyle = 'rgba(180,220,255,0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,245,255,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Cockpit
    ctx.beginPath();
    ctx.ellipse(18, -3, 10, 6, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,200,255,0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,245,255,0.8)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Wing
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-5, -25);
    ctx.lineTo(-22, -22);
    ctx.lineTo(-25, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(140,190,240,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,245,255,0.4)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Wing 2 (bottom mirror)
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-5, 25);
    ctx.lineTo(-22, 22);
    ctx.lineTo(-25, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(140,190,240,0.9)';
    ctx.fill();
    ctx.stroke();

    // Tail fin
    ctx.beginPath();
    ctx.moveTo(-22, -7);
    ctx.lineTo(-30, -20);
    ctx.lineTo(-35, -7);
    ctx.closePath();
    ctx.fillStyle = 'rgba(100,160,220,0.9)';
    ctx.fill();

    // Neon stripe along fuselage
    ctx.beginPath();
    ctx.moveTo(30, 1);
    ctx.lineTo(-28, 1);
    ctx.strokeStyle = 'rgba(0,245,255,0.6)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  _drawParticles() {
    const { ctx } = this;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x    += p.vx;
      p.y    += p.vy;
      p.vy   += 0.15;  // gravity
      p.vx   *= 0.97;
      p.alpha = p.life;
      p.life -= p.decay;
      p.rot  += p.rotV;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.rect(-p.r/2, -p.r/2, p.r, p.r);
      ctx.fillStyle = p.color;
      ctx.fill();
      // spark
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-p.vx * 1.5, -p.vy * 1.5);
      ctx.strokeStyle = p.color;
      ctx.lineWidth   = p.r / 3;
      ctx.globalAlpha = p.alpha * 0.6;
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawFlash() {
    if (this.flashAlpha <= 0) return;
    const { ctx, W, H } = this;
    ctx.save();
    ctx.fillStyle = `rgba(255,30,50,${this.flashAlpha * 0.55})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    this.flashAlpha -= 0.04;
    if (this.flashAlpha < 0) this.flashAlpha = 0;
  }

  updatePlane(t, phase, multiplier) {
    const W = this.W, H = this.H;
    if (phase === 'lobby') {
      this.planeX = W * 0.08;
      this.planeY = H * 0.6;
      this.planeAngle = 0;
      this.trailPoints = [];
      this.exploded    = false;
      this.particles   = [];
      this.flashAlpha  = 0;
      return;
    }
    if (phase === 'flying') {
      // Curve from left to upper-right as multiplier climbs
      const pct    = Math.min(1, (multiplier - 1) / 30);
      const target_x = W * (0.15 + pct * 0.65);
      const target_y = H * (0.65 - pct * 0.55);
      this.planeX += (target_x - this.planeX) * 0.04;
      this.planeY += (target_y - this.planeY) * 0.04;
      // Trail
      if (this.trailPoints.length === 0 || Math.hypot(this.planeX - this.trailPoints[this.trailPoints.length-1].x, this.planeY - this.trailPoints[this.trailPoints.length-1].y) > 6) {
        this.trailPoints.push({ x: this.planeX, y: this.planeY });
        if (this.trailPoints.length > CFG.TRAIL_LENGTH) this.trailPoints.shift();
      }
      // Bank angle
      const dy = this.trailPoints.length > 2 ? this.trailPoints[this.trailPoints.length-1].y - this.trailPoints[this.trailPoints.length-3].y : 0;
      this.planeAngle += (Math.atan2(dy, 6) - this.planeAngle) * 0.1;
    }
    if (phase === 'crashed') {
      if (!this.exploded) {
        this.spawnParticles(this.planeX, this.planeY);
      }
    }
  }

  render(phase, multiplier) {
    const dt = 1;
    this._drawBackground(dt);
    this._drawStars(dt);
    this._drawClouds(dt, phase);
    this._drawGrid(dt);
    if (phase !== 'lobby' && phase !== 'crashed') this._drawTrail();
    if (phase !== 'result') this._drawPlane(phase === 'flying', multiplier);
    this._drawParticles();
    this._drawFlash();
  }
}

/* ═══════════════════════════════════════════════
   BOT PLAYER GENERATOR
═══════════════════════════════════════════════ */
const BOT_NAMES = [
  'AceRider','CryptoFly','SkyHunter','VelociX','NeonPilot','ZeroGrav',
  'PulsarWin','TurboKite','AlphaJet','BetaCrash','OmegaFlyer','StormBet',
  'NovaStar','QuantumX','SpeedFreq','DarkMatter','LightSpd','VoidWalker',
  'SolarMax','CosmicRay','HyperDrift','MachX','IonBlast','WarpDrive',
  'GravityUp','StellarCo','NebulaBet','PlasmaPit','FluxRider','ZenithWin',
];
const AVATAR_COLORS = [
  ['#00f5ff','#040814'],['#ff3355','#1a0008'],['#00ff88','#001a0e'],
  ['#ffd700','#1a1000'],['#a855f7','#0f001a'],['#ff7700','#1a0800'],
  ['#00ddff','#00101a'],['#ffee00','#1a1a00'],
];

function generateBots(count, crashAt) {
  const bots = [];
  for (let i = 0; i < count; i++) {
    const name  = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random()*99+1);
    const bet   = Math.round((Math.random() * 990 + 10) / 10) * 10;
    const avClr = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    // Bot's cashout strategy
    let cashoutMult = null;
    const r = Math.random();
    if (r < 0.15) cashoutMult = null; // never cashes out (crashes with)
    else {
      // Most bots cash out between 1.1× and crashAt
      cashoutMult = parseFloat((1.05 + Math.random() * Math.min(crashAt * 0.85, 15)).toFixed(2));
      if (cashoutMult > crashAt) cashoutMult = null;
    }
    bots.push({ name, bet, cashoutMult, avatarFg: avClr[0], avatarBg: avClr[1], status: 'flying' });
  }
  return bots;
}

/* ═══════════════════════════════════════════════
   GAME STATE
═══════════════════════════════════════════════ */
const gameState = {
  phase:        'lobby',  // lobby | flying | crashed | result
  multiplier:   1.00,
  crashPoint:   1.00,
  seed:         '',
  nextSeedHash: '',
  roundStart:   0,
  lobbyStart:   0,
  countdownSec: 5,
  balance:      CFG.STARTING_BALANCE,
  bets: {
    A: { placed: false, amount: 0, cashedOut: false, cashMult: 0, autoEnabled: false, autoAt: 2.00 },
    B: { placed: false, amount: 0, cashedOut: false, cashMult: 0, autoEnabled: false, autoAt: 3.00 },
  },
  roundHistory:  [],
  sessionStats:  { rounds: 0, wins: 0, losses: 0, bestWin: 0, netPnl: 0, history: [] },
  bots:          [],
  muted:         false,
};

/* ═══════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════ */
const DOM = {
  canvas:          document.getElementById('gameCanvas'),
  multiplierValue: document.getElementById('multiplierValue'),
  multiplierLabel: document.getElementById('multiplierLabel'),
  countdownOverlay:document.getElementById('countdownOverlay'),
  countdownText:   document.getElementById('countdownText'),
  countdownSub:    document.getElementById('countdownSub'),
  crashOverlay:    document.getElementById('crashOverlay'),
  resultPopup:     document.getElementById('resultPopup'),
  resultMult:      document.getElementById('resultMultiplier'),
  resultWinLoss:   document.getElementById('resultWinLoss'),
  resultNextTimer: document.getElementById('resultNextTimer'),
  balanceDisplay:  document.getElementById('balanceDisplay'),
  muteBtn:         document.getElementById('muteBtn'),
  historyPills:    document.getElementById('historyPills'),
  liveBetsList:    document.getElementById('liveBetsList'),
  liveBetCount:    document.getElementById('liveBetCount'),
  betAmountA:      document.getElementById('betAmountA'),
  betAmountB:      document.getElementById('betAmountB'),
  btnBetA:         document.getElementById('btnBetA'),
  btnBetB:         document.getElementById('btnBetB'),
  btnCashA:        document.getElementById('btnCashA'),
  btnCashB:        document.getElementById('btnCashB'),
  potWinA:         document.getElementById('potWinA'),
  potWinB:         document.getElementById('potWinB'),
  autoSwitchA:     document.getElementById('autoSwitchA'),
  autoSwitchB:     document.getElementById('autoSwitchB'),
  autoCashA:       document.getElementById('autoCashA'),
  autoCashB:       document.getElementById('autoCashB'),
  betSlotA:        document.getElementById('betSlotA'),
  betSlotB:        document.getElementById('betSlotB'),
  statRounds:      document.getElementById('statRounds'),
  statWinRate:     document.getElementById('statWinRate'),
  statBestWin:     document.getElementById('statBestWin'),
  statPnl:         document.getElementById('statPnl'),
  sessionRows:     document.getElementById('sessionRows'),
  fairModal:       document.getElementById('fairModal'),
  fairSeed:        document.getElementById('fairSeedDisplay'),
  fairNext:        document.getElementById('fairNextHash'),
  toastContainer:  document.getElementById('toastContainer'),
};

/* ═══════════════════════════════════════════════
   AUDIO + RENDERER
═══════════════════════════════════════════════ */
const audio    = new AudioEngine();
const renderer = new Renderer(DOM.canvas);

/* ═══════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════ */
function fmt(n, dec = 2)  { return Number(n).toFixed(dec); }
function fmtCoins(n)       { return Math.floor(n).toLocaleString(); }
function clamp(v, lo, hi)  { return Math.max(lo, Math.min(hi, v)); }

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  DOM.toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 3100);
}

function updateBalance(newVal, flash = false) {
  gameState.balance = newVal;
  DOM.balanceDisplay.textContent = fmtCoins(newVal);
  if (flash) {
    DOM.balanceDisplay.classList.remove('changed');
    void DOM.balanceDisplay.offsetWidth;
    DOM.balanceDisplay.classList.add('changed');
  }
}

function saveHistory() {
  try {
    // Sync balance back to user object via shared.js
    if (typeof DB !== 'undefined' && DB.currentUser()) {
      DB.updateBalance(gameState.balance);
    } else {
      localStorage.setItem('aviatarr_balance', String(gameState.balance));
    }
    localStorage.setItem('aviatarr_history', JSON.stringify(gameState.roundHistory.slice(-50)));
    localStorage.setItem('aviatarr_stats',   JSON.stringify(gameState.sessionStats));
  } catch(e) {}
}

function loadHistory() {
  try {
    // Load balance from user object if available (shared.js)
    if (typeof DB !== 'undefined' && DB.currentUser()) {
      const userBal = DB.getBalance();
      if (userBal >= 0) updateBalance(userBal);
    } else {
      const b = localStorage.getItem('aviatarr_balance');
      if (b) { const bal = parseFloat(b); if (!isNaN(bal) && bal > 0) updateBalance(bal); }
    }
    const h = localStorage.getItem('aviatarr_history');
    const s = localStorage.getItem('aviatarr_stats');
    if (h) gameState.roundHistory = JSON.parse(h);
    if (s) gameState.sessionStats = JSON.parse(s);
  } catch(e) {}
}

/* ═══════════════════════════════════════════════
   HISTORY BAR
═══════════════════════════════════════════════ */
function addHistoryPill(cp) {
  const pill = document.createElement('div');
  let cls = 'low';
  if (cp >= 10)  cls = 'mega';
  else if (cp >= 2) cls = 'mid';
  else if (cp >= 1.5) cls = 'high';
  pill.className = `history-pill ${cls}`;
  pill.textContent = `${fmt(cp)}×`;
  pill.title = `Crash at ${fmt(cp)}×`;
  DOM.historyPills.insertBefore(pill, DOM.historyPills.firstChild);
  // Trim to max
  const pills = DOM.historyPills.querySelectorAll('.history-pill');
  if (pills.length > CFG.HISTORY_MAX) pills[pills.length - 1].remove();
}

/* ═══════════════════════════════════════════════
   LIVE BETS SIDEBAR
═══════════════════════════════════════════════ */
function renderLiveBets() {
  const all = [...gameState.bots];
  // Add real player bets
  if (gameState.bets.A.placed) {
    all.unshift({ name: 'YOU (A)', bet: gameState.bets.A.amount, cashoutMult: gameState.bets.A.cashedOut ? gameState.bets.A.cashMult : null, status: gameState.bets.A.cashedOut ? 'cashed' : (gameState.phase === 'crashed' ? 'lost' : 'flying'), avatarFg: '#00f5ff', avatarBg: '#001a22', isPlayer: true });
  }
  if (gameState.bets.B.placed) {
    all.unshift({ name: 'YOU (B)', bet: gameState.bets.B.amount, cashoutMult: gameState.bets.B.cashedOut ? gameState.bets.B.cashMult : null, status: gameState.bets.B.cashedOut ? 'cashed' : (gameState.phase === 'crashed' ? 'lost' : 'flying'), avatarFg: '#ffd700', avatarBg: '#1a1000', isPlayer: true });
  }

  DOM.liveBetsList.innerHTML = '';
  DOM.liveBetCount.textContent = all.length;

  for (const bot of all) {
    const row = document.createElement('div');
    row.className = 'bet-row';

    const initials = bot.name.slice(0,2).toUpperCase();
    let cashCell = '';
    if (bot.status === 'flying') {
      cashCell = `<div class="bet-cashout-cell flying">—</div>`;
    } else if (bot.status === 'cashed') {
      cashCell = `<div class="bet-cashout-cell cashed">${fmt(bot.cashoutMult)}×</div>`;
    } else {
      cashCell = `<div class="bet-cashout-cell lost">✗</div>`;
    }

    row.innerHTML = `
      <div class="bet-player">
        <div class="bet-avatar" style="background:${bot.avatarBg};color:${bot.avatarFg};border:1px solid ${bot.avatarFg}33">${initials}</div>
        <div class="bet-username" style="${bot.isPlayer?'color:var(--accent-neon);font-weight:700':''}">${bot.name}</div>
      </div>
      <div class="bet-amount-cell">${fmtCoins(bot.bet)}</div>
      ${cashCell}
    `;
    DOM.liveBetsList.appendChild(row);
  }
}

/* ═══════════════════════════════════════════════
   MULTIPLIER COLOR STATE
═══════════════════════════════════════════════ */
function updateMultiplierUI(m) {
  const txt = `${fmt(m)}×`;
  DOM.multiplierValue.textContent = txt;
  let cls = 'state-flying';
  if (m >= 10)   cls = 'state-danger';
  else if (m >= 4)  cls = 'state-warning';
  else if (m >= 2)  cls = 'state-flying';
  if (gameState.phase === 'lobby')   cls = 'state-waiting';
  if (gameState.phase === 'crashed') cls = 'state-crashed';
  DOM.multiplierValue.className = cls;
}

/* ═══════════════════════════════════════════════
   BET / CASHOUT CONTROLS
═══════════════════════════════════════════════ */
function setBetControlsState(phase) {
  const lobby   = phase === 'lobby';
  const flying  = phase === 'flying';
  const crashed = phase === 'crashed' || phase === 'result';

  ['A','B'].forEach(s => {
    const bet   = gameState.bets[s];
    const input = DOM[`betAmount${s}`];
    const btnB  = DOM[`btnBet${s}`];
    const btnC  = DOM[`btnCash${s}`];
    const slot  = DOM[`betSlot${s}`];

    input.disabled = !lobby || bet.placed;
    btnB.disabled  = !lobby || bet.placed;

    if (flying && bet.placed && !bet.cashedOut) {
      btnC.disabled = false;
      btnC.classList.add('pulsing');
      slot.classList.add('active-bet');
    } else {
      btnC.disabled = true;
      btnC.classList.remove('pulsing');
    }

    if (!bet.placed) slot.classList.remove('active-bet');

    // Update button text
    if (lobby && !bet.placed) {
      btnB.textContent = 'PLACE BET';
    } else if (lobby && bet.placed) {
      btnB.textContent = 'QUEUED ✓';
    }
  });
}

function updatePotentialWins() {
  const m = gameState.multiplier;
  ['A','B'].forEach(s => {
    const bet = gameState.bets[s];
    const el  = DOM[`potWin${s}`];
    if (bet.placed && !bet.cashedOut) {
      el.textContent = `WIN: ${fmtCoins(bet.amount * m)}`;
      el.style.color = m >= 4 ? 'var(--accent-orange)' : m >= 2 ? 'var(--accent-yellow)' : 'var(--accent-gold)';
    } else if (!bet.placed) {
      const amt = parseFloat(DOM[`betAmount${s}`].value) || 0;
      el.textContent = amt > 0 ? `WIN: ${fmtCoins(amt * m)}` : 'WIN: —';
    } else if (bet.cashedOut) {
      el.textContent = `WON: ${fmtCoins(bet.amount * bet.cashMult)}`;
      el.style.color = 'var(--accent-green)';
    }
  });
}

function placeBet(slot) {
  if (gameState.phase !== 'lobby') return;
  const bet    = gameState.bets[slot];
  if (bet.placed) return;
  const input  = DOM[`betAmount${slot}`];
  const amount = clamp(parseFloat(input.value) || 0, CFG.MIN_BET, CFG.MAX_BET);
  if (amount < CFG.MIN_BET) { showToast(`Minimum bet is ${CFG.MIN_BET}`, 'info'); return; }
  if (amount > gameState.balance) { showToast('Insufficient balance!', 'loss'); return; }
  input.value    = amount;
  bet.placed     = true;
  bet.amount     = amount;
  bet.cashedOut  = false;
  bet.cashMult   = 0;
  updateBalance(gameState.balance - amount, true);
  audio.playBetPlace();
  setBetControlsState(gameState.phase);
  showToast(`Bet ${slot} placed: ${fmtCoins(amount)}`, 'info');
}

function cashOut(slot) {
  const bet = gameState.bets[slot];
  if (!bet.placed || bet.cashedOut || gameState.phase !== 'flying') return;
  const m    = gameState.multiplier;
  const win  = bet.amount * m;
  bet.cashedOut = true;
  bet.cashMult  = m;
  updateBalance(gameState.balance + win, true);
  audio.playCashout(m);
  setBetControlsState(gameState.phase);
  showToast(`✓ Cashed out Bet ${slot} at ${fmt(m)}× — +${fmtCoins(win)}`, 'win');
  DOM[`btnCash${slot}`].textContent = `CASHED ${fmt(m)}×`;
  gameState.sessionStats.wins++;
  const profit = win - bet.amount;
  gameState.sessionStats.netPnl += profit;
  if (profit > gameState.sessionStats.bestWin) gameState.sessionStats.bestWin = profit;
  updateStatsUI();
  document.getElementById('gameArea').classList.add('win-flash');
  setTimeout(() => document.getElementById('gameArea').classList.remove('win-flash'), 500);
}

/* ═══════════════════════════════════════════════
   AUTO CASHOUT TOGGLES
═══════════════════════════════════════════════ */
function initAutoToggles() {
  ['A','B'].forEach(s => {
    const sw  = DOM[`autoSwitch${s}`];
    const inp = DOM[`autoCash${s}`];
    const lbl = document.getElementById(`autoToggle${s}`);
    lbl.addEventListener('click', (e) => {
      e.preventDefault();
      const bet = gameState.bets[s];
      bet.autoEnabled = !bet.autoEnabled;
      sw.classList.toggle('on', bet.autoEnabled);
      inp.disabled = !bet.autoEnabled;
    });
    inp.addEventListener('change', () => {
      gameState.bets[s].autoAt = parseFloat(inp.value) || 2.00;
    });
  });
}

/* ═══════════════════════════════════════════════
   STATS UI
═══════════════════════════════════════════════ */
function updateStatsUI() {
  const s = gameState.sessionStats;
  DOM.statRounds.textContent  = s.rounds;
  const wr = s.rounds > 0 ? Math.round((s.wins / s.rounds) * 100) : 0;
  DOM.statWinRate.textContent  = `${wr}%`;
  DOM.statBestWin.textContent  = s.bestWin > 0 ? `+${fmtCoins(s.bestWin)}` : '—';
  DOM.statPnl.textContent      = (s.netPnl >= 0 ? '+' : '') + fmtCoins(s.netPnl);
  DOM.statPnl.style.color      = s.netPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
}

function addSessionRow(cp, betA, betB) {
  const rows    = DOM.sessionRows;
  const div     = document.createElement('div');
  div.className = 'session-row';
  const crashText = `Crash: ${fmt(cp)}×`;
  let resultHTML = '';
  let anyBet = false;
  ['A','B'].forEach(s => {
    const bet = s === 'A' ? betA : betB;
    if (!bet || !bet.placed) return;
    anyBet = true;
    if (bet.cashedOut) {
      const pnl = bet.amount * bet.cashMult - bet.amount;
      resultHTML += `<span class="session-row-result win">${s}: +${fmtCoins(pnl)}</span> `;
    } else {
      resultHTML += `<span class="session-row-result loss">${s}: -${fmtCoins(bet.amount)}</span> `;
    }
  });
  if (!anyBet) resultHTML = `<span class="session-row-result skip">No bet</span>`;
  div.innerHTML = `<span class="session-row-crash">${crashText}</span>${resultHTML}`;
  rows.insertBefore(div, rows.firstChild);
  if (rows.children.length > 20) rows.lastChild.remove();
}

/* ═══════════════════════════════════════════════
   ROUND LIFECYCLE
═══════════════════════════════════════════════ */
let loopInterval  = null;
let countdownIval = null;
let resultTimer   = null;

function startLobby() {
  gameState.phase       = 'lobby';
  gameState.multiplier  = 1.00;
  gameState.seed        = generateSeed();
  gameState.crashPoint  = computeCrashPoint(gameState.seed);
  gameState.lobbyStart  = Date.now();
  gameState.countdownSec = 5;

  // Prepare bots
  gameState.bots = generateBots(
    Math.floor(Math.random() * (CFG.BOT_COUNT_MAX - CFG.BOT_COUNT_MIN + 1) + CFG.BOT_COUNT_MIN),
    gameState.crashPoint
  );

  // Reset bets
  ['A','B'].forEach(s => {
    const b = gameState.bets[s];
    b.placed    = false;
    b.cashedOut = false;
    b.cashMult  = 0;
  });

  // UI reset
  DOM.crashOverlay.classList.remove('active');
  DOM.resultPopup.classList.remove('show');
  DOM.countdownOverlay.style.display = 'flex';
  DOM.multiplierValue.style.display  = 'block';
  updateMultiplierUI(1.00);
  DOM.multiplierLabel.textContent = 'NEXT ROUND';

  DOM[`btnCashA`].textContent = 'CASH OUT';
  DOM[`btnCashB`].textContent = 'CASH OUT';
  DOM[`potWinA`].textContent  = 'WIN: —';
  DOM[`potWinB`].textContent  = 'WIN: —';
  DOM[`potWinA`].style.color  = '';
  DOM[`potWinB`].style.color  = '';

  setBetControlsState('lobby');
  renderLiveBets();
  updateStatsUI();

  DOM.fairNext.textContent = gameState.seed.slice(0, 32) + '... (hash)';

  // Countdown
  countdownIval = setInterval(() => {
    gameState.countdownSec--;
    audio.playCountdownTick();
    DOM.countdownText.textContent = gameState.countdownSec > 0 ? `${gameState.countdownSec}` : 'GO!';
    if (gameState.countdownSec <= 0) {
      clearInterval(countdownIval);
      DOM.countdownOverlay.style.display = 'none';
      startFlight();
    }
  }, 1000);

  DOM.countdownText.textContent = '5';
  DOM.countdownSub.textContent  = 'NEXT ROUND';
}

function startFlight() {
  audio.playCountdownGo();
  gameState.phase      = 'flying';
  gameState.roundStart = Date.now();
  DOM.multiplierLabel.textContent = 'ALTITUDE';
  setBetControlsState('flying');
  audio.startEngine();
}

function doCrash() {
  gameState.phase = 'crashed';
  const cp        = gameState.crashPoint;

  // Count losses & compute round P&L
  let roundTotalBet = 0, roundTotalWon = 0, roundCashedAt = null;
  ['A','B'].forEach(s => {
    const b = gameState.bets[s];
    if (!b.placed) return;
    roundTotalBet += b.amount;
    if (b.cashedOut) {
      roundTotalWon  += b.amount * b.cashMult;
      roundCashedAt   = Math.max(roundCashedAt || 0, b.cashMult);
    } else {
      gameState.sessionStats.losses++;
      gameState.sessionStats.netPnl -= b.amount;
    }
  });
  gameState.sessionStats.rounds++;

  // Sync balance back to user account in localStorage
  const _session = localStorage.getItem('aviatarr_session');
  if (_session) {
    try {
      const _users = JSON.parse(localStorage.getItem('aviatarr_users') || '{}');
      if (_users[_session]) {
        _users[_session].balance = gameState.balance;
        localStorage.setItem('aviatarr_users', JSON.stringify(_users));
      }
    } catch(e) {}
  }

  // Update history with full round data for dashboard
  gameState.roundHistory.push({
    seed:       gameState.seed,
    crashPoint: cp,
    totalBet:   roundTotalBet,
    totalWon:   roundTotalWon,
    netPnl:     roundTotalWon - roundTotalBet,
    cashedAt:   roundCashedAt,
    ts:         Date.now(),
  });
  addHistoryPill(cp);
  addSessionRow(cp, gameState.bets.A, gameState.bets.B);
  saveHistory();
  updateStatsUI();

  // Push round to user history via shared.js
  if (typeof DB !== 'undefined' && DB.currentUser()) {
    ['A','B'].forEach(s => {
      const b = gameState.bets[s];
      if (b && b.placed) {
        DB.pushGameRound({
          round: gameState.sessionStats.rounds,
          bet: b.amount,
          crashPoint: cp,
          cashedOut: b.cashedOut,
          cashoutMultiplier: b.cashedOut ? b.cashMult : null,
          profit: b.cashedOut ? +(b.amount * b.cashMult - b.amount).toFixed(2) : -b.amount,
          win: b.cashedOut ? +(b.amount * b.cashMult).toFixed(2) : 0,
          time: new Date().toISOString(),
        });
      }
    });
  }

  // Crash visuals
  audio.playCrash();
  DOM.crashOverlay.classList.add('active');
  // Shockwave
  const sw = document.createElement('div');
  sw.className = 'shockwave';
  DOM.crashOverlay.appendChild(sw);
  setTimeout(() => sw.remove(), 900);

  // Result popup
  updateMultiplierUI(cp);
  showResultPopup(cp);
  setBetControlsState('result');
  DOM.fairSeed.textContent = gameState.seed;

  // Result timer
  let countdown = 3;
  DOM.resultNextTimer.textContent = countdown;
  resultTimer = setInterval(() => {
    countdown--;
    DOM.resultNextTimer.textContent = countdown;
    if (countdown <= 0) {
      clearInterval(resultTimer);
      startLobby();
    }
  }, 1000);
}

function showResultPopup(cp) {
  const popup = DOM.resultPopup;
  let anyBet  = gameState.bets.A.placed || gameState.bets.B.placed;

  if (!anyBet) {
    DOM.resultMult.textContent = `${fmt(cp)}×`;
    DOM.resultMult.className   = 'result-multiplier crash';
    DOM.resultWinLoss.textContent = 'CRASHED';
    DOM.resultWinLoss.className   = 'result-winloss crash';
  } else {
    // Check if we had any win
    let totalWin = 0;
    let totalBet = 0;
    ['A','B'].forEach(s => {
      const b = gameState.bets[s];
      if (!b.placed) return;
      totalBet += b.amount;
      if (b.cashedOut) totalWin += b.amount * b.cashMult;
    });
    const profit = totalWin - totalBet;
    if (totalWin > 0) {
      DOM.resultMult.textContent = `+${fmtCoins(profit)}`;
      DOM.resultMult.className   = 'result-multiplier win';
      DOM.resultWinLoss.textContent = profit >= 0 ? '🏆 YOU WON!' : 'PARTIAL LOSS';
      DOM.resultWinLoss.className   = 'result-winloss win';
    } else {
      DOM.resultMult.textContent = `${fmt(cp)}×`;
      DOM.resultMult.className   = 'result-multiplier crash';
      DOM.resultWinLoss.textContent = `💥 CRASHED — LOST ${fmtCoins(totalBet)}`;
      DOM.resultWinLoss.className   = 'result-winloss crash';
    }
  }

  popup.classList.add('show');
}

/* ═══════════════════════════════════════════════
   MAIN GAME LOOP
═══════════════════════════════════════════════ */
function gameLoop() {
  const now = Date.now();

  if (gameState.phase === 'flying') {
    const elapsed = now - gameState.roundStart;
    const m       = Math.exp(CFG.MULTIPLIER_EXP * elapsed);
    gameState.multiplier = parseFloat(m.toFixed(2));
    updateMultiplierUI(gameState.multiplier);
    updatePotentialWins();
    audio.updateEnginePitch(gameState.multiplier);

    // Auto-cashout check
    ['A','B'].forEach(s => {
      const b = gameState.bets[s];
      if (b.placed && !b.cashedOut && b.autoEnabled && gameState.multiplier >= b.autoAt) {
        cashOut(s);
      }
    });

    // Bot auto cashout
    for (const bot of gameState.bots) {
      if (bot.status === 'flying' && bot.cashoutMult !== null && gameState.multiplier >= bot.cashoutMult) {
        bot.status = 'cashed';
      }
    }

    // Occasional live bet re-render (every ~0.5s)
    if (Math.floor(elapsed / 500) !== Math.floor((elapsed - CFG.TICK_MS) / 500)) {
      renderLiveBets();
    }

    // Check crash
    if (gameState.multiplier >= gameState.crashPoint) {
      gameState.multiplier = gameState.crashPoint;
      updateMultiplierUI(gameState.multiplier);
      // Mark remaining bots as lost
      for (const bot of gameState.bots) {
        if (bot.status === 'flying') bot.status = 'lost';
      }
      renderLiveBets();
      doCrash();
    }
  }

  // Render canvas
  renderer.updatePlane(now, gameState.phase, gameState.multiplier);
  renderer.render(gameState.phase, gameState.multiplier);
}

/* ═══════════════════════════════════════════════
   SIDEBAR TABS
═══════════════════════════════════════════════ */
function initTabs() {
  document.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panelId = `panel${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`;
      document.getElementById(panelId)?.classList.add('active');
    });
  });
}

/* ═══════════════════════════════════════════════
   QUICK BET BUTTONS
═══════════════════════════════════════════════ */
function initQuickBets() {
  document.querySelectorAll('.quick-bet').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot  = btn.dataset.slot;
      const val   = btn.dataset.val;
      const input = DOM[`betAmount${slot}`];
      let cur     = parseFloat(input.value) || 100;
      if (val === '50')     input.value = Math.max(CFG.MIN_BET, Math.floor(cur / 2));
      else if (val === 'double') input.value = Math.min(CFG.MAX_BET, cur * 2);
      else if (val === 'max')    input.value = Math.min(CFG.MAX_BET, gameState.balance);
    });
  });
}

/* ═══════════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════════ */
function initEvents() {
  // Bet buttons
  DOM.btnBetA.addEventListener('click',  () => placeBet('A'));
  DOM.btnBetB.addEventListener('click',  () => placeBet('B'));
  DOM.btnCashA.addEventListener('click', () => cashOut('A'));
  DOM.btnCashB.addEventListener('click', () => cashOut('B'));

  // Mute
  DOM.muteBtn.addEventListener('click', () => {
    gameState.muted = !gameState.muted;
    audio.setMuted(gameState.muted);
    DOM.muteBtn.textContent = gameState.muted ? '🔇' : '🔊';
    showToast(gameState.muted ? 'Sound muted' : 'Sound on', 'info');
  });

  // Provably fair modal
  document.getElementById('pfBadge').addEventListener('click', () => {
    DOM.fairModal.classList.add('open');
  });
  document.getElementById('fairClose').addEventListener('click', () => {
    DOM.fairModal.classList.remove('open');
  });
  DOM.fairModal.addEventListener('click', (e) => {
    if (e.target === DOM.fairModal) DOM.fairModal.classList.remove('open');
  });

  // Keyboard: spacebar to bet/cashout
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      if (gameState.phase === 'lobby') {
        if (!gameState.bets.A.placed) placeBet('A');
        else if (!gameState.bets.B.placed) placeBet('B');
      } else if (gameState.phase === 'flying') {
        if (gameState.bets.A.placed && !gameState.bets.A.cashedOut) cashOut('A');
        else if (gameState.bets.B.placed && !gameState.bets.B.cashedOut) cashOut('B');
      }
    }
    if (e.code === 'KeyM') {
      DOM.muteBtn.click();
    }
  });

  // Audio context: resume on first interaction
  document.addEventListener('click', () => {
    if (!audio.ctx) {
      audio._init();
    } else if (audio.ctx.state === 'suspended') {
      audio.ctx.resume();
    }
  }, { once: false });
}

/* ═══════════════════════════════════════════════
   BOOTSTRAP HISTORY
═══════════════════════════════════════════════ */
function bootstrapHistory() {
  // Populate history bar from saved rounds
  const toShow = gameState.roundHistory.slice(-CFG.HISTORY_MAX).reverse();
  for (const r of toShow) addHistoryPill(r.crashPoint);
}

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
function init() {
  // ── Session integration ──
  // Load balance from logged-in user account, fall back to localStorage game balance
  try {
    const _session = localStorage.getItem('aviatarr_session');
    const _users   = JSON.parse(localStorage.getItem('aviatarr_users') || '{}');
    if (_session && _users[_session]) {
      const _user = _users[_session];
      // Set nav avatar
      const _av = document.getElementById('gameNavAvatar');
      if (_av) _av.textContent = (_user.username || '?')[0].toUpperCase();
      // Use user's stored balance as source of truth
      const _bal = _user.balance;
      if (_bal !== undefined && !isNaN(_bal)) {
        gameState.balance = _bal;
        localStorage.setItem('aviatarr_balance', String(_bal));
      }
      // Show admin link if admin
      if (_user.isAdmin) {
        const adminLink = document.createElement('a');
        adminLink.href  = 'admin.html';
        adminLink.title = 'Admin Panel';
        adminLink.style.cssText = 'display:flex;align-items:center;gap:5px;color:var(--accent-red);font-family:var(--font-display);font-size:10px;letter-spacing:1px;text-decoration:none;border:1px solid rgba(255,34,68,0.3);border-radius:6px;padding:4px 10px;';
        adminLink.innerHTML = '🛡 ADMIN';
        document.querySelector('.header-right').insertBefore(adminLink, document.getElementById('dashLink'));
      }
    } else {
      // Not logged in — redirect to auth (guest play still allowed via demo)
      const _av = document.getElementById('gameNavAvatar');
      if (_av) { _av.href='auth.html'; _av.textContent='→'; _av.title='Login to save progress'; }
    }
  } catch(e) { console.warn('Session load error:', e); }

  loadHistory();
  bootstrapHistory();
  initAutoToggles();
  initQuickBets();
  initTabs();
  initEvents();
  updateStatsUI();
  updateBalance(gameState.balance);

  // Kick off game loop
  loopInterval = setInterval(gameLoop, CFG.TICK_MS);

  // Start first lobby immediately
  startLobby();

  console.log(
    '%c AviaTarr Phase 2 Engine Loaded ',
    'background:#00f5ff;color:#040814;font-weight:bold;font-size:14px;padding:4px 8px;border-radius:4px;'
  );
}

// Wait for fonts before starting
document.fonts.ready.then(init);
