// openDB/saveMediaRecord/loadMediaRecord/deleteMediaRecord از media-store.js میان.
// fwT/fwSetCurrentLang/fwApplyTranslations/fwFormatBytes از i18n.js میان.
// (هر دو باید قبل از این فایل در options.html لود بشن).

// ---------- تنظیمات (chrome.storage.local) ----------
const DEFAULT_SETTINGS = {
  enabledByDefault: false,
  siteOverrides: {},
  mode: 'image',
  zoom: 1,
  panX: 0.5,
  panY: 0.5,
  paused: false,
  language: 'fa',
};

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['fakeWebcamSettings'], (result) => {
      resolve(Object.assign({}, DEFAULT_SETTINGS, result.fakeWebcamSettings || {}));
    });
  });
}

function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ fakeWebcamSettings: settings }, resolve);
  });
}

function clamp01(v) {
  return Math.min(Math.max(v, 0), 1);
}

function computeCrop(sw, sh, zoom, panX, panY) {
  const z = Math.min(Math.max(zoom || 1, 1), 8);
  const cropW = sw / z;
  const cropH = sh / z;
  const maxX = Math.max(sw - cropW, 0);
  const maxY = Math.max(sh - cropH, 0);
  const cx = clamp01(panX ?? 0.5) * maxX;
  const cy = clamp01(panY ?? 0.5) * maxY;
  return { sx: cx, sy: cy, sw: cropW, sh: cropH };
}

// ---------- عناصر صفحه ----------
const modeImageRadio = document.getElementById('modeImage');
const modeVideoRadio = document.getElementById('modeVideo');
const imageInput = document.getElementById('imageInput');
const videoInput = document.getElementById('videoInput');
const imageInfo = document.getElementById('imageInfo');
const videoInfo = document.getElementById('videoInfo');
const removeImageBtn = document.getElementById('removeImage');
const removeVideoBtn = document.getElementById('removeVideo');
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const zoomRange = document.getElementById('zoomRange');
const zoomValueEl = document.getElementById('zoomValue');
const resetViewBtn = document.getElementById('resetView');
const globalToggle = document.getElementById('globalToggle');
const siteTableBody = document.getElementById('siteTableBody');
const noOverridesEl = document.getElementById('noOverrides');
const saveStatusEl = document.getElementById('saveStatus');

let settings = null;
let currentSourceEl = null;
let currentSourceUrl = null;
let sourceReady = false;

// ---------- ذخیره با تاخیر کوتاه (برای اسلایدر/درگ) ----------
let saveTimer = null;
function scheduleSave(delay = 200) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveSettings(settings);
    flashSaveStatus();
  }, delay);
}

let flashTimer = null;
function flashSaveStatus() {
  saveStatusEl.textContent = fwT('statusSaved');
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    saveStatusEl.textContent = '';
  }, 1200);
}

// ---------- پیش‌نمایش ----------
async function loadPreviewForMode(mode) {
  if (currentSourceEl && currentSourceEl.pause) {
    currentSourceEl.pause();
  }
  if (currentSourceUrl) {
    URL.revokeObjectURL(currentSourceUrl);
    currentSourceUrl = null;
  }
  currentSourceEl = null;
  sourceReady = false;

  const record = await loadMediaRecord(mode);
  if (!record || !record.blob) return;

  const url = URL.createObjectURL(record.blob);
  currentSourceUrl = url;

  if (mode === 'video') {
    const v = document.createElement('video');
    v.src = url;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    try {
      await v.play();
    } catch (e) {}
    currentSourceEl = v;
  } else {
    const img = new Image();
    img.src = url;
    await new Promise((res) => {
      img.onload = res;
      img.onerror = res;
    });
    currentSourceEl = img;
  }
  sourceReady = true;
}

function drawFrame() {
  const w = canvas.width;
  const h = canvas.height;

  if (!sourceReady || !currentSourceEl) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9aa0a6';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(fwT('previewNoFile'), w / 2, h / 2);
  } else {
    const sw = currentSourceEl.videoWidth || currentSourceEl.naturalWidth || w;
    const sh = currentSourceEl.videoHeight || currentSourceEl.naturalHeight || h;
    if (sw && sh) {
      const { sx, sy, sw: cw, sh: ch } = computeCrop(sw, sh, settings.zoom, settings.panX, settings.panY);
      ctx.drawImage(currentSourceEl, sx, sy, cw, ch, 0, 0, w, h);
    }
  }
  requestAnimationFrame(drawFrame);
}

// ---------- درگ برای جابجایی ----------
let dragging = false;
let lastX = 0;
let lastY = 0;

function applyDragDelta(dxCss, dyCss) {
  if (!currentSourceEl) return;
  const sw = currentSourceEl.videoWidth || currentSourceEl.naturalWidth;
  const sh = currentSourceEl.videoHeight || currentSourceEl.naturalHeight;
  if (!sw || !sh) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const zoom = Math.min(Math.max(settings.zoom, 1), 8);
  const cropW = sw / zoom;
  const cropH = sh / zoom;
  const maxX = sw - cropW;
  const maxY = sh - cropH;

  if (maxX > 0) {
    const deltaSrcX = ((dxCss * scaleX) / canvas.width) * cropW;
    settings.panX = clamp01(settings.panX - deltaSrcX / maxX);
  }
  if (maxY > 0) {
    const deltaSrcY = ((dyCss * scaleY) / canvas.height) * cropH;
    settings.panY = clamp01(settings.panY - deltaSrcY / maxY);
  }
}

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  applyDragDelta(dx, dy);
  scheduleSave(150);
});

