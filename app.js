const state = {
    tool: 'select', color: '#ef4444', lineWidth: 4, scale: 1, panX: 0, panY: 0,
    isDragging: false, isDraggingShape: false, draggedShape: null, isDrawing: false,
    startX: 0, startY: 0, lastX: 0, lastY: 0, shapes: [], history: [], redoStack: [],
    image: null, darkMode: true, modalAction: null // 'clear' or 'reset'
};

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const textInput = document.getElementById('textInput');
const modal = document.getElementById('confirmationModal');
const modalContent = document.getElementById('modalContent');
const manualCopyModal = document.getElementById('manualCopyModal');
const manualCopyImg = document.getElementById('manualCopyImg');

function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    setupEventListeners();
    updateUI();
}

function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    draw();
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldX = (screenX - state.panX) / state.scale;
    const worldY = (screenY - state.panY) / state.scale;
    return { screenX, screenY, worldX, worldY };
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(state.panX, state.panY);
    ctx.scale(state.scale, state.scale);

    if (state.image) {
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 20;
        ctx.drawImage(state.image, 0, 0);
        ctx.shadowBlur = 0;
    }

    state.shapes.filter(s => s.type === 'blur').forEach(shape => {
        if (!state.image) return;
        ctx.save(); ctx.beginPath();
        ctx.rect(shape.x, shape.y, shape.w, shape.h);
        ctx.clip(); ctx.filter = 'blur(10px)';
        ctx.drawImage(state.image, 0, 0);
        ctx.filter = 'none'; ctx.restore();
    });

    state.shapes.filter(s => s.type !== 'blur').forEach(shape => drawShape(shape));

    if (state.isDrawing && state.currentShape) {
        if (state.currentShape.type === 'blur') {
             if (state.image) {
                ctx.save(); ctx.beginPath();
                ctx.rect(state.currentShape.x, state.currentShape.y, state.currentShape.w, state.currentShape.h);
                ctx.clip(); ctx.filter = 'blur(10px)';
                ctx.drawImage(state.image, 0, 0);
                ctx.restore();
                ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
                ctx.strokeRect(state.currentShape.x, state.currentShape.y, state.currentShape.w, state.currentShape.h);
                ctx.setLineDash([]);
             }
        } else {
            drawShape(state.currentShape);
        }
    }
    ctx.restore();
}

function drawShape(shape) {
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = shape.type === 'highlight' ? 0.4 : 1.0;
    if(shape.type === 'highlight') ctx.fillStyle = shape.color;

    ctx.beginPath();
    if (shape.type === 'rect' || shape.type === 'blur') {
        ctx.rect(shape.x, shape.y, shape.w, shape.h); ctx.stroke();
    } else if (shape.type === 'highlight') {
        ctx.rect(shape.x, shape.y, shape.w, shape.h); ctx.fill();
    } else if (shape.type === 'circle') {
        ctx.ellipse(shape.x + shape.w/2, shape.y + shape.h/2, Math.abs(shape.w/2), Math.abs(shape.h/2), 0, 0, 2 * Math.PI);
        ctx.stroke();
    } else if (shape.type === 'arrow') {
        const endX = shape.x + shape.w; const endY = shape.y + shape.h;
        ctx.moveTo(shape.x, shape.y); ctx.lineTo(endX, endY); ctx.stroke();
        const angle = Math.atan2(endY - shape.y, endX - shape.x);
        const headLen = shape.strokeWidth * 4;
        ctx.beginPath(); ctx.moveTo(endX, endY);
        ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI/6), endY - headLen * Math.sin(angle - Math.PI/6));
        ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI/6), endY - headLen * Math.sin(angle + Math.PI/6));
        ctx.lineTo(endX, endY); ctx.fillStyle = shape.color; ctx.fill();
    } else if (shape.type === 'freehand') {
        if (shape.points.length > 0) {
            ctx.moveTo(shape.points[0].x, shape.points[0].y);
            for (let i = 1; i < shape.points.length; i++) ctx.lineTo(shape.points[i].x, shape.points[i].y);
            ctx.stroke();
        }
    } else if (shape.type === 'text') {
        ctx.font = `${shape.strokeWidth * 5 + 10}px Inter, sans-serif`;
        ctx.fillStyle = shape.color; ctx.textBaseline = 'top';
        ctx.fillText(shape.text, shape.x, shape.y);
    }
    ctx.globalAlpha = 1.0;
}

