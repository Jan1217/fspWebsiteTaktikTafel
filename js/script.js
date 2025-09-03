//
// === Canvas Setup ===
//
const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");

canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;


//
// === Globale States ===
//
let scale = 1, originX = 0, originY = 0;
let panning = false, panStartX = 0, panStartY = 0;

let drawings = []; // {x1,y1,x2,y2,color,width}
let icons = [];    // {icon,x,y}
let vehicles = []; // {img,type,x,y,w,h}
let polygons = []; // gespeicherte Polygone
let currentPolygon = null; // { points: [ {x,y}, ... ], color }

let painting = false;
let currentIcon = null;
let currentVehicle = null;
let draggingItem = null;
let dragOffsetX = 0, dragOffsetY = 0;
let draggingVehiclePreview = null;

let currentColor = "black";
let currentWidth = 2;
let mode = "move";


//
// === Fahrzeugfarben ===
//
const vehicleColors = {
  feuerwehr: "#FF4D4D",
  fuehrung: "#FFD700",
  hiorg: "#E6E6E6",
  pol: "#90EE90",
  thw: "#87CEFA",
  taktik: "#F5F5F5"
};


//
// === Hintergrundbilder ===
//
const background = new Image();
background.src = "img/overview_ohne_pda.png";
background.onload = redraw;

const pdaImage = new Image();
pdaImage.src = "img/overview_mit_pda.png";
pdaImage.onload = redraw;

const hydrantsImage = new Image();
hydrantsImage.src = "img/overview_mit_hydrant.png";
hydrantsImage.onload = redraw;

const brsImage = new Image();
brsImage.src = "img/overview_mit_bsr.png";
brsImage.onload = redraw;

let showBackground = true;
let showPDA = false;
let showHydrants = false;
let showBrs = false;


//
// === Hilfsfunktionen ===
//
function findItemAt(x, y) {
  // Fahrzeuge prüfen
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    if (x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h) return v;
  }
  // Icons prüfen
  for (let i = icons.length - 1; i >= 0; i--) {
    const ic = icons[i];
    if (x >= ic.x - 10 && x <= ic.x + 30 && y >= ic.y - 15 && y <= ic.y + 15) return ic;
  }
  return null;
}

function drawBackgroundImage(img) {
  const canvasRatio = canvas.width / canvas.height;
  const imageRatio = img.width / img.height;
  let drawWidth, drawHeight, offsetX, offsetY;

  if (imageRatio > canvasRatio) {
    drawWidth = canvas.width;
    drawHeight = canvas.width / imageRatio;
    offsetX = 0;
    offsetY = (canvas.height - drawHeight) / 2;
  } else {
    drawHeight = canvas.height;
    drawWidth = canvas.height * imageRatio;
    offsetX = (canvas.width - drawWidth) / 2;
    offsetY = 0;
  }
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

function drawVehicle(v) {
  if (!v.img) return;
  ctx.drawImage(v.img, v.x, v.y, v.w, v.h);
}

function drawPolygon(poly, preview = false) {
  const pts = poly.points;
  if (pts.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);

  if (!preview) {
    ctx.closePath();
    ctx.fillStyle = poly.color;
    ctx.fill();
  }

  ctx.strokeStyle = "black";
  ctx.lineWidth = 2 / scale;
  ctx.stroke();

  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 / scale, 0, Math.PI * 2);
    ctx.fillStyle = "black";
    ctx.fill();
  });
}

function redraw() {
  ctx.setTransform(scale, 0, 0, scale, originX, originY);
  ctx.clearRect(-originX / scale, -originY / scale, canvas.width / scale, canvas.height / scale);

  if (showBackground) drawBackgroundImage(background);
  if (showPDA) drawBackgroundImage(pdaImage);
  if (showHydrants) drawBackgroundImage(hydrantsImage);
  if (showBrs) drawBackgroundImage(brsImage);

  drawings.forEach(d => {
    ctx.beginPath();
    ctx.moveTo(d.x1, d.y1);
    ctx.lineTo(d.x2, d.y2);
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.width;
    ctx.lineCap = "round";
    ctx.stroke();
  });

  polygons.forEach(poly => drawPolygon(poly));
  if (currentPolygon && currentPolygon.points.length > 0) drawPolygon(currentPolygon, true);

  icons.forEach(i => {
    ctx.font = `${24 / scale}px Arial`;
    ctx.fillStyle = "#000";
    ctx.fillText(i.icon, i.x, i.y);
  });

  vehicles.forEach(v => drawVehicle(v));
}


