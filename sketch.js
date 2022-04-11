class Layer {
  constructor(name, cells) {
    this.cells = cells; // array of Cell objects
    this.name = name;
    this.visible = true;
    this.locations = new Set(this.cells.map(c => { return `${c.gx}.${c.gy}` })); // set of [gx,gy]
    this.locked = false;
  }

  has(gx, gy) {
    return this.locations.has(`${gx}.${gy}`);
  }

  lock() {
    this.locked = true;
  }

  push(cell, smooth = false) {
    const k = `${cell.gx}.${cell.gy}`
    if (this.locations.has(k)) {
      return;
    }
    this.locations.add(k);
    this.cells.push(cell);
    if (smooth) {
      this.smooth();
    }
  }

  toFontJSON() {
    const min = { gx: Infinity, gy: Infinity };
    const max = { gx: -Infinity, gy: -Infinity };
    this.cells.forEach(c => {
      if (c.gx < min.gx) { min.gx = c.gx; }
      if (c.gx > max.gx) { max.gx = c.gx; }
      if (c.gy < min.gy) { min.gy = c.gy; }
      if (c.gy > max.gy) { max.gy = c.gy; }
    });

    const out = {};
    out[this.name] = {
      "offset": 0,
      "pixels": [],
    };
    const colors = new Set();
    this.cells.forEach(c => { colors.add(c.color) });
    colors.forEach(color => {
      const cells = this.cells.filter(c => { return c.color === color });
      const locs = {};
      const rows = [];
      cells.forEach(c => {
        locs[`${c.gx}.${c.gy}`] = c
      });
      for (let y = min.gy; y <= max.gy; y++) {
        const row = [];
        for (let x = min.gx; x <= max.gx; x++) {
          const k = `${x}.${y}`;
          if (locs[k]) {
            row.push(fontShapeMapInv[locs[k].shape]);
          } else {
            row.push(0);
          }
        }
        rows.push(row);
      }
      out[this.name]["pixels"].push(rows);
    });
    if (colors.size > 1) {
      out[this.name]["layers"] = colors.size;
    } else {
      out[this.name]["pixels"] = out[this.name]["pixels"][0];
    }
    return out
  }

  remove(gx, gy) {
    const k = `${gx}.${gy}`
    if (!this.locations.has(k)) {
      return;
    }
    this.locations.delete(k);
    this.cells = this.cells.filter(c => { return c.gx !== gx || c.gy !== gy });
  }

  draw() {
    if (this.visible) {
      stroke(0);
      strokeWeight(1);
      this.cells.forEach(cell => { cell.draw() });
    }
  }

  empty() {
    return this.cells.length === 0;
  }

  offset(dx, dy) {
    this.cells.forEach(cell => cell.offset(dx, dy));
  }

  finalize() {
    this.cells.forEach(cell => {
      this.locations.delete(`${cell.gx}.${cell.gy}`);
      cell.finalize()
      this.locations.add(`${cell.gx}.${cell.gy}`);
    });
  }

  fill(color) {
    this.cells.forEach(cell => { cell.color = color });
  }

  clone() {
    return new Layer(this.name + " Copy", this.cells.map(cell => {
      return new Cell(cell.gx, cell.gy, cell.color, cell.shape);
    }));
  }

  smooth() {
    let cells = [];
    this.cells.forEach(cell => {
      if (cells[cell.gx] === undefined) {
        cells[cell.gx] = [];
      }
      cells[cell.gx][cell.gy] = cell;
    })
    this.cells.forEach(c => {
      let score = 0;

      // if the tile above is set, add 1
      if (cells[c.gx][c.gy - 1] !== undefined) {
        score += 1;
      }
      // if the tile to the right is set, add 2
      if (cells[c.gx + 1] !== undefined && cells[c.gx + 1][c.gy] !== undefined) {
        score += 2;
      }
      // if the tile below is set, add 4
      if (cells[c.gx][c.gy + 1] !== undefined) {
        score += 4;
      }
      // if the tile to the left is set, add 8
      if (cells[c.gx - 1] !== undefined && cells[c.gx - 1][c.gy] !== undefined) {
        score += 8;
      }
      if (score === 3) {
        c.shape = _cornerSw;
      } else if (score === 6) {
        c.shape = _cornerNw;
      } else if (score === 9) {
        c.shape = _cornerSe;
      } else if (score === 12) {
        c.shape = _cornerNe;
      } else {
        c.shape = _square;
      }
    });
  }
}

class Cell {
  constructor(gx, gy, color, shape) {
    this.x = gx * gridZoom;
    this.y = gy * gridZoom;
    this.gx = gx;
    this.gy = gy;
    this.color = color;
    this.shape = shape;
    this._offset = [0,0];
  }