function drawShapeOnContext(exCtx, shape) {
    // Isolated simplified drawing for export (no 'state' dependencies)
    exCtx.strokeStyle = shape.color;
    exCtx.lineWidth = shape.strokeWidth;
    exCtx.lineCap = 'round'; exCtx.lineJoin = 'round';
    exCtx.globalAlpha = shape.type === 'highlight' ? 0.4 : 1.0;
    if(shape.type === 'highlight') exCtx.fillStyle = shape.color;

    exCtx.beginPath();
    if (shape.type === 'rect' || shape.type === 'blur') {
        exCtx.rect(shape.x, shape.y, shape.w, shape.h); exCtx.stroke();
    } else if (shape.type === 'highlight') {
        exCtx.rect(shape.x, shape.y, shape.w, shape.h); exCtx.fill();
    } else if (shape.type === 'circle') {
        exCtx.ellipse(shape.x + shape.w/2, shape.y + shape.h/2, Math.abs(shape.w/2), Math.abs(shape.h/2), 0, 0, 2 * Math.PI);
        exCtx.stroke();
    } else if (shape.type === 'arrow') {
        const endX = shape.x + shape.w; const endY = shape.y + shape.h;
        exCtx.moveTo(shape.x, shape.y); exCtx.lineTo(endX, endY); exCtx.stroke();
        const angle = Math.atan2(endY - shape.y, endX - shape.x);
        const headLen = shape.strokeWidth * 4;
        exCtx.beginPath(); exCtx.moveTo(endX, endY);
        exCtx.lineTo(endX - headLen * Math.cos(angle - Math.PI/6), endY - headLen * Math.sin(angle - Math.PI/6));
        exCtx.lineTo(endX - headLen * Math.cos(angle + Math.PI/6), endY - headLen * Math.sin(angle + Math.PI/6));
        exCtx.lineTo(endX, endY); exCtx.fillStyle = shape.color; exCtx.fill();
    } else if (shape.type === 'freehand') {
        if (shape.points.length > 0) {
            exCtx.moveTo(shape.points[0].x, shape.points[0].y);
            for (let i = 1; i < shape.points.length; i++) exCtx.lineTo(shape.points[i].x, shape.points[i].y);
            exCtx.stroke();
        }
    } else if (shape.type === 'text') {
        exCtx.font = `${shape.strokeWidth * 5 + 10}px Inter, sans-serif`;
        exCtx.fillStyle = shape.color; exCtx.textBaseline = 'top';
        exCtx.fillText(shape.text, shape.x, shape.y);
    }
    exCtx.globalAlpha = 1.0;
}

function isPointInShape(x, y, shape) {
    if (shape.type === 'text') {
        ctx.font = `${shape.strokeWidth * 5 + 10}px Inter, sans-serif`;
        const metrics = ctx.measureText(shape.text);
        return x >= shape.x && x <= shape.x + metrics.width && y >= shape.y && y <= shape.y + (shape.strokeWidth * 5 + 10);
    }
    const rx = Math.min(shape.x, shape.x + shape.w);
    const ry = Math.min(shape.y, shape.y + shape.h);
    const rw = Math.abs(shape.w);
    const rh = Math.abs(shape.h);
    
    if (['rect', 'highlight', 'blur', 'arrow'].includes(shape.type)) {
        if (shape.type === 'arrow') return x >= rx - 10 && x <= rx + rw + 10 && y >= ry - 10 && y <= ry + rh + 10;
        return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
    }
    if (shape.type === 'circle') {
        const nx = (x - (shape.x + shape.w/2)) / (shape.w/2);
        const ny = (y - (shape.y + shape.h/2)) / (shape.h/2);
        return (nx * nx + ny * ny) <= 1;
    }
    if (shape.type === 'freehand') {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        shape.points.forEach(p => {
            if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
        });
        return x >= minX - 10 && x <= maxX + 10 && y >= minY - 10 && y <= maxY + 10;
    }
    return false;
}