//
// === Event Listener: Canvas ===
//
canvas.addEventListener("mousedown", e => {
  const x = (e.offsetX - originX) / scale;
  const y = (e.offsetY - originY) / scale;

  if (e.button === 2) { // Rechtsklick Pan
    panning = true;
    panStartX = e.offsetX - originX;
    panStartY = e.offsetY - originY;
    return;
  }
  if (e.button !== 0) return;

  if (mode === "polygon") {
    if (!currentPolygon) return;
    const pts = currentPolygon.points;
    pts.push({ x, y });

    if (pts.length > 2) {
      const first = pts[0];
      const dx = x - first.x, dy = y - first.y;
      if (Math.sqrt(dx*dx + dy*dy) < 10) {
        polygons.push(currentPolygon);
        currentPolygon = null;
        toggleMode("move");
      }
    }
    redraw();
    return;
  }

  if (currentIcon) {
    icons.push({ icon: currentIcon, x, y });
    currentIcon = null;
    redraw();
    return;
  }

  if (currentVehicle) {
    const img = new Image();
    img.src = currentVehicle;
    img.onload = () => {
      vehicles.push({ img, type: null, x, y, w: img.width/2, h: img.height/2 });
      redraw();
    };
    currentVehicle = null;
    return;
  }

  if (mode === "move") {
    const item = findItemAt(x, y);
    if (item) {
      draggingItem = item;
      dragOffsetX = x - item.x;
      dragOffsetY = y - item.y;
    }
  }

  if (mode === "paint") {
    painting = true;
    drawings.push({ x1: x, y1: y, x2: x, y2: y, color: currentColor, width: currentWidth / scale });
  }

  if (mode === "eraser") {
    painting = true;
    eraseAt(x, y, currentWidth / 2 / scale);
    return;
  }
});

canvas.addEventListener("mousemove", e => {
  const x = (e.offsetX - originX) / scale;
  const y = (e.offsetY - originY) / scale;

  if (mode === "eraser" && painting) {
    eraseAt(x, y, currentWidth / 2 / scale);
  }

  redraw();
  if (mode === "eraser") {
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, originX, originY);
    ctx.beginPath();
    ctx.arc(x, y, currentWidth / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1 / scale;
    ctx.setLineDash([4 / scale, 2 / scale]);
    ctx.stroke();
    ctx.restore();
  }

  if (mode === "paint" && painting) {
    const last = drawings[drawings.length - 1];
    last.x2 = x; last.y2 = y;
    drawings.push({ x1: last.x2, y1: last.y2, x2: x, y2: y, color: currentColor, width: currentWidth / scale });
    redraw();
  }

  if (mode === "move" && draggingItem) {
    draggingItem.x = x - dragOffsetX;
    draggingItem.y = y - dragOffsetY;
    redraw();
  }

  if (panning) {
    originX = e.offsetX - panStartX;
    originY = e.offsetY - panStartY;
    redraw();
  }
});

canvas.addEventListener("mouseup", () => {
  painting = false;
  draggingItem = null;
  panning = false;
  painting = false;
});

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const { offsetX: mouseX, offsetY: mouseY } = e;
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = scale * delta;

  originX = mouseX - ((mouseX - originX) * (newScale / scale));
  originY = mouseY - ((mouseY - originY) * (newScale / scale));
  scale = newScale;
  redraw();
});

canvas.addEventListener("contextmenu", e => e.preventDefault());

function lineDistance(x0, y0, x1, y1, x2, y2) {
  const A = x0 - x1;
  const B = y0 - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq !== 0) param = dot / len_sq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x0 - xx;
  const dy = y0 - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

