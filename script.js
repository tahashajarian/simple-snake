const xyCells = 20; // board is xyCells × xyCells
const baseSpeed = 125; // ms per step at the start
const minSpeed = 75; // fastest it gets as the snake grows
const swipeThreshold = 24; // px a finger must travel to count as a swipe

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
const KEYS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

const canvas = document.querySelector("#playGround");
const ctx = canvas.getContext("2d");
const hintEl = document.querySelector("#startHint");
const lostEl = document.querySelector("#lost");
const scoreEl = document.querySelector("#currentScore");
const bestEl = document.querySelector("#highestScore");
const isTouch = window.matchMedia("(pointer: coarse)").matches;

document.querySelector("#hintText").textContent = isTouch
  ? "Swipe or tap an arrow to start"
  : "Press an arrow key to start";

let cellSize = 15;
let boardPx = 300;
let snake = []; // [{x, y}], head first
let prevSnake = []; // positions one step ago, for smooth in-between drawing
let food = null;
let direction = null; // direction applied on the last step
let queue = []; // pending turns, so two quick presses between steps both count
let lastStep = 0;
let stop = false;
let dead = false;
let deadAt = 0;
let currentScore = 0;
let particles = [];
let popups = [];

let highestScore = 0;
try {
  highestScore = parseInt(localStorage.getItem("highestScore")) || 0;
} catch (e) {}

const stepTime = () => Math.max(minSpeed, baseSpeed - currentScore * 2.5);

// ---------- input ----------

const turn = (dir) => {
  if (stop) return;
  const last = queue.length ? queue[queue.length - 1] : direction;
  if (dir === last || (last && dir === OPPOSITE[last])) return;
  if (queue.length < 2) queue.push(dir);
  if (!direction) lastStep = performance.now(); // start moving right away
  hintEl.classList.add("hidden");
};

window.addEventListener("keydown", (e) => {
  const dir = KEYS[e.key] || KEYS[e.key.toLowerCase()];
  if (dir) {
    e.preventDefault();
    turn(dir);
  } else if ((e.key === "Enter" || e.key === " ") && stop && lostEl.style.display === "flex") {
    e.preventDefault();
    restart();
  }
});

// Swipe anywhere on the page. After each recognised swipe the start point
// resets, so one continuous drag can steer several turns.
let touchStart = null;
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  touchStart = { x: e.clientX, y: e.clientY };
});
document.addEventListener("pointermove", (e) => {
  if (!touchStart) return;
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < swipeThreshold) return;
  if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? "right" : "left");
  else turn(dy > 0 ? "down" : "up");
  touchStart = { x: e.clientX, y: e.clientY };
});
const endTouch = () => (touchStart = null);
document.addEventListener("pointerup", endTouch);
document.addEventListener("pointercancel", endTouch);

document.querySelectorAll("#dpad button").forEach((btn) => {
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation(); // don't also start a swipe
    turn(btn.dataset.dir);
    btn.classList.add("pressed");
  });
  const release = () => btn.classList.remove("pressed");
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointerleave", release);
  btn.addEventListener("pointercancel", release);
});

document.querySelector("#restartBtn").addEventListener("click", () => restart());

// iOS still bounces/scrolls on touchmove unless it's cancelled explicitly.
document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

// ---------- layout ----------

const resize = () => {
  const reserved = 16 + 50 + 14 + 12 + (isTouch ? 14 + 186 : 0) + 24;
  const avail = Math.min(window.innerWidth - 32 - 12, window.innerHeight - reserved, 560);
  cellSize = Math.max(10, Math.floor(avail / xyCells));
  boardPx = cellSize * xyCells;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = boardPx + "px";
  canvas.style.height = boardPx + "px";
  canvas.width = boardPx * dpr;
  canvas.height = boardPx * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  document.querySelector("#top").style.width = boardPx + 12 + "px";
};
window.addEventListener("resize", resize);

// ---------- game ----------

const putFoodOnPlayGround = () => {
  const free = [];
  for (let y = 0; y < xyCells; y++) {
    for (let x = 0; x < xyCells; x++) {
      if (!snake.some((p) => p.x === x && p.y === y)) free.push({ x, y });
    }
  }
  food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  foodBorn = performance.now();
};
let foodBorn = 0;

const bump = (el) => {
  el.classList.remove("bump");
  void el.offsetWidth; // restart the animation
  el.classList.add("bump");
};

// Best updates live the moment you pass your record (it's saved on game over).
const updateScoreDisplay = () => {
  scoreEl.textContent = currentScore;
  const shownBest = Math.max(highestScore, currentScore);
  if (String(shownBest) !== bestEl.textContent && currentScore > highestScore) bump(bestEl);
  bestEl.textContent = shownBest;
};