function setupEventListeners() {
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('wheel', onZoom, { passive: false });

    document.querySelectorAll('.tool-btn').forEach(btn => btn.addEventListener('click', () => setTool(btn.dataset.tool)));
    document.getElementById('colorPicker').addEventListener('input', (e) => state.color = e.target.value);
    document.getElementById('lineWidth').addEventListener('input', (e) => {
        state.lineWidth = parseInt(e.target.value);
        document.getElementById('lineWidthValue').innerText = state.lineWidth + 'px';
    });

    document.getElementById('fileInput').addEventListener('change', handleImageUpload);
    document.getElementById('exportBtn').addEventListener('click', exportCanvas);
    document.getElementById('copyBtn').addEventListener('click', copyToClipboard);
    document.getElementById('resetBtn').addEventListener('click', () => showConfirmationModal('reset')); 
    
    container.addEventListener('dragover', e => e.preventDefault());
    container.addEventListener('drop', handleDrop);
    window.addEventListener('paste', handlePaste);

    document.getElementById('zoomIn').addEventListener('click', () => adjustZoom(0.1));
    document.getElementById('zoomOut').addEventListener('click', () => adjustZoom(-0.1));
    document.getElementById('fitZoom').addEventListener('click', fitImageToScreen);

    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);
    
    // Clear Annotations Button (Sidebar)
    document.getElementById('clearAllBtn').addEventListener('click', () => showConfirmationModal('clear'));
    
    document.getElementById('cancelModal').addEventListener('click', hideClearModal);
    document.getElementById('confirmClear').addEventListener('click', executeModalAction);

    document.getElementById('closeCopyModal').addEventListener('click', () => manualCopyModal.classList.add('hidden'));
    manualCopyModal.addEventListener('click', (e) => { if(e.target === manualCopyModal) manualCopyModal.classList.add('hidden'); });

    document.getElementById('toggleTheme').addEventListener('click', toggleTheme);
    document.getElementById('toggleSidebar').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('translate-x-full'));

    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') undo();
        if (e.ctrlKey && e.key === 'y') redo();
        if (e.code === 'Space') canvas.style.cursor = 'grab';
    });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') canvas.style.cursor = state.tool === 'select' ? 'default' : 'crosshair'; });

    textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') finalizeText(); });
    textInput.addEventListener('blur', finalizeText);
}

function showConfirmationModal(actionType) {
    state.modalAction = actionType;
    const title = document.getElementById('modalTitle');
    const desc = document.getElementById('modalDesc');
    const btn = document.getElementById('confirmClear');

    if (actionType === 'reset') {
        title.innerText = 'Reset Application?';
        desc.innerText = 'This will remove the image and all annotations. Start fresh?';
        btn.innerText = 'Reset Everything';
        btn.className = "flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium";
    } else {
        title.innerText = 'Clear Annotations?';
        desc.innerText = 'This will remove all drawings but keep the image.';
        btn.innerText = 'Clear Annotations';
        btn.className = "flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium";
    }

    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
        modalContent.classList.add('scale-100', 'opacity-100');
    });
}

function executeModalAction() {
    if (state.modalAction === 'reset') {
        // Reset Everything
        state.image = null;
        state.shapes = [];
        state.redoStack = [];
        state.panX = 0; state.panY = 0; state.scale = 1;
        document.getElementById('emptyState').classList.remove('hidden');
        document.getElementById('fileInput').value = ''; // Reset file input
    } else {
        // Clear Annotations Only
        state.shapes = [];
        state.redoStack = [];
    }
    draw();
    updateHistoryUI();
    updateZoomDisplay();
    hideClearModal();
}