  static fromJSON(json) {
    return new Cell(json.gx, json.gy, json.color, json.shape);
  }

  toJSON() {
    return {
      gx: this.gx,
      gy: this.gy,
      color: this.color,
      shape: this.shape,
    }
  }

  draw() {
    drawShape(
      this.x + this._offset[0],
      this.y + this._offset[1],
      this.shape,
      palette[this.color],
      gridZoom
    );
  }

  offset(dx, dy) {
    this._offset = [dx * gridZoom, dy * gridZoom];
  }

  finalize() {
    this.x += this._offset[0];
    this.y += this._offset[1];
    this.gx = Math.floor(this.x / gridZoom);
    this.gy = Math.floor(this.y / gridZoom);
    this._offset = [0,0];
  }
}

// shapes
const _square = "square";
const _circle = "circle";
const _cornerNe = "cornerNE";
const _cornerSe = "cornerSE";
const _cornerSw = "cornerSW";
const _cornerNw = "cornerNW";
const _pen = "pen";

// shape map for font rendering
const fontShapeMap = {
  1: _square,
  2: _circle,
  3: _cornerNe,
  4: _cornerSe,
  5: _cornerSw,
  6: _cornerNw,
}

// inverted map
const fontShapeMapInv = {};
for (let k in fontShapeMap) {
  fontShapeMapInv[fontShapeMap[k]] = parseInt(k);
}

// modes
const _draw = "draw";
const _pull = "pull";
const _fill = "fill";
const _move = "move";
const _copy = "copy";

const palette = [
  "#002c80", // backplate blue
  "#0074a4", // border blue
  "#fd5d5d", // pink
  "#f3bd10", // yellow
  "#9e82b6", // purple
  "#0f8a44", // green
  "#eaeae0", // white
];

const gridZoom = 24; // px to render each grid square
const gridHeight = 16;
const gridWidth = 16 * 4;
const borderWidth = 1;
const backplateColor = 0;
const borderColor = 1;

let fonts = {};
let currentLayer = new Layer("Layer 1", []); // list of gridCells in the current drawing layer
let draggingLayer = -1;
let dragStart = [0,0];
let shiftPressed = false;

let currentDrawColor, mode, currentDrawTool;
changeMode(_draw);
changeDrawColor(1)
changeDrawTool(_pen);

// TODO
// add 2x sized elbow pieces
// show part on mouseover in draw mode
// controls for backplate / border color
// new / save / load buttons

function keyPressed() {
  if (keyCode === SHIFT) {
    shiftPressed = true;
  }
}

function keyTyped() {
  if (key === "d") {
    renderDebug(stack);
  }
}

function keyReleased() {
  if (keyCode === SHIFT) {
    shiftPressed = false;
  }
}

function preload() {
  fonts["albers"] = loadJSON("/fonts/albers.json");
  fonts["sevenplus"] = loadJSON("/fonts/sevenplus.json");
  fonts["bubblecap"] = loadJSON("/fonts/bubblecap.json");
  fonts["doubleshadow"] = loadJSON("/fonts/doubleshadow.json");
  fonts["2x2"] = loadJSON("/fonts/2x2.json");
}

function drawShape(x, y, shape, color, size) {
  fill(color);
  ellipseMode(CORNER);
  switch (shape) {
    case _square:
      rect(x, y, size, size);
      break;
    case _circle:
      ellipse(x, y, size, size);
      break;
    case _pen:
      rect(x, y, size, size);
      break;
    case _cornerNe:
      arc(x-size, y, size*2, size*2, HALF_PI + PI, 0, PIE);
      break;
    case _cornerSe:
      arc(x - size, y-size, size*2, size*2, 0, HALF_PI, PIE);
      break;
    case _cornerSw:
      arc(x, y-size, size*2, size*2, HALF_PI, PI, PIE);
      break;
    case _cornerNw:
      arc(x, y, size*2, size*2, PI, HALF_PI + PI, PIE);
      break;
  }
}

let stack = [];
addLayer(makeBackground(backplateColor))
addLayer(makeBorder(gridWidth, gridHeight, borderColor))

function changeMode(newMode) {
  mode = newMode;
  const btns = document.querySelectorAll("#left-nav a");
  for (let i = 0; i < btns.length; i++) {
    if (btns[i].dataset.mode === newMode) {
      btns[i].classList.add("active");
    } else {
      btns[i].classList.remove("active");
    }
  }
}

function changeDrawTool(newTool) {
  currentDrawTool = newTool;
  const btns = document.querySelectorAll("#tools-draw li");
  for (let i = 0; i < btns.length; i++) {
    if (btns[i].dataset.tool === newTool) {
      btns[i].classList.add("active");
    } else {
      btns[i].classList.remove("active");
    }
  }
}

