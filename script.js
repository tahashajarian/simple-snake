let direction = null;
const speed = 100; // actully its opiside of seepd its kind of lazayng power :))))
let lastRun = 0;
const sizePlayGround = 400;
const cellSize = 10;
const xyCells = sizePlayGround / cellSize;

let stop = false;

const allCells = (sizePlayGround / cellSize) * (sizePlayGround / cellSize);

let playGround, food, snakeDirection;
let snake = [];

const arrows = {
  right: "ArrowRight",
  left: "ArrowLeft",
  up: "ArrowUp",
  down: "ArrowDown",
};

window.addEventListener("keydown", (e) => {
  if (e.key === arrows.down && snakeDirection === arrows.up) return;
  if (e.key === arrows.up && snakeDirection === arrows.down) return;
  if (e.key === arrows.right && snakeDirection === arrows.left) return;
  if (e.key === arrows.left && snakeDirection === arrows.right) return;
  direction = e.key;
});

const lost = () => {
  document.querySelector("#lost").style.display = "flex";
  document.querySelector("#score").innerHTML = snake.length - 1;
  stop = true;
  console.log("you lost");
};

const putFoodOnPlayGround = () => {
  food = Math.floor(Math.random() * xyCells * xyCells);
};

const calcXYCell = (piece) => {
  return [piece % xyCells, Math.floor(piece / xyCells)];
};

const update = () => {
  snakeDirection = direction;
  const [xCell, yCell] = calcXYCell(snake[0]);
  if (new Set(snake).size < snake.length) {
    return lost();
  }
  switch (direction) {
    case arrows.up:
      if (yCell === 0) {
        return lost();
      }
      moveSnake((sizePlayGround / cellSize) * -1);

      break;
    case arrows.down:
      if (yCell === xyCells - 1) {
        return lost();
      }
      moveSnake(sizePlayGround / cellSize);

      break;
    case arrows.right:
      if (xCell === xyCells - 1) {
        return lost();
      }
      moveSnake(1);

      break;
    case arrows.left:
      if (xCell === 0) {
        return lost();
      }
      moveSnake(-1);

      break;
    default:
      moveSnake(0);
  }
};

const moveSnake = (move) => {
  if (move) {
    if (snake[0] === food) {
      const lastsankepeice = snake[snake.length - 1];
      snake.push(lastsankepeice + move);
      putFoodOnPlayGround();
    }
    for (let i = snake.length - 1; i >= 1; i--) {
      snake[i] = snake[i - 1];
    }
    snake[0] += move;
  }
  render();
};

const render = () => {
  playGround.innerHTML = null;
  for (let i = 0; i < snake.length; i++) {
    const piece = snake[i];
    const snakeBody = document.createElement("span");
    snakeBody.className = "snake-body";
    snakeBody.style.width = cellSize + "px";
    snakeBody.style.height = cellSize + "px";
    const [xCell, yCell] = calcXYCell(piece);
    snakeBody.style.left = xCell * cellSize + "px";
    snakeBody.style.top = yCell * cellSize + "px";
    playGround.appendChild(snakeBody);
  }
  if (food) {
    const foodEl = document.createElement("span");
    foodEl.id = "food";
    const [xCell, yCell] = calcXYCell(food);
    foodEl.style.width = cellSize + "px";
    foodEl.style.height = cellSize + "px";
    foodEl.style.left = xCell * cellSize + "px";
    foodEl.style.top = yCell * cellSize + "px";
    playGround.appendChild(foodEl);
  }
};

const run = () => {
  if (!stop) {
    const timeNow = new Date().getTime();
    if (timeNow - lastRun > speed) {
      lastRun = timeNow;
      update();
    }
    requestAnimationFrame(run);
  }
};

const preStart = () => {
  playGround = document.createElement("div");
  playGround.id = "playGround";
  playGround.style.width = sizePlayGround + "px";
  playGround.style.height = sizePlayGround + "px";
  document.body.appendChild(playGround);
  const middle = allCells / 2 + sizePlayGround / cellSize / 2 - 41;
  snake.push(middle);
  putFoodOnPlayGround();
  run();
};

preStart();

const restart = () => {
  snake = [allCells / 2 + sizePlayGround / cellSize / 2 - 41];
  document.querySelector("#lost").style.display = "none";
  putFoodOnPlayGround();
  stop = false;
  direction = null;
  run();
};
