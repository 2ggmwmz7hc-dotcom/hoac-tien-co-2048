(() => {
  const SIZE = 4;
  const IMAGE_BY_VALUE = {
    2: "images/2.jpg",
    4: "images/4.jpg",
    8: "images/8.jpg",
    16: "images/16.jpg",
    32: "images/32.jpg",
    64: "images/64.jpg",
    128: "images/128.jpg",
    256: "images/256.jpg",
    512: "images/512.jpg",
    1024: "images/1024.jpg",
    2048: "images/2048.jpg"
  };

  const tileLayer = document.getElementById("tileLayer");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const statusEl = document.getElementById("status");
  const newGameBtn = document.getElementById("newGame");
  const undoBtn = document.getElementById("undo");
  const victoryModal = document.getElementById("victoryModal");
  const continueBtn = document.getElementById("continueGame");
  const restartFromWinBtn = document.getElementById("restartFromWin");

  let grid = [];
  let score = 0;
  let best = Number(localStorage.getItem("hxc2048Best") || 0);
  let previousState = null;
  let won = false;
  let keepPlaying = false;
  let spawnKey = null;
  let mergedKeys = new Set();

  bestEl.textContent = String(best);

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function cloneGrid(source) {
    return source.map(row => row.slice());
  }

  function positionKey(r, c) {
    return `${r}-${c}`;
  }

  function getEmptyCells() {
    const cells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) cells.push([r, c]);
      }
    }
    return cells;
  }

  function addRandomTile() {
    const empty = getEmptyCells();
    if (!empty.length) return;

    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    spawnKey = positionKey(r, c);
  }

  function updateBest() {
    if (score > best) {
      best = score;
      localStorage.setItem("hxc2048Best", String(best));
    }
  }

  function startGame() {
    grid = emptyGrid();
    score = 0;
    previousState = null;
    won = false;
    keepPlaying = false;
    mergedKeys = new Set();
    spawnKey = null;
    addRandomTile();
    addRandomTile();
    victoryModal.hidden = true;
    statusEl.textContent = "Vuốt trên bàn cờ để chơi. Trên máy tính có thể dùng phím mũi tên.";
    render();
  }

  function render() {
    tileLayer.innerHTML = "";

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const value = grid[r][c];
        if (!value) continue;

        const tile = document.createElement("div");
        tile.className = `tile v${Math.min(value, 2048)}`;
        tile.style.gridRow = String(r + 1);
        tile.style.gridColumn = String(c + 1);

        const key = positionKey(r, c);
        if (key === spawnKey) tile.classList.add("spawn");
        if (mergedKeys.has(key)) tile.classList.add("merge");

        const img = document.createElement("img");
        img.src = IMAGE_BY_VALUE[Math.min(value, 2048)] || IMAGE_BY_VALUE[2048];
        img.alt = `Tile ${value}`;
        img.draggable = false;

        tile.appendChild(img);
        tileLayer.appendChild(tile);
      }
    }

    scoreEl.textContent = String(score);
    updateBest();
    bestEl.textContent = String(best);
    undoBtn.disabled = !previousState;

    spawnKey = null;
    mergedKeys = new Set();
  }

  function arraysEqual(a, b) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (a[r][c] !== b[r][c]) return false;
      }
    }
    return true;
  }

  function transpose(matrix) {
    return matrix[0].map((_, col) => matrix.map(row => row[col]));
  }

  function processRow(row, rowIndex, direction) {
    const compact = row.filter(Boolean);
    const out = [];
    let gained = 0;
    const mergeOutputIndexes = [];

    for (let i = 0; i < compact.length; i++) {
      if (compact[i] === compact[i + 1]) {
        const merged = compact[i] * 2;
        out.push(merged);
        gained += merged;
        mergeOutputIndexes.push(out.length - 1);
        i += 1;
      } else {
        out.push(compact[i]);
      }
    }

    while (out.length < SIZE) out.push(0);
    return { row: out, gained, mergeOutputIndexes };
  }

  function move(direction) {
    if (victoryModal.hidden === false) return;

    const before = cloneGrid(grid);
    const scoreBefore = score;
    const wonBefore = won;
    let work = cloneGrid(grid);
    let totalGain = 0;
    const newMergedKeys = new Set();

    const isVertical = direction === "up" || direction === "down";
    const reverse = direction === "right" || direction === "down";

    if (isVertical) work = transpose(work);
    if (reverse) work = work.map(row => row.slice().reverse());

    const processed = work.map((row, rowIndex) => {
      const result = processRow(row, rowIndex, direction);
      totalGain += result.gained;

      result.mergeOutputIndexes.forEach(outputIndex => {
        let visualIndex = reverse ? SIZE - 1 - outputIndex : outputIndex;

        if (isVertical) {
          newMergedKeys.add(positionKey(visualIndex, rowIndex));
        } else {
          newMergedKeys.add(positionKey(rowIndex, visualIndex));
        }
      });

      return result.row;
    });

    work = processed;

    if (reverse) work = work.map(row => row.slice().reverse());
    if (isVertical) work = transpose(work);

    if (arraysEqual(before, work)) return;

    previousState = {
      grid: before,
      score: scoreBefore,
      won: wonBefore,
      keepPlaying
    };

    grid = work;
    score += totalGain;
    mergedKeys = newMergedKeys;
    addRandomTile();
    render();

    if (!won && hasValueAtLeast(2048)) {
      won = true;
      if (!keepPlaying) showVictory();
    } else if (!canMove()) {
      statusEl.textContent = "Hết nước đi rồi. Bấm “Ván mới” để bắt đầu lại.";
    }
  }

  function hasValueAtLeast(target) {
    return grid.some(row => row.some(value => value >= target));
  }

  function canMove() {
    if (getEmptyCells().length) return true;

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const value = grid[r][c];
        if (r + 1 < SIZE && grid[r + 1][c] === value) return true;
        if (c + 1 < SIZE && grid[r][c + 1] === value) return true;
      }
    }
    return false;
  }

  function undo() {
    if (!previousState) return;

    grid = cloneGrid(previousState.grid);
    score = previousState.score;
    won = previousState.won;
    keepPlaying = previousState.keepPlaying;
    previousState = null;
    victoryModal.hidden = true;
    statusEl.textContent = "Đã quay lại một nước.";
    render();
  }

  function showVictory() {
    victoryModal.hidden = false;
  }

  continueBtn.addEventListener("click", () => {
    keepPlaying = true;
    victoryModal.hidden = true;
    statusEl.textContent = "Tiếp tục ghép thôi 👑";
  });

  restartFromWinBtn.addEventListener("click", startGame);
  newGameBtn.addEventListener("click", startGame);
  undoBtn.addEventListener("click", undo);

  document.addEventListener("keydown", event => {
    const map = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down"
    };

    if (!map[event.key]) return;
    event.preventDefault();
    move(map[event.key]);
  });

  let startX = 0;
  let startY = 0;
  let tracking = false;

  tileLayer.parentElement.addEventListener("pointerdown", event => {
    tracking = true;
    startX = event.clientX;
    startY = event.clientY;
  });

  tileLayer.parentElement.addEventListener("pointerup", event => {
    if (!tracking) return;
    tracking = false;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));

    if (distance < 24) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? "right" : "left");
    } else {
      move(dy > 0 ? "down" : "up");
    }
  });

  tileLayer.parentElement.addEventListener("pointercancel", () => {
    tracking = false;
  });

  startGame();
})();
