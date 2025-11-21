import "./style.css";
import Two from "two.js";

import Leaderboard from "./leaderboardSystem";
import notifier from "./notifier";

const LDBoard = Leaderboard({
  getGameRunning() {
    return false;
  },
  kvAPIKey: "kartpole",
  notifier: notifier,
});

(window as any).lb = LDBoard;

let plname: string | null = null;
const namePrompt = () => {
  // allow only english in lowercase, numbers, _, -
  if (plname != null) return plname;
  const name = prompt(
    "이름을 입력하세요 (영어 소문자, 숫자, _, - 만 가능, 최대 10자)"
  );
  if (!name) return null;
  if (name.length > 10) {
    alert("이름이 너무 깁니다. 최대 10자까지 가능합니다.");
    return namePrompt();
  }
  if (!/^[a-z0-9_-]+$/.test(name)) {
    alert("이름에 허용되지 않는 문자가 포함되어 있습니다.");
    return namePrompt();
  }
  plname = name;
  return name;
};

// Game constants
const WIDTH = 800;
const HEIGHT = 600;
const FPS = 60;
const FRAME_TIME = 1000 / FPS;

const CART_WIDTH = 80;
const CART_HEIGHT = 40;
const POLE_LENGTH = 200;
const POLE_WIDTH = 10;

const GRAVITY = 18.0;
const CART_MASS = 1.0;
const POLE_MASS = 0.15;
const FORCE_MAG = 15.0;

// Game state
let gameRunning = false;
let score = 0;
let lastFrameTime = 0;

// Physics state
let cartX = WIDTH / 2;
let cartVelocity = 0;
let poleAngle = 0.1; // Start with small angle
let poleAngularVelocity = 0;

// Setup Two.js
const elem = document.createElement("div");
elem.id = "game-container";
document.body.appendChild(elem);

const two = new Two({
  width: WIDTH,
  height: HEIGHT,
}).appendTo(elem);

// Create UI
const scoreText = document.createElement("div");
scoreText.style.cssText =
  "position: absolute; top: 20px; left: 20px; font-size: 24px; font-weight: bold; color: white; text-shadow: 2px 2px 4px black;";
elem.style.position = "relative";
elem.appendChild(scoreText);

const instructions = document.createElement("div");
instructions.style.cssText =
  "position: absolute; top: 60px; left: 20px; font-size: 16px; color: white; text-shadow: 2px 2px 4px black;";
instructions.innerHTML =
  "Press LEFT/RIGHT arrows or A/D to move the cart<br/>Keep the pole balanced!";
elem.appendChild(instructions);

// Create ground
const ground = two.makeLine(0, HEIGHT - 100, WIDTH, HEIGHT - 100);
ground.stroke = "#666";
ground.linewidth = 3;

// Create cart
const cart = two.makeRectangle(cartX, HEIGHT - 120, CART_WIDTH, CART_HEIGHT);
cart.fill = "#4CAF50";
cart.stroke = "#2E7D32";
cart.linewidth = 3;

// Create pole
const pole = two.makeLine(0, 0, 0, -POLE_LENGTH);
pole.stroke = "#FF5722";
pole.linewidth = POLE_WIDTH;
pole.cap = "round";

// Group for pole rotation
const poleGroup = two.makeGroup(pole);
poleGroup.translation.set(cartX, HEIGHT - 120 - CART_HEIGHT / 2);

// Physics update
function updatePhysics(dt: number) {
  const totalMass = CART_MASS + POLE_MASS;
  const poleMassLength = (POLE_MASS * POLE_LENGTH) / 2;

  const cosTheta = Math.cos(poleAngle);
  const sinTheta = Math.sin(poleAngle);

  // Get force from input
  let force = 0;
  if (keys["ArrowLeft"] || keys["a"]) force = -FORCE_MAG;
  if (keys["ArrowRight"] || keys["d"]) force = FORCE_MAG;

  // Calculate accelerations using cart-pole equations
  const temp =
    (force +
      poleMassLength * poleAngularVelocity * poleAngularVelocity * sinTheta) /
    totalMass;
  const poleAngularAccel =
    (GRAVITY * sinTheta - cosTheta * temp) /
    ((POLE_LENGTH / 2) *
      (4.0 / 3.0 - (POLE_MASS * cosTheta * cosTheta) / totalMass));
  const cartAccel =
    temp - (poleMassLength * poleAngularAccel * cosTheta) / totalMass;

  // Update velocities and positions (6x speed)
  cartVelocity += cartAccel * dt * 6;
  cartX += cartVelocity * dt * 6;

  poleAngularVelocity += poleAngularAccel * dt * 6;
  poleAngle += poleAngularVelocity * dt * 6;

  // Keep cart in bounds
  if (cartX < CART_WIDTH / 2) {
    cartX = CART_WIDTH / 2;
    cartVelocity = 0;
  }
  if (cartX > WIDTH - CART_WIDTH / 2) {
    cartX = WIDTH - CART_WIDTH / 2;
    cartVelocity = 0;
  }

  // Check failure conditions (45 degree tolerance or pole tip hits ground)
  const poleTipY =
    HEIGHT - 120 - CART_HEIGHT / 2 - (POLE_LENGTH / 2) * Math.cos(poleAngle);

  if (
    Math.abs(poleAngle) > Math.PI / 4 ||
    cartX <= CART_WIDTH / 2 ||
    cartX >= WIDTH - CART_WIDTH / 2 ||
    poleTipY >= HEIGHT - 100
  ) {
    // Ground level
    gameOver();
  }
}

// Render update
function render() {
  cart.translation.set(cartX, HEIGHT - 120);
  poleGroup.translation.set(cartX, HEIGHT - 120 - CART_HEIGHT / 2);
  poleGroup.rotation = poleAngle;
}

// Keyboard input
const keys: { [key: string]: boolean } = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  keys[e.key.toLowerCase()] = true;
  if (!gameRunning && e.key === " ") {
    startGame();
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
  keys[e.key.toLowerCase()] = false;
});

// Game loop with fixed FPS
function gameLoop(currentTime: number) {
  if (!gameRunning) {
    requestAnimationFrame(gameLoop);
    return;
  }

  const elapsed = currentTime - lastFrameTime;

  if (elapsed >= FRAME_TIME) {
    lastFrameTime = currentTime - (elapsed % FRAME_TIME);

    // Update physics at fixed timestep
    updatePhysics(1 / FPS);

    // Increment score (one point per frame)
    score++;
    scoreText.textContent = `Score: ${score} frames`;

    // Render
    render();
    two.update();
  }

  requestAnimationFrame(gameLoop);
}

function startGame() {
  gameRunning = true;
  score = 0;
  cartX = WIDTH / 2;
  cartVelocity = 0;
  poleAngle = Math.random() * 0.1 - 0.05; // Small random initial angle
  poleAngularVelocity = 0; // Start with no angular velocity
  lastFrameTime = performance.now();
  instructions.style.display = "none";
  scoreText.textContent = `Score: ${score} frames`;
}

function gameOver() {
  gameRunning = false;
  instructions.innerHTML = `Game Over! Final Score: ${score} frames<br/>Press SPACE to restart`;
  instructions.style.display = "block";
  let nm = namePrompt();
  if (nm) {
    LDBoard.saveScore(nm, score, (score / 60).toFixed(2) + "s");
  }
}

// Initial render
render();
two.update();

// Start game loop
lastFrameTime = performance.now();
requestAnimationFrame(gameLoop);

// Show initial message
instructions.innerHTML += "<br/>Press SPACE to start";

console.log("Cart Pole Game Ready! Press SPACE to start.");
