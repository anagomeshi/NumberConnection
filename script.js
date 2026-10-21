const boardWidth = 5;
const boardHeight = 5;

let board = [];
let selectedCell = null;
const arrowMap = new Map();

class Cell {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.neighbors = [];
        this.outgoing = new Set(); // 自分から出ている矢印 (基)
        this.incoming = new Set(); // 自分に入っている矢印 (先)
        this.baseValue = 1;        // 初期表示される数字
        this.targetValue = 0;      // ラテン方格上の正解値
        this.isFixed = false;      // 数値のやり取りが発生しない固定マス（四角）フラグ
    }

    get value() {
        // 現在の値 ＝ 初期値 － (出ていく矢印の数) ＋ (入ってくる矢印の数)
        return this.baseValue - this.outgoing.size + this.incoming.size;
    }
}

const boardElement = document.querySelector(".board-content");

function createBoard(width, height) {
    board = [];
    selectedCell = null;
    arrowMap.clear();
    boardElement.innerHTML = "";

    // SVGレイヤーと矢印マーカーの初期化
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("connection-layer");
    
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrowhead");
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "7");
    marker.setAttribute("refX", "9");
    marker.setAttribute("refY", "3.5");
    marker.setAttribute("orient", "auto");
    
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
    polygon.setAttribute("fill", "#007bff");
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);

    boardElement.appendChild(svg);

    // ボード構築
    for (let y = 0; y < height; y++) {
        const row = document.createElement("div");
        row.classList.add("board-row");
        board[y] = [];

        for (let x = 0; x < width; x++) {
            const cell = new Cell(x, y);
            const button = document.createElement("button");

            board[y][x] = cell;

            button.classList.add("board-button");
            button.cell = cell;
            button.addEventListener("click", () => onCellClicked(cell));

            row.appendChild(button);
        }

        boardElement.appendChild(row);
    }

    setupNeighbors(width, height);
    
    // パズル生成（正解から逆算して固定マスと初期配置の数字を設定）
    generatePuzzle(width, height);
    
    updateAllCellDisplay();
}

// 上下左右のみ隣接判定
function setupNeighbors(width, height) {
    const directions = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
    ];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cell = board[y][x];
            for (const dir of directions) {
                const nx = x + dir.dx;
                const ny = y + dir.dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    cell.neighbors.push(board[ny][nx]);
                }
            }
        }
    }
}

// --------------------------------------------------
// 問題自動生成ロジック（孤立マスの発生を防ぐ）
// --------------------------------------------------
function generatePuzzle(width, height) {
    const solution = generateLatinSquare(width);
    
    const plannedOutgoing = Array.from({ length: height }, () => 
        Array.from({ length: width }, () => new Set())
    );

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            board[y][x].targetValue = solution[y][x];
            board[y][x].isFixed = false; // 初期化
        }
    }

    // 1. 固定マス（四角）候補を決定（孤立マスを作らないように判定）
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cell = board[y][x];
            
            // 確率的に固定マス候補にする（例: 30%）
            if (Math.random() < 0.3) {
                // 仮に固定マスにした場合、隣接するマスが「全方向固定マスで囲まれる」ことにならないか判定
                let createsIsolatedCell = false;

                for (const neighbor of cell.neighbors) {
                    // 隣接マス(neighbor)の周囲のうち、すでに固定マスまたは今回固定化予定の数のカウント
                    const fixedAroundNeighbor = neighbor.neighbors.filter(n => n.isFixed || n === cell).length;
                    
                    // 周囲がすべて固定マスで埋まってしまうなら NG
                    if (fixedAroundNeighbor === neighbor.neighbors.length) {
                        createsIsolatedCell = true;
                        break;
                    }
                }

                // 孤立マスが生まれない場合のみ固定マスに設定
                if (!createsIsolatedCell) {
                    cell.isFixed = true;
                }
            }
        }
    }

    // 2. 固定（isFixed）でないマス同士の間で矢印の移動計画を構築
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cell = board[y][x];
            if (cell.isFixed) continue;

            for (const neighbor of cell.neighbors) {
                if (neighbor.isFixed) continue;

                // 確率的に矢印の計画を追加（すでに逆向きの計画がない場合）
                if (!plannedOutgoing[neighbor.y][neighbor.x].has(cell) && Math.random() < 0.4) {
                    plannedOutgoing[y][x].add(neighbor);
                }
            }
        }
    }

    // 3. 各マスの初期値（baseValue）を決定
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cell = board[y][x];

            if (cell.isFixed) {
                cell.baseValue = cell.targetValue;
            } else {
                const outCount = plannedOutgoing[y][x].size;
                let inCount = 0;
                
                for (const neighbor of cell.neighbors) {
                    if (plannedOutgoing[neighbor.y][neighbor.x].has(cell)) {
                        inCount++;
                    }
                }

                // 初期値 ＝ 目標値 ＋ 出ていく矢印数 － 入ってくる矢印数
                cell.baseValue = cell.targetValue + outCount - inCount;
            }
        }
    }
}

function generateLatinSquare(n) {
    let grid = [];
    for (let y = 0; y < n; y++) {
        grid[y] = [];
        for (let x = 0; x < n; x++) {
            grid[y][x] = ((x + y) % n) + 1;
        }
    }

    for (let i = 0; i < n; i++) {
        const r1 = randomInt(0, n - 1);
        const r2 = randomInt(0, n - 1);
        [grid[r1], grid[r2]] = [grid[r2], grid[r1]];
    }

    return grid;
}