function hideClearModal() {
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

function showManualCopyModal(dataUrl) {
    manualCopyImg.src = dataUrl;
    manualCopyModal.classList.remove('hidden');
}

function onPointerDown(e) {
    const pos = getMousePos(e);
    state.startX = pos.worldX; state.startY = pos.worldY; state.lastX = pos.screenX; state.lastY = pos.screenY;

    if (state.tool === 'select' && e.button === 0) {
        let hitShape = null;
        for (let i = state.shapes.length - 1; i >= 0; i--) {
            if (isPointInShape(pos.worldX, pos.worldY, state.shapes[i])) { hitShape = state.shapes[i]; break; }
        }
        if (hitShape) { state.isDraggingShape = true; state.draggedShape = hitShape; return; }
    }

    if (e.button === 1 || (e.button === 0 && state.tool === 'select') || e.code === 'Space') {
        state.isDragging = true; canvas.style.cursor = 'grabbing'; return;
    }

    if (e.button === 0 && state.image) {
        state.isDrawing = true;
        if (state.tool === 'text') { spawnTextInput(pos.screenX, pos.screenY, pos.worldX, pos.worldY); state.isDrawing = false; return; }
        state.currentShape = {
            type: state.tool, x: state.startX, y: state.startY, w: 0, h: 0,
            color: state.color, strokeWidth: state.lineWidth, points: [{x: state.startX, y: state.startY}], id: Date.now()
        };
        if (state.tool === 'highlight') { state.currentShape.color = '#fde047'; state.currentShape.strokeWidth = 0; }
    }
}

function onPointerMove(e) {
    const pos = getMousePos(e);
    if (state.tool === 'select' && !state.isDragging && !state.isDraggingShape) {
        let hover = false;
        for (let i = state.shapes.length - 1; i >= 0; i--) {
            if (isPointInShape(pos.worldX, pos.worldY, state.shapes[i])) { hover = true; break; }
        }
        canvas.style.cursor = hover ? 'move' : 'default';
    }

    if (state.isDraggingShape && state.draggedShape) {
        const dx = (pos.screenX - state.lastX) / state.scale; const dy = (pos.screenY - state.lastY) / state.scale;
        state.draggedShape.x += dx; state.draggedShape.y += dy;
        if (state.draggedShape.type === 'freehand') {
            state.draggedShape.points.forEach(p => { p.x += dx; p.y += dy; });
        }
        state.lastX = pos.screenX; state.lastY = pos.screenY; draw(); return;
    }

    if (state.isDragging) {
        state.panX += pos.screenX - state.lastX; state.panY += pos.screenY - state.lastY;
        state.lastX = pos.screenX; state.lastY = pos.screenY; draw(); return;
    }

    if (state.isDrawing && state.currentShape) {
        if (state.tool === 'freehand') {
            state.currentShape.points.push({x: pos.worldX, y: pos.worldY});
        } else {
            state.currentShape.w = pos.worldX - state.startX; state.currentShape.h = pos.worldY - state.startY;
        }
        draw();
    }
}

function onPointerUp() {
    if (state.isDraggingShape) { state.isDraggingShape = false; state.draggedShape = null; return; }
    if (state.isDragging) { state.isDragging = false; canvas.style.cursor = state.tool === 'select' ? 'default' : 'crosshair'; return; }
    if (state.isDrawing && state.currentShape) {
        state.isDrawing = false;
        if (state.tool !== 'freehand' && Math.abs(state.currentShape.w) < 5 && Math.abs(state.currentShape.h) < 5) {
            state.currentShape = null; draw(); return;
        }
        saveAction(state.currentShape); state.currentShape = null; draw();
    }
}

function spawnTextInput(sx, sy, wx, wy) {
    const rect = canvas.getBoundingClientRect();
    textInput.style.display = 'block';
    textInput.style.left = (sx + rect.left) + 'px';
    textInput.style.top = (sy + rect.top) + 'px';
    textInput.style.color = state.color;
    textInput.style.fontSize = (state.lineWidth * 5 + 10) + 'px';
    textInput.value = '';
    state.tempTextPos = { x: wx, y: wy };
    setTimeout(() => textInput.focus(), 10);
}

function finalizeText() {
    if (textInput.style.display === 'none') return;
    const val = textInput.value.trim();
    if (val && state.tempTextPos) {
        saveAction({ type: 'text', text: val, x: state.tempTextPos.x, y: state.tempTextPos.y, color: state.color, strokeWidth: state.lineWidth, id: Date.now() });
    }
    textInput.style.display = 'none'; textInput.value = ''; draw();
}

function saveAction(shape) { state.shapes.push(shape); state.redoStack = []; updateHistoryUI(); }
function undo() { if(state.shapes.length===0)return; state.redoStack.push(state.shapes.pop()); draw(); updateHistoryUI(); showToast('Undo'); }
function redo() { if(state.redoStack.length===0)return; state.shapes.push(state.redoStack.pop()); draw(); updateHistoryUI(); showToast('Redo'); }

function updateHistoryUI() {
    const list = document.getElementById('historyList');
    document.getElementById('layerCount').innerText = state.shapes.length;
    list.innerHTML = '';
    [...state.shapes].reverse().forEach((s, i) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm group';
        let icon = 'fa-square';
        if(s.type==='circle') icon='fa-circle'; else if(s.type==='arrow') icon='fa-arrow-right-long';
        else if(s.type==='text') icon='fa-font'; else if(s.type==='freehand') icon='fa-pen';
        item.innerHTML = `<div class="flex items-center gap-2 overflow-hidden"><i class="fa-solid ${icon} text-gray-400 w-4"></i><span class="truncate text-gray-600 dark:text-gray-300 capitalize">${s.type} ${s.text ? '"'+s.text+'"' : ''}</span></div><button class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition" onclick="deleteShape(${state.shapes.length-1-i})"><i class="fa-solid fa-xmark"></i></button>`;
        list.appendChild(item);
    });
}

// === FIX: Robust File Handlers ===
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        loadImage(file);
        // Reset value to allow re-uploading the same file
        e.target.value = '';
    }
}

