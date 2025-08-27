//
// Canvas Setup
//
const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");

canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;


//
// Zoom & Pan
//
let scale = 1, originX = 0, originY = 0;
let panning = false, panStartX = 0, panStartY = 0;


//
// Canvas-Elemente
//
let drawings = []; // {x1, y1, x2, y2, color, width}
let icons = [];    // {icon, x, y}
let vehicles = []; // {text, type, x, y}


//
// States für Aktionen
//
let painting = false;
let currentIcon = null;
let currentVehicle = null;
let draggingItem = null;
let dragOffsetX = 0, dragOffsetY = 0;
let draggingVehiclePreview = null;


//
// Maloptionen
//
let currentColor = "black";
let currentWidth = 2;


//
// Fahrzeugfarben
//
const vehicleColors = {
  einsatz: "#e60000",
  kdow: "#ff4d4d",
  mzf: "#ff66b2",
  rw2: "#ff8533",
  gwl2: "#ff6600",
  dlk: "#ffcc33",
  lfhlf: "#33cc33",
  nktw: "#66ffcc",
  rtw: "#009999",
  gwl1: "#33ffff",
  elw1: "#3399ff",
  elw2: "#0066ff",
  wlf: "#9933ff",
  nef: "#cc3300",
  platz: "#d9d9d9"
};


//
// Hintergrundbilder
//
const background = new Image();
background.src = "img/Karte-Normal.png";
background.onload = redraw;

const hydrantsImage = new Image();
hydrantsImage.src = "img/Karte-Hydranten.png";
hydrantsImage.onload = redraw;


//
// Layer-Zustände
//
let showBackground = true;
let showHydrants = false;


//
// Hilfsfunktion: Item unter Maus finden
//
function findItemAt(x, y) {
  // Fahrzeuge prüfen
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    ctx.font = `${20/scale}px Arial`;
    const tm = ctx.measureText(v.text);
    const w = tm.width;
    const h = 20/scale;
    const paddingX = 6/scale;
    const paddingY = 4/scale;

    if (x >= v.x - paddingX && x <= v.x + w + paddingX &&
      y >= v.y - h - paddingY && y <= v.y + paddingY) {
      return v;
    }
  }

  // Icons prüfen
  for (let i = icons.length - 1; i >= 0; i--) {
    const ic = icons[i];
    if (x >= ic.x - 10 && x <= ic.x + 30 &&
      y >= ic.y - 15 && y <= ic.y + 15) {
      return ic;
    }
  }
  return null;
}


//
// Event Listener: Canvas
//
canvas.addEventListener("mousedown", e => {
  const x = (e.offsetX - originX) / scale;
  const y = (e.offsetY - originY) / scale;

  // Pan mit Rechtsklick
  if (e.button === 2) {
    panning = true;
    panStartX = e.offsetX - originX;
    panStartY = e.offsetY - originY;
    return;
  }
  if (e.button !== 0) return;

  // Icon platzieren
  if (currentIcon) {
    icons.push({ icon: currentIcon, x, y });
    currentIcon = null;
    redraw();
    return;
  }

  // Fahrzeug platzieren
  if (currentVehicle) {
    vehicles.push({ text: currentVehicle, type: null, x, y });
    currentVehicle = null;
    redraw();
    return;
  }

  // Dragging prüfen
  const item = findItemAt(x, y);
  if (item) {
    draggingItem = item;
    dragOffsetX = x - item.x;
    dragOffsetY = y - item.y;
    return;
  }

  // Zeichnen starten
  painting = true;
  drawings.push({
    x1: x, y1: y,
    x2: x, y2: y,
    color: currentColor,
    width: currentWidth / scale
  });
});