function eraseAt(x, y, radius) {
  drawings = drawings.filter(d => lineDistance(x, y, d.x1, d.y1, d.x2, d.y2) > radius);
  redraw();
}

//
// === Drag & Drop Fahrzeuge ===
//
canvas.addEventListener("dragover", e => e.preventDefault());
canvas.addEventListener("drop", e => {
  e.preventDefault();
  const src = e.dataTransfer.getData("imgSrc");
  const type = e.dataTransfer.getData("type");
  const x = (e.offsetX - originX) / scale;
  const y = (e.offsetY - originY) / scale;

  const img = new Image();
  img.src = src;
  img.onload = () => {
    vehicles.push({ img, type, x, y, w: img.width/40, h: img.height/40 });
    redraw();
  };
});
canvas.addEventListener("dragleave", () => { draggingVehiclePreview = null; redraw(); });


//
// === Toolbar: Farben & Strichstärken ===
//
const toolbar = document.querySelector(".toolbar");
const colors = ["black","white","red","green","blue","orange","yellow","purple"];
const widths = [1,2,3,6,8,10,12,14];

let activeColorButton = null;
let activeWidthButton = null;

// === Farbpalette ===
const colorPalette = document.createElement("div");
colorPalette.style.display = "flex";
colorPalette.style.gap = "6px";
colorPalette.style.marginTop = "20px";
toolbar.appendChild(colorPalette);

colors.forEach(c => {
  const b = document.createElement("button");
  b.style.width = b.style.height = "28px";
  b.style.border = "1px solid #e0e0e0";
  b.style.borderRadius = "10px";
  b.style.background = c;
  b.style.cursor = "pointer";
  b.style.boxShadow = "0 2px 6px rgba(0,0,0,0.05)";
  b.style.transition = "all 0.25s ease";

  b.addEventListener("click", () => {
    currentColor = c;

    // Alte Auswahl zurücksetzen
    if(activeColorButton) {
      activeColorButton.style.boxShadow = "0 2px 6px rgba(0,0,0,0.05)";
      activeColorButton.style.transform = "translateY(0)";
      activeColorButton.style.border = "1px solid #e0e0e0";
    }

    // Neue Auswahl markieren
    activeColorButton = b;
    b.style.boxShadow = "0 0 0 2px rgb(204, 204, 204)";
    b.style.border = "1px solid black";
  });

  b.addEventListener("mouseenter", () => {
    if(b !== activeColorButton) {
      b.style.transform = "translateY(-2px)";
      b.style.boxShadow = "0 4px 10px rgba(0,0,0,0.1)";
    }
  });
  b.addEventListener("mouseleave", () => {
    if(b !== activeColorButton) {
      b.style.transform = "translateY(0)";
      b.style.boxShadow = "0 2px 6px rgba(0,0,0,0.05)";
    }
  });

  colorPalette.appendChild(b);
});

// === Breitenpalette ===
const widthPalette = document.createElement("div");
widthPalette.style.display = "flex";
widthPalette.style.gap = "6px";
widthPalette.style.marginTop = "10px";
toolbar.appendChild(widthPalette);