function changeDrawColor(newColor) {
  currentDrawColor = parseInt(newColor, 10);
  const drawTools = document.querySelectorAll("#tools-draw .tools li");
  for (let i = 0; i < drawTools.length; i++) {
    const elm = drawTools[i].querySelector("path, rect, circle")
    if (elm.getAttribute("fill")) {
      elm.style.fill = palette[currentDrawColor];
    } else {
      elm.style.stroke = palette[currentDrawColor];
    }
  }
}

function setup() {
  // todo move this out to a function so that the `new` button can work
  const cnv = createCanvas(gridWidth * gridZoom, gridHeight * gridZoom);
  cnv.parent("sketch");
  background("#3f3f3e");
}

function draw() {
  renderLayers(stack.concat([currentLayer]));
}

function addLayer(layer) {
  stack.push(layer);
  renderLayerTable();
}

function mouseDragged() {
  if (mode === _copy && draggingLayer < 0) {
    const target = selectLayerIndex(mouseX, mouseY);
    if (target > 1) { // don't copy background or border
      addLayer(stack[target].clone());
      draggingLayer = stack.length - 1;
      dragStart = [mouseX, mouseY];
    }
  }
  if (mode === _copy || mode === _move) {
    if (draggingLayer < 0) {
      const target = selectLayerIndex(mouseX, mouseY);
      if (target > 1) { // don't drag background or border
        draggingLayer = target;
        dragStart = [mouseX, mouseY];
      }
    } else {
      const dx = floor((mouseX - dragStart[0]) / gridZoom);
      const dy = floor((mouseY - dragStart[1]) / gridZoom);
      stack[draggingLayer].offset(dx, dy);
    }
  }
  if (mode === _draw) {
    placeTile(mouseX, mouseY, shiftPressed);
  }
  if (mode === _pull) {
    removeTile(mouseX, mouseY);
  }
  return false; // prevent default browser behavior
}

function placeTile(mx, my, addToLastLayer = false) {
  const gx = floor(mx / gridZoom);
  const gy = floor(my / gridZoom);
  const newCell = new Cell(gx, gy, currentDrawColor, currentDrawTool);
  const smooth = currentDrawTool === _pen;
  if (addToLastLayer) {
    stack[stack.length - 1].push(newCell, smooth);
  } else if (currentLayer.empty()) {
    currentLayer = new Layer(`Layer ${stack.length + 1}`, [newCell]);
  } else {
    currentLayer.push(newCell, smooth);
  }
}

function removeTile(mx, my) {
  const layer = selectLayerIndex(mx, my);
  if (layer > 1) {
    const gx = floor(mx / gridZoom);
    const gy = floor(my / gridZoom);
    stack[layer].remove(gx, gy);
  }
}

function onBackplate(x, y) {
  return (
    x >= 0 &&
    x < gridWidth * gridZoom &&
    y >= 0 &&
    y < gridHeight * gridZoom
  );
}

function mouseReleased() {
  if (draggingLayer > 0) {
    stack[draggingLayer].finalize();
    draggingLayer = -1;
    dragStart = [0,0];
    return false;
  }
  if (!onBackplate(mouseX, mouseY)) {
    return false;
  }
  if (mode === _draw) {
    if (currentLayer.empty()) {
      placeTile(mouseX, mouseY, shiftPressed);
    } else {
      addLayer(currentLayer);
      currentLayer = new Layer(`Layer ${stack.length + 1}`, []);
    }
  }
  if (mode === _fill) {
    const target = selectLayerIndex(mouseX, mouseY);
    if (target > 1) { // don't fill background or border
      stack[target].fill(currentDrawColor);
    }
  }
  if (mode === _pull) {
    removeTile(mouseX, mouseY);
  }
  return false; // prevent default browser behavior
}

function renderDebug(stack) {
  let out = "";
  // do not render the first two layers
  for (let i = 2; i < stack.length; i++) {
    out += JSON.stringify(stack[i].toFontJSON()) + "\n";
  }
  document.querySelector("#debug pre").innerHTML = out;
}

function renderLayers(layers) {
  layers.forEach(layer => { layer.draw() })
}

function makeBackground(color) {
  let cells = [];
  for (let i = 0; i < gridWidth; i++) {
    for (let j = 0; j < gridHeight; j++) {
      cells.push(new Cell(i, j, color, _square))
    }
  }
  const l = new Layer("Background", cells);
  l.lock();
  return l
}

function makeBorder(width, height, color) {
  let cells = [];
  for (let i = 0; i < width; i++) {
    cells.push(new Cell(i, height - 1, color, _square))
    cells.push(new Cell(i, 0, color, _square))
  }
  for (let j = 0; j < height; j++) {
    cells.push(new Cell(0, j, color, _square));
    cells.push(new Cell(width - 1, j, color, _square));
  }
  return new Layer("Border", cells);
}