// --------------------------------------------------
// プレイヤー操作・表示更新
// --------------------------------------------------
function onCellClicked(cell) {
    // 四角（固定マス）は選択不可
    if (selectedCell === null) {
        if (cell.isFixed) return;
        selectCell(cell);
        return;
    }

    if (selectedCell === cell) {
        deselectCell();
        return;
    }

    tryToggleArrow(selectedCell, cell);
    deselectCell();
}

function selectCell(cell) {
    if (selectedCell !== null) deselectCell();
    selectedCell = cell;
    getButton(cell).classList.add("selected");

    // 固定マス以外の隣接セルをハイライト
    for (const neighbor of cell.neighbors) {
        if (!neighbor.isFixed) {
            getButton(neighbor).classList.add("neighbor");
        }
    }
}

function deselectCell() {
    if (selectedCell !== null) {
        getButton(selectedCell).classList.remove("selected");
        for (const neighbor of selectedCell.neighbors) {
            getButton(neighbor).classList.remove("neighbor");
        }
    }
    selectedCell = null;
}

function tryToggleArrow(from, to) {
    // 基または先が固定マスの場合は処理を行わない
    if (from.isFixed || to.isFixed) return;
    if (!from.neighbors.includes(to)) return;

    if (from.outgoing.has(to)) {
        removeArrow(from, to);
    } else if (from.incoming.has(to)) {
        removeArrow(to, from);
        addArrow(from, to);
    } else {
        addArrow(from, to);
    }

    updateAllCellDisplay();
    checkLatinSquareClear();
}

function addArrow(from, to) {
    from.outgoing.add(to);
    to.incoming.add(from);
    drawArrowLine(from, to);
}

function removeArrow(from, to) {
    from.outgoing.delete(to);
    to.incoming.delete(from);
    removeArrowLine(from, to);
}

function getArrowKey(from, to) {
    return `${from.x},${from.y}->${to.x},${to.y}`;
}

function drawArrowLine(from, to) {
    const svg = boardElement.querySelector(".connection-layer");
    const posA = getButtonCenter(getButton(from));
    const posB = getButtonCenter(getButton(to));

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", posA.x);
    line.setAttribute("y1", posA.y);
    line.setAttribute("x2", posB.x);
    line.setAttribute("y2", posB.y);
    line.setAttribute("marker-end", "url(#arrowhead)");
    line.classList.add("connection-line");

    const key = getArrowKey(from, to);
    arrowMap.set(key, line);
    svg.appendChild(line);
}

function removeArrowLine(from, to) {
    const key = getArrowKey(from, to);
    const line = arrowMap.get(key);

    if (line) {
        line.remove();
        arrowMap.delete(key);
    }
}

// セル表示および fixed クラスの更新
function updateAllCellDisplay() {
    for (let y = 0; y < boardHeight; y++) {
        for (let x = 0; x < boardWidth; x++) {
            const cell = board[y][x];
            const button = getButton(cell);
            
            button.textContent = cell.value;

            // fixed フラグが true のマスにのみ fixed クラスを付与
            if (cell.isFixed) {
                button.classList.add("fixed");
            } else {
                button.classList.remove("fixed");
            }
        }
    }
}

// クリアチェック（ラテン方格成立判定）
function checkLatinSquareClear() {
    const N = boardWidth;

    // 行チェック
    for (let y = 0; y < N; y++) {
        const rowValues = new Set();
        for (let x = 0; x < N; x++) {
            const val = board[y][x].value;
            if (val < 1 || val > N || rowValues.has(val)) {
                showClearPopup(false);
                return false;
            }
            rowValues.add(val);
        }
    }

    // 列チェック
    for (let x = 0; x < N; x++) {
        const colValues = new Set();
        for (let y = 0; y < N; y++) {
            const val = board[y][x].value;
            if (val < 1 || val > N || colValues.has(val)) {
                showClearPopup(false);
                return false;
            }
            colValues.add(val);
        }
    }

    showClearPopup(true);
    return true;
}

function showClearPopup(isClear) {
    const appMask = document.querySelector(".app-mask");
    const popupContainer = document.querySelector(".clear-popup-container");

    if (isClear) {
        appMask?.classList.add("show");
        popupContainer?.classList.add("show");
    } else {
        appMask?.classList.remove("show");
        popupContainer?.classList.remove("show");
    }
}

function getButton(cell) {
    return boardElement
        .querySelectorAll(".board-row")[cell.y]
        .querySelectorAll(".board-button")[cell.x];
}

function getButtonCenter(button) {
    const buttonRect = button.getBoundingClientRect();
    const boardRect = boardElement.getBoundingClientRect();

    return {
        x: buttonRect.left - boardRect.left + buttonRect.width / 2,
        y: buttonRect.top - boardRect.top + buttonRect.height / 2
    };
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function redrawLines() {
    const svg = boardElement.querySelector(".connection-layer");
    const defs = svg.querySelector("defs");
    
    svg.innerHTML = "";
    if (defs) svg.appendChild(defs);
    
    arrowMap.clear();

    for (let y = 0; y < boardHeight; y++) {
        for (let x = 0; x < boardWidth; x++) {
            const cell = board[y][x];
            for (const target of cell.outgoing) {
                drawArrowLine(cell, target);
            }
        }
    }
}

window.addEventListener("resize", redrawLines);

createBoard(boardWidth, boardHeight);
