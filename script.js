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
        this.isFixed = false;      // 固定マス（四角）フラグ
    }

    // 現在の表示数値
    get value() {
        if (this.isFixed) {
            return this.baseValue;
        }
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
    marker.setAttribute("markerWidth", "4");
    marker.setAttribute("markerHeight", "4");
    marker.setAttribute("refX", "1");
    marker.setAttribute("refY", "2");
    marker.setAttribute("orient", "auto");
    
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", "0 0, 4 2, 0 4");
    polygon.setAttribute("fill", "#5982d9");
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
    
    // 初回の全マス数値表示更新
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

// 問題自動生成
function generatePuzzle(width, height) {
    const solution = generateLatinSquare(width);
    
    const plannedOutgoing = Array.from({ length: height }, () => 
        Array.from({ length: width }, () => new Set())
    );

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            board[y][x].targetValue = solution[y][x];
            board[y][x].isFixed = false;
        }
    }

    // 固定マス（四角）候補を決定（孤立マスを作らない判定）
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cell = board[y][x];
            
            // 一定確率でマスが固定マスになる
            if (Math.random() < 0.4) {
                let createsIsolatedCell = false;

                for (const neighbor of cell.neighbors) {
                    const fixedAroundNeighbor = neighbor.neighbors.filter(n => n.isFixed || n === cell).length;
                    
                    if (fixedAroundNeighbor === neighbor.neighbors.length) {
                        createsIsolatedCell = true;
                        break;
                    }
                }

                if (!createsIsolatedCell) {
                    cell.isFixed = true;
                }
            }
        }
    }

    // 可変マスリストの抽出
    const variableCells = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!board[y][x].isFixed) {
                variableCells.push(board[y][x]);
            }
        }
    }

    shuffle(variableCells);

    // すべての可変マスに最低1本の接続（出または入）を保証
    for (const cell of variableCells) {
        let activeConnections = plannedOutgoing[cell.y][cell.x].size;
        for (const neighbor of cell.neighbors) {
            if (plannedOutgoing[neighbor.y][neighbor.x].has(cell)) {
                activeConnections++;
            }
        }

        if (activeConnections === 0) {
            const validNeighbors = cell.neighbors.filter(n => !n.isFixed);
            if (validNeighbors.length > 0) {
                const target = validNeighbors[randomInt(0, validNeighbors.length - 1)];
                
                if (Math.random() < 0.5) {
                    plannedOutgoing[cell.y][cell.x].add(target);
                } else {
                    plannedOutgoing[target.y][target.x].add(cell);
                }
            }
        }
    }

    // 確率的に追加の矢印をランダム構築
    for (const cell of variableCells) {
        for (const neighbor of cell.neighbors) {
            if (neighbor.isFixed) continue;

            const hasOutgoing = plannedOutgoing[cell.y][cell.x].has(neighbor);
            const hasIncoming = plannedOutgoing[neighbor.y][neighbor.x].has(cell);

            if (!hasOutgoing && !hasIncoming && Math.random() < 0.25) {
                if (Math.random() < 0.5) {
                    plannedOutgoing[cell.y][cell.x].add(neighbor);
                } else {
                    plannedOutgoing[neighbor.y][neighbor.x].add(cell);
                }
            }
        }
    }

    // 各マスの初期値（baseValue）を決定
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

    // コンソールに正解の接続マップおよび目標のラテン方格を表示
    console.group("=== 正解データ（デバッグ情報） ===");
    
    // 正解のラテン方格をテーブル表示
    console.log("【完成形ラテン方格】");
    console.table(solution);

    // 正解の矢印接続リストを表示
    console.log("【正解の矢印リスト (基 -> 先)】");
    const solutionArrows = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            for (const target of plannedOutgoing[y][x]) {
                solutionArrows.push({
                    "基 (From)": `(${x}, ${y}) [初期値: ${board[y][x].baseValue} -> 目標: ${board[y][x].targetValue}]`,
                    "先 (To)": `(${target.x}, ${target.y}) [初期値: ${target.baseValue} -> 目標: ${target.targetValue}]`
                });
            }
        }
    }
    
    if (solutionArrows.length > 0) {
        console.table(solutionArrows);
    } else {
        console.log("接続されている矢印はありません。");
    }

    console.groupEnd();
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

// 2点間の中心座標から「縁」の座標を計算する関数
function getEdgePoint(fromPos, toPos, cellRadius) {
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return toPos;

    // マスの半径分だけ手前（縁）の位置を計算
    return {
        x: toPos.x - (dx / distance) * cellRadius,
        y: toPos.y - (dy / distance) * cellRadius
    };
}

function drawArrowLine(from, to) {
    const svg = boardElement.querySelector(".connection-layer");
    const posA = getButtonCenter(getButton(from));
    const posB = getButtonCenter(getButton(to));

    // ボタンの実際の半径（5rem = 約80px の場合は約 40px）を取得
    const buttonElement = getButton(from);
    const radius = buttonElement.offsetWidth / 2 + 24; // 24に設定するとなぜか三角形は縁にぴったりになる

    // 終点を中心から「マスの縁」の位置へと補正
    const startEdge = getEdgePoint(posB, posA, 0); // Aの中心から出発
    const endEdge = getEdgePoint(posA, posB, radius);   // Bの縁で停止

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", startEdge.x);
    line.setAttribute("y1", startEdge.y);
    line.setAttribute("x2", endEdge.x);
    line.setAttribute("y2", endEdge.y);
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
            
            // ボタンへのテキスト設定
            button.textContent = cell.value;

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

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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