widths.forEach(w => {
  const b = document.createElement("button");
  b.textContent = w;
  b.style.width = b.style.height = "28px";
  b.style.border = "1px solid #e0e0e0";
  b.style.borderRadius = "10px";
  b.style.background = "white";
  b.style.color = "#222";
  b.style.fontWeight = "500";
  b.style.cursor = "pointer";
  b.style.boxShadow = "0 2px 6px rgba(0,0,0,0.05)";
  b.style.transition = "all 0.25s ease";

  b.addEventListener("click", () => {
    currentWidth = w;

    // Alte Auswahl zurücksetzen
    if(activeWidthButton) {
      activeWidthButton.style.boxShadow = "0 2px 6px rgba(0,0,0,0.05)";
      activeWidthButton.style.transform = "translateY(0)";
      activeWidthButton.style.border = "1px solid #e0e0e0";
      activeWidthButton.style.background = "white";
    }

    // Neue Auswahl markieren
    activeWidthButton = b;
    b.style.boxShadow = "0 0 0 2px rgb(204, 204, 204)";
    b.style.border = "1px solid black";
    b.style.background = "white";
  });

  b.addEventListener("mouseenter", () => {
    if(b !== activeWidthButton) {
      b.style.transform = "translateY(-2px)";
      b.style.boxShadow = "0 4px 10px rgba(0,0,0,0.1)";
      b.style.background = "#ff9933";
    }
  });
  b.addEventListener("mouseleave", () => {
    if(b !== activeWidthButton) {
      b.style.transform = "translateY(0)";
      b.style.boxShadow = "0 2px 6px rgba(0,0,0,0.05)";
      b.style.background = "white";
    }
  });

  widthPalette.appendChild(b);
});


//
// === Toolbar: Buttons & Drag ===
//
document.getElementById("clearCanvas").addEventListener("click", clearCanvas);

document.querySelectorAll(".icon-btn").forEach(btn =>
  btn.addEventListener("click", () => selectIcon(btn.dataset.icon))
);

document.querySelectorAll(".vehicle").forEach(v => {
  v.setAttribute("draggable", true);
  v.addEventListener("dragstart", e => {
    const imgEl = v.querySelector("img");
    e.dataTransfer.setData("imgSrc", imgEl.getAttribute("src"));
    e.dataTransfer.setData("type", v.classList[1]);
  });
});


//
// === Layer-Checkbox Events ===
//
document.getElementById("layer-pda").addEventListener("change", e => { showPDA = e.target.checked; redraw(); });
document.getElementById("layer-hydrants").addEventListener("change", e => { showHydrants = e.target.checked; redraw(); });
document.getElementById("layer-brs").addEventListener("change", e => { showBrs = e.target.checked; redraw(); });


//
// === Modus-Handling ===
//
function toggleMode(newMode) {
  mode = newMode;
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.style.background = (btn.dataset.mode === mode) ? "#ccc" : "white";
  });
}
toggleMode("move");

document.querySelectorAll(".mode-btn").forEach(btn =>
  btn.addEventListener("click", () => toggleMode(btn.dataset.mode))
);


//
// === UI Funktionen ===
//
function selectIcon(icon) { currentIcon = icon; }
function selectVehicle(imgSrc) { currentVehicle = imgSrc; }
function clearCanvas() {
  drawings = []; icons = []; vehicles = []; polygons = [];
  scale = 1; originX = 0; originY = 0;
  redraw();
}
function clearFields() {
  document.querySelectorAll("input[type='text']").forEach(i => i.value = "");
  document.querySelectorAll("textarea").forEach(t => t.value = "");
}

//
// === Polygon-Modus Trigger ===
//
document.querySelectorAll(".gebiet.taktik").forEach(btn => {
  btn.addEventListener("click", () => {
    const color = btn.dataset.color || "rgba(255,0,0,0.4)"; // fallback rot
    toggleMode("polygon");
    currentPolygon = { points: [], color };
  });
});


//
// === PDF Export ===
//
document.getElementById("downloadPDF").addEventListener("click", () => {
  const element = document.body;
  const drawingCanvas = document.getElementById("drawingCanvas");

  html2canvas(element, {
    scale: 2, useCORS: true,
    ignoreElements: el => el.id === "drawingCanvas"
  }).then(pageCanvas => {
    const pageImgData = pageCanvas.toDataURL("image/png");
    const canvasImgData = drawingCanvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (pageCanvas.height * imgWidth) / pageCanvas.width;
    pdf.addImage(pageImgData, "PNG", 0, 0, imgWidth, imgHeight);

    const canvasAspect = drawingCanvas.width / drawingCanvas.height;
    let canvasWidthMM = pageWidth * 0.9;
    let canvasHeightMM = canvasWidthMM / canvasAspect;

    if (canvasHeightMM > pageHeight * 0.9) {
      canvasHeightMM = pageHeight * 0.9;
      canvasWidthMM = canvasHeightMM * canvasAspect;
    }

    const x = (pageWidth - canvasWidthMM) / 2;
    const y = (pageHeight - canvasHeightMM) / 2;

    pdf.addImage(canvasImgData, "PNG", x, y, canvasWidthMM, canvasHeightMM);
    pdf.save("einsatzdokumentation.pdf");
  });
});