canvas.addEventListener("mousemove", e => {
  const x = (e.offsetX - originX) / scale;
  const y = (e.offsetY - originY) / scale;

  // Zeichnen
  if (painting) {
    const last = drawings[drawings.length - 1];
    last.x2 = x; last.y2 = y;
    drawings.push({
      x1: x, y1: y,
      x2: x, y2: y,
      color: currentColor,
      width: currentWidth / scale
    });
    redraw();
  }

  // Draggen
  if (draggingItem) {
    draggingItem.x = x - dragOffsetX;
    draggingItem.y = y - dragOffsetY;
    redraw();
  }

  // Panning
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
});

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const mouseX = e.offsetX, mouseY = e.offsetY;
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = scale * delta;

  originX = mouseX - ((mouseX - originX) * (newScale / scale));
  originY = mouseY - ((mouseY - originY) * (newScale / scale));
  scale = newScale;
  redraw();
});

canvas.addEventListener("contextmenu", e => e.preventDefault());


//
// Drag & Drop für Fahrzeuge
//
canvas.addEventListener("dragover", e => { e.preventDefault(); redraw(); });
canvas.addEventListener("drop", e => {
  e.preventDefault();
  const text = e.dataTransfer.getData("text/plain");
  const type = e.dataTransfer.getData("type");
  const x = (e.offsetX - originX) / scale;
  const y = (e.offsetY - originY) / scale;
  vehicles.push({ text, type, x, y });
  draggingVehiclePreview = null;
  redraw();
});
canvas.addEventListener("dragleave", () => { draggingVehiclePreview = null; redraw(); });


//
// Karten Sklaierung
//
function drawBackgroundImage(img) {
  const canvasRatio = canvas.width / canvas.height;
  const imageRatio = img.width / img.height;
  let drawWidth, drawHeight, offsetX, offsetY;

  if (imageRatio > canvasRatio) {
    // Bild ist breiter → an Canvas-Breite anpassen
    drawWidth = canvas.width;
    drawHeight = canvas.width / imageRatio;
    offsetX = 0;
    offsetY = (canvas.height - drawHeight) / 2;
  } else {
    // Bild ist höher → an Canvas-Höhe anpassen
    drawHeight = canvas.height;
    drawWidth = canvas.height * imageRatio;
    offsetX = (canvas.width - drawWidth) / 2;
    offsetY = 0;
  }

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}


//
// Zeichnen: Redraw
//
function redraw() {
  ctx.setTransform(scale, 0, 0, scale, originX, originY);
  ctx.clearRect(-originX / scale, -originY / scale, canvas.width / scale, canvas.height / scale);

  // Karten
  if (showBackground) drawBackgroundImage(background);
  if (showHydrants) drawBackgroundImage(hydrantsImage);

  // Linien
  drawings.forEach(d => {
    ctx.beginPath();
    ctx.moveTo(d.x1, d.y1);
    ctx.lineTo(d.x2, d.y2);
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.width;
    ctx.lineCap = "round";
    ctx.stroke();
  });

  // Icons
  icons.forEach(i => {
    ctx.font = `${24/scale}px Arial`;
    ctx.fillStyle = "#000";
    ctx.fillText(i.icon, i.x, i.y);
  });

  // Fahrzeuge
  vehicles.forEach(v => drawVehicle(v));

  // Vorschau
  if (draggingVehiclePreview) {
    drawVehicle({
      text: draggingVehiclePreview,
      type: null,
      x: (draggingVehiclePreviewX || 0),
      y: (draggingVehiclePreviewY || 0)
    });
  }
}


//
// Zeichnen: Fahrzeuge
//
function drawVehicle(v) {
  const paddingX = 6/scale, paddingY = 4/scale;
  ctx.font = `${20/scale}px Arial`;

  const tm = ctx.measureText(v.text);
  const w = tm.width, h = 20/scale;
  const fillColor = vehicleColors[v.type] || "#fffae6";

  ctx.fillStyle = fillColor;
  ctx.fillRect(v.x - paddingX, v.y - h, w + paddingX*2, h + paddingY*2);

  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2/scale;
  ctx.strokeRect(v.x - paddingX, v.y - h, w + paddingX*2, h + paddingY*2);

  ctx.fillStyle = "#000";
  ctx.fillText(v.text, v.x, v.y + paddingY);
}