const burst = (cx, cy) => {
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (0.6 + Math.random() * 1.6) * cellSize * 0.12;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 1,
      color: Math.random() < 0.6 ? "#ff5d73" : "#ffd166",
    });
  }
  popups.push({ x: cx, y: cy, life: 1 });
};

const lost = () => {
  stop = true;
  dead = true;
  deadAt = performance.now();
  const isBest = currentScore > highestScore;
  const prevBest = highestScore;
  if (isBest) {
    highestScore = currentScore;
    try {
      localStorage.setItem("highestScore", highestScore);
    } catch (e) {}
  }
  document.querySelector("#score").textContent = currentScore;
  document.querySelector("#newBest").hidden = !(isBest && currentScore > 0);
  document.querySelector("#bestLine").textContent = isBest
    ? prevBest
      ? `Previous best: ${prevBest}`
      : "Your first record!"
    : `Best: ${highestScore}`;
  updateScoreDisplay();
  if (navigator.vibrate) navigator.vibrate(60);
  // Let the crash animation play before the card appears.
  setTimeout(() => {
    if (dead) lostEl.style.display = "flex";
  }, 650);
};

const update = () => {
  prevSnake = snake.map((p) => ({ x: p.x, y: p.y }));
  if (queue.length) direction = queue.shift();
  if (!direction) return; // waiting for the first input

  const head = snake[0];
  const next = { x: head.x + DIRS[direction].x, y: head.y + DIRS[direction].y };

  if (next.x < 0 || next.y < 0 || next.x >= xyCells || next.y >= xyCells) {
    prevSnake = snake.map((p) => ({ x: p.x, y: p.y }));
    return lost();
  }

  const eating = food && next.x === food.x && next.y === food.y;
  // The tail moves away this step unless we're growing, so it's safe to enter.
  const body = eating ? snake : snake.slice(0, -1);
  if (body.some((p) => p.x === next.x && p.y === next.y)) {
    prevSnake = snake.map((p) => ({ x: p.x, y: p.y }));
    return lost();
  }

  snake.unshift(next);
  if (eating) {
    currentScore++;
    burst((food.x + 0.5) * cellSize, (food.y + 0.5) * cellSize);
    bump(scoreEl);
    updateScoreDisplay();
    putFoodOnPlayGround();
    if (navigator.vibrate) navigator.vibrate(15);
  } else {
    snake.pop();
  }
};

// ---------- drawing ----------