function selectLayerIndex(mx, my) {
  const gx = floor(mx / gridZoom);
  const gy = floor(my / gridZoom);
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].has(gx, gy) && stack[i].visible) {
      return i;
    }
  }
  return -1;
}

function renderLayerTable() {
  const tbody = document.querySelector("#tools-layers tbody");
  const template = document.querySelector('#layer-row');
  tbody.innerHTML = '';
  stack.forEach((layer, index) => {
    const row = template.content.cloneNode(true);
    row.querySelector('.layer-name').textContent = layer.name
    const checkbox = row.querySelector('.layer-visible input');
    const deleteButton = row.querySelector('.delete-layer');
    if (index === 0) { // skip the background
      checkbox.remove();
      deleteButton.remove();
    } else {
      checkbox.checked = layer.visible;
      checkbox.value = index;
      deleteButton.dataset.index = index;
      deleteButton.addEventListener('click', (e) => {
        const i = parseInt(e.target.dataset.index);
        stack.splice(i, 1);
        renderLayerTable();
        return false;
      });
    }
    tbody.appendChild(row);
  });
}

const layersForm = document.querySelector('#layers-form');
layersForm.addEventListener("change", () => {
  const formData = new FormData(document.querySelector("#layers-form"));
  let shows = {};
  for (let pair of formData.entries()) {
    if (pair[0] === "show") {
      shows[parseInt(pair[1])] = true;
    }
  }
  console.log(shows);
  for (let i = 0; i < stack.length; i++) {
    stack[i].visible = stack[i].locked || !!shows[i];
  }
});

const leftNavs = document.querySelectorAll("#left-nav a");
for (let i = 0; i < leftNavs.length; i++) {
  leftNavs[i].addEventListener("click", (e) => {
    changeMode(e.target.dataset.mode);
  });
}

const drawTools = document.querySelectorAll("#tools-draw .tools li");
for (let i = 0; i < drawTools.length; i++) {
  drawTools[i].addEventListener("click", (e) => {
    changeDrawTool(e.target.closest("li").dataset.tool);
  });
}

const colorBubbleTemplate = document.querySelector("#color-bubble");
const colorBubbles = document.querySelector("#tools-draw .colors ul");
for (let i = 0; i < palette.length; i++) {
  const bubble = colorBubbleTemplate.content.cloneNode(true);
  bubble.querySelector("li").dataset.color = i.toString();
  bubble.querySelector("circle").style.fill = palette[i];
  bubble.querySelector("circle").addEventListener("click", (e) => {
    changeDrawColor(parseInt(e.target.closest("li").dataset.color));
  });
  colorBubbles.appendChild(bubble);
}

const space = { pixels: [[0]], offset: 0 };

const typeForm = document.querySelector("#tools-type form");
typeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const formData = new FormData(document.querySelector("#type-form"));
  const txt = formData.get("message");
  const font = formData.get("font");
  if (txt.length > 0) {
    let glyphs = [];
    let width = -1;
    let height = 0;
    for (let i = 0; i < txt.length; i++) {
      let glyph = fonts[font][txt[i]];
      if (txt[i] === " ") {
        glyph = space;
      }
      if (glyph === undefined) {
        glyph = fonts[font][txt[i].toUpperCase()];
      }
      if (glyph === undefined) {
        glyph = fonts[font][txt[i].toLowerCase()];
      }
      if (glyph) {
        glyph.letter = txt[i];
        glyphs.push(glyph);
        if (glyph.layers) {
          width += glyph.pixels[0][0].length + 1;
          height = Math.max(height, glyph.offset + glyph.pixels[0].length);
        } else {
          width += glyph.pixels[0].length + 1;
          height = Math.max(height, glyph.offset + glyph.pixels.length);
        }
      }
    }

    let pos = [Math.floor((gridWidth - width) / 2), Math.floor((gridHeight - height) / 2)];
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];
      let gLayers = [glyph.pixels];
      if (glyph.layers) {
        gLayers = glyph.pixels;
      }
      for (let j = 0; j < gLayers.length; j++) {
        const layer = new Layer(`${glyph.letter} ${j}`, []);
        const pixels = gLayers[j];
        const color = (currentDrawColor + j) % palette.length;
        for (let y = 0; y < pixels.length; y++) {
          for (let x = 0; x < pixels[0].length; x++) {
            if (pixels[y][x] !== 0) {
              const n = fontShapeMap[pixels[y][x]];
              layer.push(new Cell(x + pos[0], y + pos[1] + glyph.offset, color, n));
            }
          }
        }
        addLayer(layer);
      }
      pos = [pos[0] + gLayers[0][0].length + 1, pos[1]];
    }
    return false;
  }
});