//
// UI-Funktionen
//
function selectIcon(icon) { currentIcon = icon; }
function selectVehicle(text) { currentVehicle = text; }
function clearCanvas() {
  drawings = []; icons = []; vehicles = [];
  scale = 1; originX = 0; originY = 0;
  redraw();
}


//
// Toolbar: Farben & Strichstärken
//
const colors = ["black","red","green","blue","orange","purple"];
const widths = [1,2,4,6,8,12];
const toolbar = document.querySelector(".toolbar");

// Farbpalette
const colorPalette = document.createElement("div");
colorPalette.style.display="flex";
colorPalette.style.gap="6px";
toolbar.appendChild(colorPalette);

colors.forEach(c => {
  const b = document.createElement("button");
  b.style.backgroundColor = c;
  b.style.width = b.style.height = "28px";
  b.style.border = "2px solid #333";
  b.style.borderRadius = "50%";
  b.style.cursor = "pointer";
  b.addEventListener("click", () => currentColor = c);
  colorPalette.appendChild(b);
});

// Breitenpalette
const widthPalette = document.createElement("div");
widthPalette.style.display="flex";
widthPalette.style.gap="6px";
toolbar.appendChild(widthPalette);

widths.forEach(w => {
  const b = document.createElement("button");
  b.textContent = w;
  b.style.width = b.style.height = "28px";
  b.style.border = "2px solid #333";
  b.style.borderRadius = "6px";
  b.style.cursor = "pointer";
  b.addEventListener("click", () => currentWidth = w);
  widthPalette.appendChild(b);
});


//
// Toolbar: Buttons & Drag
//
document.getElementById("clearCanvas").addEventListener("click", clearCanvas);
document.querySelectorAll(".icon-btn").forEach(btn =>
  btn.addEventListener("click", () => selectIcon(btn.dataset.icon))
);

document.querySelectorAll(".vehicle").forEach(v => {
  v.setAttribute("draggable", true);
  v.addEventListener("dragstart", e => {
    draggingVehiclePreview = e.target.textContent;
    e.dataTransfer.setData("text/plain", draggingVehiclePreview);
    e.dataTransfer.setData("type", e.target.classList[1]);
  });
});


//
// Layer-Checkbox Events
//
document.getElementById("layer-background").addEventListener("change", e => {
  showBackground = e.target.checked;
  redraw();
});

document.getElementById("layer-hydrants").addEventListener("change", e => {
  showHydrants = e.target.checked;
  redraw();
});


//
// Weiteren Code
//

document.querySelectorAll(".toggle").forEach(btn => {
  btn.addEventListener("click", () => {
    const vehicles = btn.nextElementSibling;
    vehicles.classList.toggle("hidden");

    // Pfeil ändern
    if (vehicles.classList.contains("hidden")) {
      btn.textContent = btn.textContent.replace("▲", "▼");
    } else {
      btn.textContent = btn.textContent.replace("▼", "▲");
    }
  });
});

function clearFields() {
  // alle Input-Felder leeren
  document.querySelectorAll("input[type='text']").forEach(input => input.value = "");
  // alle Textareas leeren
  document.querySelectorAll("textarea").forEach(textarea => textarea.value = "");
}

document.getElementById("downloadPDF").addEventListener("click", () => {
  const element = document.body;
  const drawingCanvas = document.getElementById("drawingCanvas");

  html2canvas(element, {
    scale: 2,
    useCORS: true,
    ignoreElements: el => el.id === "drawingCanvas"
  }).then(pageCanvas => {
    const pageImgData = pageCanvas.toDataURL("image/png");
    const canvasImgData = drawingCanvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Seite einfügen
    const imgWidth = pageWidth;
    const imgHeight = (pageCanvas.height * imgWidth) / pageCanvas.width;
    pdf.addImage(pageImgData, "PNG", 0, 0, imgWidth, imgHeight);

    // Canvas zentrieren
    const canvasAspect = drawingCanvas.width / drawingCanvas.height;
    let canvasWidthMM = pageWidth * 0.9; // 90% der Seitenbreite
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