const lerp = (a, b, t) => a + (b - a) * t;
const mixColor = (c1, c2, t) =>
  `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;
const HEAD = [190, 255, 110];
const TAIL = [24, 160, 100];
const DEAD_HEAD = [255, 120, 120];
const DEAD_TAIL = [110, 50, 60];

const drawBoard = () => {
  ctx.fillStyle = "#0b1a13";
  ctx.fillRect(0, 0, boardPx, boardPx);
  ctx.fillStyle = "#0e2018";
  for (let y = 0; y < xyCells; y++) {
    for (let x = (y % 2); x < xyCells; x += 2) {
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }
};

const drawFood = (now) => {
  if (!food) return;
  const cx = (food.x + 0.5) * cellSize;
  const cy = (food.y + 0.5) * cellSize;
  const grow = Math.min(1, (now - foodBorn) / 250); // pop in
  const pulse = 1 + Math.sin(now / 220) * 0.06;
  const r = cellSize * 0.36 * pulse * (0.4 + 0.6 * grow);

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cellSize * 1.2);
  glow.addColorStop(0, "rgba(255, 80, 110, 0.35)");
  glow.addColorStop(1, "rgba(255, 80, 110, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - cellSize * 1.2, cy - cellSize * 1.2, cellSize * 2.4, cellSize * 2.4);

  const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  body.addColorStop(0, "#ff9aa8");
  body.addColorStop(0.45, "#ff4d6d");
  body.addColorStop(1, "#c41e3a");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.05, r, 0, Math.PI * 2);
  ctx.fill();

  // leaf
  ctx.fillStyle = "#5bd96b";
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.35, cy - r * 0.95, r * 0.38, r * 0.18, -0.6, 0, Math.PI * 2);
  ctx.fill();
};

const drawSnake = (t, now) => {
  const n = snake.length;
  // Smoothly place each segment between where it was and where it is.
  const pts = snake.map((p, i) => {
    const q = prevSnake[i] || p;
    return { x: (lerp(q.x, p.x, t) + 0.5) * cellSize, y: (lerp(q.y, p.y, t) + 0.5) * cellSize };
  });
  const flash = dead && now - deadAt < 600 && Math.floor((now - deadAt) / 100) % 2 === 0;
  const head = dead && !flash ? DEAD_HEAD : HEAD;
  const tail = dead && !flash ? DEAD_TAIL : TAIL;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // soft shadow under the body
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = cellSize * 0.8;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x + 2, p.y + 3) : ctx.moveTo(p.x + 2, p.y + 3)));
  if (n === 1) ctx.lineTo(pts[0].x + 2.01, pts[0].y + 3);
  ctx.stroke();

  // body, tail to head, tapering and shading along its length
  for (let i = n - 1; i >= 1; i--) {
    const k = n > 1 ? i / (n - 1) : 0;
    ctx.strokeStyle = mixColor(head, tail, k);
    ctx.lineWidth = cellSize * lerp(0.8, 0.55, k);
    ctx.beginPath();
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[i - 1].x, pts[i - 1].y);
    ctx.stroke();
  }

  // head
  const h = pts[0];
  const d = DIRS[direction || "right"];
  const r = cellSize * 0.52;
  const hg = ctx.createRadialGradient(h.x - r * 0.3, h.y - r * 0.3, r * 0.1, h.x, h.y, r);
  hg.addColorStop(0, "#eaffb0");
  hg.addColorStop(1, mixColor(head, tail, 0.1));
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
  ctx.fill();

  // eyes look where the snake is heading
  const px = -d.y;
  const py = d.x;
  const blink = !dead && now % 3200 < 120;
  for (const s of [-1, 1]) {
    const ex = h.x + d.x * r * 0.25 + px * r * 0.42 * s;
    const ey = h.y + d.y * r * 0.25 + py * r * 0.42 * s;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    if (blink) ctx.ellipse(ex, ey, r * 0.24, r * 0.06, Math.atan2(d.y, d.x) + Math.PI / 2, 0, Math.PI * 2);
    else ctx.arc(ex, ey, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    if (!blink) {
      ctx.fillStyle = dead ? "#5a0b14" : "#0a1f12";
      ctx.beginPath();
      if (dead) {
        // little x eyes
        ctx.lineWidth = Math.max(1.5, r * 0.08);
        ctx.strokeStyle = "#5a0b14";
        const q = r * 0.12;
        ctx.moveTo(ex - q, ey - q);
        ctx.lineTo(ex + q, ey + q);
        ctx.moveTo(ex + q, ey - q);
        ctx.lineTo(ex - q, ey + q);
        ctx.stroke();
      } else {
        ctx.arc(ex + d.x * r * 0.09, ey + d.y * r * 0.09, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
};

const drawEffects = (dt) => {
  for (const p of particles) {
    p.x += p.vx * dt * 0.06;
    p.y += p.vy * dt * 0.06;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.life -= dt / 550;
    if (p.life <= 0) continue;
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, cellSize * 0.11 * p.life + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  particles = particles.filter((p) => p.life > 0);

  ctx.font = `800 ${Math.round(cellSize * 0.9)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  for (const p of popups) {
    p.life -= dt / 800;
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.min(1, p.life * 1.5);
    ctx.fillStyle = "#ffd166";
    ctx.fillText("+1", p.x, p.y - (1 - p.life) * cellSize * 1.6);
  }
  popups = popups.filter((p) => p.life > 0);
  ctx.globalAlpha = 1;
};

// ---------- loop ----------

let lastFrame = performance.now();
const run = (now) => {
  const dt = Math.min(now - lastFrame, 50);
  lastFrame = now;

  if (!stop && direction !== null || (!stop && queue.length)) {
    if (now - lastStep >= stepTime()) {
      lastStep = now;
      update();
    }
  }
  const t = stop || !direction ? 1 : Math.min(1, (now - lastStep) / stepTime());

  ctx.save();
  if (dead && now - deadAt < 350) {
    const k = 1 - (now - deadAt) / 350;
    ctx.translate((Math.random() - 0.5) * 8 * k, (Math.random() - 0.5) * 8 * k);
  }
  drawBoard();
  drawFood(now);
  drawSnake(t, now);
  drawEffects(dt);
  ctx.restore();

  requestAnimationFrame(run);
};

const restart = () => {
  const mid = Math.floor(xyCells / 2);
  snake = [{ x: mid, y: mid }];
  prevSnake = [{ x: mid, y: mid }];
  direction = null;
  queue = [];
  currentScore = 0;
  stop = false;
  dead = false;
  particles = [];
  popups = [];
  lostEl.style.display = "none";
  hintEl.classList.remove("hidden");
  putFoodOnPlayGround();
  updateScoreDisplay();
};

resize();
restart();
requestAnimationFrame(run);
