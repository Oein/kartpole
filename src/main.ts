import "./style.css";
import Two from "two.js";

import Leaderboard from "./leaderboardSystem";
import notifier from "./notifier";
import createButton from "./buttons";

const mode: "easy" | "hard" =
  new URLSearchParams(window.location.search).get("mode") == "hard"
    ? "hard"
    : "easy";

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

type GameOverListener = (score: number) => void;

interface KeyBindings {
  left: string[];
  right: string[];
}

type KeyBindingsInput =
  | { left: string | string[]; right: string | string[] }
  | [string | string[], string | string[]];

class KartPoleGame {
  private gameRunning = false;
  private score = 0;
  private lastFrameTime = 0;

  // Physics state
  private cartX = WIDTH / 2;
  private cartVelocity = 0;
  private poleAngle = 0.1;
  private poleAngularVelocity = 0;

  // Two.js setup
  private elem: HTMLElement;
  private two: Two;
  private scoreText: HTMLElement;
  private instructions: HTMLElement;
  private cart: any;
  private poleGroup: any;
  private keys: { [key: string]: boolean } = {};

  // Keybindings
  private keyBindings: KeyBindings;

  // Event emitter
  private gameOverListeners: GameOverListener[] = [];

  constructor(
    keyBindings: KeyBindingsInput = { left: "ArrowLeft", right: "ArrowRight" },
    container?: HTMLElement | string
  ) {
    // Normalize keybindings to object format with arrays
    let left: string[];
    let right: string[];

    if (Array.isArray(keyBindings)) {
      left = Array.isArray(keyBindings[0]) ? keyBindings[0] : [keyBindings[0]];
      right = Array.isArray(keyBindings[1]) ? keyBindings[1] : [keyBindings[1]];
    } else {
      left = Array.isArray(keyBindings.left)
        ? keyBindings.left
        : [keyBindings.left];
      right = Array.isArray(keyBindings.right)
        ? keyBindings.right
        : [keyBindings.right];
    }

    this.keyBindings = { left, right };

    // Setup container
    if (container) {
      if (typeof container === "string") {
        const elem = document.querySelector(container);
        if (!elem) {
          throw new Error(`Container not found: ${container}`);
        }
        this.elem = elem as HTMLElement;
      } else {
        this.elem = container;
      }
    } else {
      this.elem = document.createElement("div");
      this.elem.id = "game-container";
      document.body.appendChild(this.elem);
    }

    // Setup Two.js
    this.elem.style.cssText = `
      position: relative;
      width: 100%;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 0;
      margin: 0;
      box-sizing: border-box;
    `;

    // Create wrapper for canvas to handle scaling
    const canvasWrapper = document.createElement("div");
    canvasWrapper.style.cssText = `
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    this.elem.appendChild(canvasWrapper);

    this.two = new Two({
      width: WIDTH,
      height: HEIGHT,
    }).appendTo(canvasWrapper);
    this.two.renderer.domElement.style.minWidth = `${WIDTH}px`;
    this.two.renderer.domElement.style.minHeight = `${HEIGHT}px`;
    this.two.renderer.domElement.style.border = "1px solid #000";

    // Add resize handler to maintain scale
    const handleResize = () => {
      const canvas =
        canvasWrapper.querySelector("svg") ||
        canvasWrapper.querySelector("canvas");
      if (!canvas) return;

      const containerWidth = this.elem.clientWidth;
      const containerHeight = this.elem.clientHeight;
      const scaleX = containerWidth / WIDTH;
      const scaleY = containerHeight / HEIGHT;
      const scale = Math.min(scaleX, scaleY);

      // Apply scale to canvas
      (canvas as HTMLElement).style.transform = `scale(${scale})`;
      (canvas as HTMLElement).style.transformOrigin = "center";
      (canvas as HTMLElement).style.width = `${WIDTH}px`;
      (canvas as HTMLElement).style.height = `${HEIGHT}px`;

      // Adjust wrapper size to match scaled dimensions
      canvasWrapper.style.width = `${WIDTH * scale}px`;
      canvasWrapper.style.height = `${HEIGHT * scale}px`;
    };

    window.addEventListener("resize", handleResize);
    // Initial scale
    setTimeout(handleResize, 0);

    // Create UI
    this.scoreText = document.createElement("div");
    this.scoreText.style.cssText =
      "position: absolute; top: 20px; left: 20px; font-size: 24px; font-weight: bold; color: white; text-shadow: 2px 2px 4px black;";
    this.elem.appendChild(this.scoreText);

    this.instructions = document.createElement("div");
    this.instructions.style.cssText =
      "position: absolute; top: 60px; left: 20px; font-size: 16px; color: white; text-shadow: 2px 2px 4px black;";
    this.instructions.innerHTML = `Press ${this.keyBindings.left.join(
      "/"
    )}/${this.keyBindings.right.join(
      "/"
    )} to move the cart<br/>Keep the pole balanced!`;
    this.elem.appendChild(this.instructions);

    // Create ground
    const ground = this.two.makeLine(0, HEIGHT - 100, WIDTH, HEIGHT - 100);
    ground.stroke = "#666";
    ground.linewidth = 3;

    // Create cart
    this.cart = this.two.makeRectangle(
      this.cartX,
      HEIGHT - 120,
      CART_WIDTH,
      CART_HEIGHT
    );
    this.cart.fill = "#4CAF50";
    this.cart.stroke = "#2E7D32";
    this.cart.linewidth = 3;

    // Create pole
    const pole = this.two.makeLine(0, 0, 0, -POLE_LENGTH);
    pole.stroke = "#FF5722";
    pole.linewidth = POLE_WIDTH;
    pole.cap = "round";

    // Group for pole rotation
    this.poleGroup = this.two.makeGroup(pole);
    this.poleGroup.translation.set(this.cartX, HEIGHT - 120 - CART_HEIGHT / 2);

    // Setup keyboard input
    this.setupKeyboardInput();

    // Initial render
    this.render();
    this.two.update();

    // Show initial message
    this.instructions.innerHTML += "<br/>Press SPACE to start";

    // Start game loop
    this.lastFrameTime = performance.now();
    this.gameLoop(this.lastFrameTime);
  }

  onGameOver(listener: GameOverListener) {
    this.gameOverListeners.push(listener);
  }

  private emitGameOver(score: number) {
    this.gameOverListeners.forEach((listener) => listener(score));
  }

  startGame() {
    this.gameRunning = true;
    this.score = 0;
    this.cartX = WIDTH / 2;
    this.cartVelocity = 0;
    this.poleAngle = Math.random() * 0.1 - 0.05;
    this.poleAngularVelocity = 0;
    this.lastFrameTime = performance.now();
    this.instructions.style.display = "none";
    this.scoreText.textContent = `Score: ${this.score} frames`;
  }

  endGame() {
    if (!this.gameRunning) return; // Prevent duplicate endGame calls
    this.gameRunning = false;
    this.instructions.innerHTML = `Game Over! Final Score: ${this.score} frames<br/>Press SPACE to restart`;
    this.instructions.style.display = "block";
    this.emitGameOver(this.score);
  }

  private setupKeyboardInput() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.key] = true;
      this.keys[e.key.toLowerCase()] = true;
      // if (!this.gameRunning && e.key === " ") {
      //   this.startGame();
      // }
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.key] = false;
      this.keys[e.key.toLowerCase()] = false;
    });
  }

  private updatePhysics(dt: number) {
    const totalMass = CART_MASS + POLE_MASS;
    const poleMassLength = (POLE_MASS * POLE_LENGTH) / 2;

    const cosTheta = Math.cos(this.poleAngle);
    const sinTheta = Math.sin(this.poleAngle);

    // Get force from input with custom keybindings
    let force = 0;

    // Check if any left key is pressed
    const leftPressed = this.keyBindings.left.some(
      (key) => this.keys[key] || this.keys[key.toLowerCase()]
    );
    // Check if any right key is pressed
    const rightPressed = this.keyBindings.right.some(
      (key) => this.keys[key] || this.keys[key.toLowerCase()]
    );

    if (leftPressed) force = -FORCE_MAG;
    if (rightPressed) force = FORCE_MAG;

    // Calculate accelerations using cart-pole equations
    const temp =
      (force +
        poleMassLength *
          this.poleAngularVelocity *
          this.poleAngularVelocity *
          sinTheta) /
      totalMass;
    const poleAngularAccel =
      (GRAVITY * sinTheta - cosTheta * temp) /
      ((POLE_LENGTH / 2) *
        (4.0 / 3.0 - (POLE_MASS * cosTheta * cosTheta) / totalMass));
    const cartAccel =
      temp - (poleMassLength * poleAngularAccel * cosTheta) / totalMass;

    // Update velocities and positions (6x speed)
    this.cartVelocity += cartAccel * dt * 6;
    this.cartX += this.cartVelocity * dt * 6;

    this.poleAngularVelocity += poleAngularAccel * dt * 6;
    this.poleAngle += this.poleAngularVelocity * dt * 6;

    // Keep cart in bounds
    if (this.cartX < CART_WIDTH / 2) {
      this.cartX = CART_WIDTH / 2;
      this.cartVelocity = 0;
    }
    if (this.cartX > WIDTH - CART_WIDTH / 2) {
      this.cartX = WIDTH - CART_WIDTH / 2;
      this.cartVelocity = 0;
    }

    // Check failure conditions
    const poleTipY =
      HEIGHT -
      120 -
      CART_HEIGHT / 2 -
      (POLE_LENGTH / 2) * Math.cos(this.poleAngle);

    if (
      Math.abs(this.poleAngle) > Math.PI / 4 ||
      this.cartX <= CART_WIDTH / 2 ||
      this.cartX >= WIDTH - CART_WIDTH / 2 ||
      poleTipY >= HEIGHT - 100
    ) {
      this.endGame();
    }
  }

  private render() {
    this.cart.translation.set(this.cartX, HEIGHT - 120);
    this.poleGroup.translation.set(this.cartX, HEIGHT - 120 - CART_HEIGHT / 2);
    this.poleGroup.rotation = this.poleAngle;
  }

  private gameLoop = (currentTime: number) => {
    if (!this.gameRunning) {
      requestAnimationFrame(this.gameLoop);
      return;
    }

    const elapsed = currentTime - this.lastFrameTime;

    if (elapsed >= FRAME_TIME) {
      this.lastFrameTime = currentTime - (elapsed % FRAME_TIME);

      // Update physics at fixed timestep
      this.updatePhysics(1 / FPS);

      // Increment score
      this.score++;
      this.scoreText.textContent = `Score: ${this.score} frames`;

      // Render
      this.render();
      this.two.update();
    }

    requestAnimationFrame(this.gameLoop);
  };
}

if (mode == "easy") {
  // Initialize game with default or custom keybindings
  const game = new KartPoleGame({
    left: ["ArrowLeft", "a"],
    right: ["ArrowRight", "d"],
  });

  // Setup leaderboard
  const LDBoard = Leaderboard({
    getGameRunning() {
      return false;
    },
    kvAPIKey: "kartpole",
    notifier: notifier,
  });

  (window as any).lb = LDBoard;
  (window as any).game = game;

  let plname: string | null = null;
  const namePrompt = () => {
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

  // Setup game over listener
  game.onGameOver((score) => {
    let nm = namePrompt();
    if (nm) {
      LDBoard.saveScore(nm, score, (score / 60).toFixed(2) + "s");
    }
  });

  console.log("Cart Pole Game Ready! Press SPACE to start.");

  window.addEventListener("keyup", (e) => {
    if (e.key === " ") {
      if (!game["gameRunning"]) {
        game.startGame();
      }
    }
  });
} else {
  const container = document.createElement("div");
  document.body.appendChild(container);
  container.style.cssText = `
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    max-width: 100vw;
    overflow: hidden;
  `;

  const cont1 = document.createElement("div");
  cont1.style.cssText = `
    flex: 1;
    height: 100dvh;
    max-width: 50dvw;
  `;
  cont1.style.maxWidth = "50dvw";
  cont1.id = "game1-container";
  const cont2 = document.createElement("div");
  cont2.style.cssText = `
    flex: 1;
    height: 100dvh;
    max-width: 50dvw;
  `;
  cont2.style.maxWidth = "50dvw";
  cont2.style.borderLeft = "2px solid #000";
  cont2.id = "game2-container";

  setTimeout(() => {
    const cont2gf = document.getElementById("game2-container");
    if (cont2gf) {
      cont2gf.style.borderLeft = "2px solid #000";
    }
  }, 100);

  container.appendChild(cont1);
  container.appendChild(cont2);

  const game1 = new KartPoleGame(
    {
      left: "a",
      right: "d",
    },
    cont1
  );

  const game2 = new KartPoleGame(
    {
      left: "ArrowLeft",
      right: "ArrowRight",
    },
    cont2
  );

  (window as any).game1 = game1;
  (window as any).game2 = game2;

  const LDBoard = Leaderboard({
    getGameRunning() {
      return false;
    },
    kvAPIKey: "kartpole-hard",
    notifier: notifier,
  });

  (window as any).lb = LDBoard;

  let plname: string | null = null;
  const namePrompt = () => {
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

  // Setup game over listeners
  let gameStarted = false;
  const onGameOver = (score: number) => {
    if (!gameStarted) return;
    gameStarted = false;
    game1.endGame();
    game2.endGame();

    let nm = namePrompt();
    if (nm) {
      LDBoard.saveScore(nm, score, (score / 60).toFixed(2) + "s");
    }
  };

  game1.onGameOver(onGameOver);
  game2.onGameOver(onGameOver);

  window.addEventListener("keyup", (e) => {
    if (e.key === " ") {
      if (!game1["gameRunning"] && !game2["gameRunning"]) {
        gameStarted = true;
        game1.startGame();
        game2.startGame();
      }
    }
  });
}

createButton({
  text: mode == "hard" ? "이지 모드" : "하드 모드",
  onClick: () => {
    const newMode = mode == "hard" ? "easy" : "hard";
    const url = new URL(window.location.href);
    url.searchParams.set("mode", newMode);
    window.location.href = url.toString();
  },
});