// Tabs Funktionalität
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// Dropdown Funktionalität
const dropdowns = document.querySelectorAll('.dropdown-header');
dropdowns.forEach(drop => {
  drop.addEventListener('click', () => {
    const content = drop.nextElementSibling;
    content.style.display = content.style.display === 'block' ? 'none' : 'block';
  });
});

document.getElementById("add-lagemeldung").addEventListener("click", function() {
  const table = document.getElementById("lagemeldungen-table");
  const newRow = table.insertRow(-1);

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  const cell1 = newRow.insertCell(0);
  const cell2 = newRow.insertCell(1);
  const cell3 = newRow.insertCell(2);

  cell1.innerHTML = `<input type="text" value="${timeStr}" readonly>`;
  cell2.innerHTML = `<textarea></textarea>`;
  cell3.innerHTML = `<textarea></textarea>`;
});

document.querySelectorAll('.wache-toggle').forEach(button => {
  button.addEventListener('click', () => {
    const wache = button.nextElementSibling;
    wache.style.display = wache.style.display === 'block' ? 'none' : 'block';

    // Aktiven Zustand für Button setzen
    button.classList.toggle('active');
  });
});

const container = document.getElementById('lagen-container');

// Alle Fahrzeugnamen aus der Fahrzeugübersicht sammeln
function getAllFahrzeuge() {
  const fahrzeugCells = document.querySelectorAll('#fahrzeuguebersicht .wache-fahrzeuge td:first-child');
  const fahrzeuge = Array.from(fahrzeugCells).map(cell => cell.textContent.trim());
  return fahrzeuge;
}

function createLagemeldung(index) {
  const fahrzeuge = getAllFahrzeuge();

  const dropdown = document.createElement('div');
  dropdown.classList.add('dropdown');

  const header = document.createElement('div');
  header.classList.add('dropdown-header');
  header.textContent = `${index + 1}. Lagemeldung ▼`;

  const content = document.createElement('div');
  content.classList.add('dropdown-content');

  // Aktuelle Uhrzeit im Format HH:MM
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${hours}:${minutes}`;

  // Dropdown für Fahrzeuge erstellen
  const fahrzeugOptions = fahrzeuge.map(f => `<option value="${f}">${f}</option>`).join('');

  content.innerHTML = `
    <table>
      <tr><th>Uhrzeit</th><td><input type="text" value="${currentTime}"></td></tr>
      <tr><th>Meldendes Fahrzeug</th><td>
        <select>
          <option value="">Bitte auswählen</option>
          ${fahrzeugOptions}
        </select>
      </td></tr>
      <tr><th>Einsatzstelle</th><td><input type="text"></td></tr>
      <tr><th>Lage</th><td><textarea rows="2"></textarea></td></tr>
      <tr><th>Durchgeführte Maßnahmen</th><td><textarea rows="2"></textarea></td></tr>
      <tr><th>Eingesetzte Kräfte</th><td><textarea rows="2"></textarea></td></tr>
      <tr><th>Nachforderung</th><td><textarea rows="2"></textarea></td></tr>
    </table>
  `;

  // Klick-Funktion für Header
  header.addEventListener('click', () => {
    content.style.display = content.style.display === 'block' ? 'none' : 'block';
    header.classList.toggle('active');
  });

  dropdown.appendChild(header);
  dropdown.appendChild(content);
  container.appendChild(dropdown);
}

// Button um neue Lagemeldungen hinzuzufügen
document.getElementById('add-lagemeldungmeldnschema').addEventListener('click', () => {
  const index = container.querySelectorAll('.dropdown').length;
  createLagemeldung(index);
});