function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        loadImage(file);
    }
}

function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let found = false;
    // Standard loop is safer than for..in on DataTransferItemList
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            loadImage(blob);
            found = true;
            showToast('Image pasted!');
            break; // Stop after first image
        }
    }
}

function loadImage(file) {
    const r = new FileReader();
    r.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            state.image = img; state.shapes=[]; state.redoStack=[];
            document.getElementById('emptyState').classList.add('hidden');
            fitImageToScreen(); updateHistoryUI();
        };
        img.src = e.target.result;
    };
    r.readAsDataURL(file);
}

function generateHighResCanvas() {
    if (!state.image) return null;
    const c = document.createElement('canvas');
    c.width = state.image.width; c.height = state.image.height;
    const x = c.getContext('2d');
    x.drawImage(state.image, 0, 0);
    state.shapes.filter(s => s.type === 'blur').forEach(s => {
        x.save(); x.beginPath(); x.rect(s.x, s.y, s.w, s.h); x.clip(); x.filter='blur(10px)'; x.drawImage(state.image,0,0); x.filter='none'; x.restore();
    });
    state.shapes.filter(s => s.type !== 'blur').forEach(s => drawShapeOnContext(x, s));
    return c;
}

function exportCanvas() {
    const c = generateHighResCanvas(); if(!c) return;
    const l = document.createElement('a');
    l.download = 'annotated-image.png'; l.href = c.toDataURL('image/png'); l.click();
    showToast('Image exported!');
}

async function copyToClipboard() {
    const c = generateHighResCanvas();
    if (!c) { showToast('No image to copy!'); return; }

    c.toBlob(async (blob) => {
        if (!blob) { showToast('Failed to render image.'); return; }
        
        try {
            if (typeof ClipboardItem !== "undefined" && navigator.clipboard && navigator.clipboard.write) {
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                showToast('Copied to clipboard!');
            } else {
                throw new Error("Clipboard API not supported");
            }
        } catch (err) {
            // Use warn instead of error to prevent console noise
            console.warn("Clipboard write failed (expected in iframes):", err.message);
            
            // Fallback: Show the modal immediately
            const dataUrl = c.toDataURL('image/png');
            showManualCopyModal(dataUrl);
            showToast('Manual copy required');
        }
    }, 'image/png');
}

function updateUI() {
    setTool(state.tool);
    document.getElementById('colorPicker').value = state.color;
    document.getElementById('lineWidth').value = state.lineWidth;
    document.getElementById('lineWidthValue').innerText = state.lineWidth + 'px';
    updateZoomDisplay(); updateHistoryUI();
}

function setTool(t) {
    state.tool = t;
    document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.remove('bg-white', 'dark:bg-gray-600', 'text-primary', 'shadow-sm', 'active-tool');
        b.classList.add('text-gray-500');
        if (b.dataset.tool === t) {
            b.classList.add('bg-white', 'dark:bg-gray-600', 'text-primary', 'shadow-sm', 'active-tool');
            b.classList.remove('text-gray-500');
        }
    });
    canvas.style.cursor = t === 'select' ? 'default' : 'crosshair';
}

function toggleTheme() { document.documentElement.classList.toggle('dark'); }
function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').innerText = msg;
    t.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 2000);
}

function onZoom(e) {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const direction = e.deltaY < 0 ? 1 : -1;
    adjustZoom(direction * zoomIntensity, e);
}

// Helpers
function adjustZoom(amt, e) {
    const oldScale = state.scale;
    state.scale += amt;
    state.scale = Math.max(0.1, Math.min(state.scale, 5)); 
    
    if (e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        state.panX = mouseX - (mouseX - state.panX) * (state.scale / oldScale);
        state.panY = mouseY - (mouseY - state.panY) * (state.scale / oldScale);
    } else {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        state.panX = centerX - (centerX - state.panX) * (state.scale / oldScale);
        state.panY = centerY - (centerY - state.panY) * (state.scale / oldScale);
    }

    updateZoomDisplay();
    draw();
}

function updateZoomDisplay() { document.getElementById('zoomLevel').innerText = Math.round(state.scale * 100) + '%'; }
function fitImageToScreen() {
    if(!state.image)return; const p=40;
    const wr = (canvas.width-p)/state.image.width; const hr = (canvas.height-p)/state.image.height;
    state.scale = Math.min(wr, hr);
    state.panX = (canvas.width - state.image.width * state.scale)/2;
    state.panY = (canvas.height - state.image.height * state.scale)/2;
    updateZoomDisplay(); draw();
}

init();