canvas.addEventListener('pointerup', () => {
  dragging = false;
});
canvas.addEventListener('pointercancel', () => {
  dragging = false;
});

// ---------- فایل‌ها ----------
async function updateFileInfo(kind) {
  const record = await loadMediaRecord(kind);
  const infoEl = kind === 'image' ? imageInfo : videoInfo;
  if (record) {
    infoEl.textContent = `${record.name || fwT('defaultFileName')} (${fwFormatBytes(record.size)})`;
  } else {
    infoEl.textContent = fwT('fileNotSelected');
  }
}

imageInput.addEventListener('change', async () => {
  const file = imageInput.files[0];
  if (!file) return;
  await saveMediaRecord('image', { blob: file, name: file.name, size: file.size });
  await updateFileInfo('image');
  if (settings.mode === 'image') await loadPreviewForMode('image');
  flashSaveStatus();
});

videoInput.addEventListener('change', async () => {
  const file = videoInput.files[0];
  if (!file) return;
  await saveMediaRecord('video', { blob: file, name: file.name, size: file.size });
  await updateFileInfo('video');
  if (settings.mode === 'video') await loadPreviewForMode('video');
  flashSaveStatus();
});

removeImageBtn.addEventListener('click', async () => {
  await deleteMediaRecord('image');
  imageInput.value = '';
  await updateFileInfo('image');
  if (settings.mode === 'image') await loadPreviewForMode('image');
  flashSaveStatus();
});

removeVideoBtn.addEventListener('click', async () => {
  await deleteMediaRecord('video');
  videoInput.value = '';
  await updateFileInfo('video');
  if (settings.mode === 'video') await loadPreviewForMode('video');
  flashSaveStatus();
});

// ---------- حالت عکس/ویدیو ----------
modeImageRadio.addEventListener('change', async () => {
  if (!modeImageRadio.checked) return;
  settings.mode = 'image';
  await saveSettings(settings);
  await loadPreviewForMode('image');
  flashSaveStatus();
});

modeVideoRadio.addEventListener('change', async () => {
  if (!modeVideoRadio.checked) return;
  settings.mode = 'video';
  await saveSettings(settings);
  await loadPreviewForMode('video');
  flashSaveStatus();
});

// ---------- زوم ----------
zoomRange.addEventListener('input', () => {
  settings.zoom = parseFloat(zoomRange.value);
  zoomValueEl.textContent = `${settings.zoom.toFixed(2)}x`;
  scheduleSave(150);
});

resetViewBtn.addEventListener('click', async () => {
  settings.zoom = 1;
  settings.panX = 0.5;
  settings.panY = 0.5;
  zoomRange.value = '1';
  zoomValueEl.textContent = '1.00x';
  await saveSettings(settings);
  flashSaveStatus();
});

// ---------- فعال‌سازی سراسری و استثناها ----------
globalToggle.addEventListener('change', async () => {
  settings.enabledByDefault = globalToggle.checked;
  await saveSettings(settings);
  flashSaveStatus();
});

function renderSiteTable() {
  const entries = Object.entries(settings.siteOverrides || {});
  siteTableBody.innerHTML = '';
  noOverridesEl.style.display = entries.length ? 'none' : 'block';

  entries.forEach(([host, enabled]) => {
    const tr = document.createElement('tr');

    const tdHost = document.createElement('td');
    tdHost.textContent = host === 'local-files' ? fwT('localFilesLabel') : host;

    const tdStatus = document.createElement('td');
    tdStatus.textContent = enabled ? fwT('enabledLabel') : fwT('disabledLabel');

    const tdActions = document.createElement('td');
    const removeBtn = document.createElement('button');
    removeBtn.textContent = fwT('remove');
    removeBtn.className = 'danger small';
    removeBtn.addEventListener('click', async () => {
      delete settings.siteOverrides[host];
      await saveSettings(settings);
      renderSiteTable();
      flashSaveStatus();
    });
    tdActions.appendChild(removeBtn);

    tr.append(tdHost, tdStatus, tdActions);
    siteTableBody.appendChild(tr);
  });
}

// ---------- زبان ----------
const langButtons = document.querySelectorAll('.lang-btn');

async function renderAll() {
  fwApplyTranslations();
  await updateFileInfo('image');
  await updateFileInfo('video');
  renderSiteTable();
}

langButtons.forEach((btn) => {
  btn.addEventListener('click', async () => {
    const lang = btn.getAttribute('data-lang');
    settings.language = lang;
    fwSetCurrentLang(lang);
    await saveSettings(settings);
    await renderAll();
  });
});

// ---------- شروع ----------
(async function init() {
  settings = await getSettings();
  fwSetCurrentLang(settings.language);

  modeImageRadio.checked = settings.mode !== 'video';
  modeVideoRadio.checked = settings.mode === 'video';
  zoomRange.value = String(settings.zoom);
  zoomValueEl.textContent = `${settings.zoom.toFixed(2)}x`;
  globalToggle.checked = !!settings.enabledByDefault;

  await renderAll();

  await loadPreviewForMode(settings.mode);
  requestAnimationFrame(drawFrame);
})();
