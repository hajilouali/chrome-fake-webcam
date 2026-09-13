// saveMediaRecord/loadMediaRecord از media-store.js میان.
// getSiteInfo از site-key.js میاد.
// fwT/fwSetCurrentLang/fwApplyTranslations/fwFormatBytes از i18n.js میان.

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

function getCurrentTabUrl() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      resolve(tab ? tab.url || null : null);
    });
  });
}

function isEnabledForSite(settings, siteKey) {
  if (siteKey && Object.prototype.hasOwnProperty.call(settings.siteOverrides, siteKey)) {
    return settings.siteOverrides[siteKey];
  }
  return !!settings.enabledByDefault;
}

function siteDisplayLabel(siteInfo) {
  if (!siteInfo.supported) return null;
  return siteInfo.key === 'local-files' ? fwT('localFilesLabel') : siteInfo.label;
}

(async function init() {
  const globalToggle = document.getElementById('globalToggle');
  const statusDot = document.getElementById('statusDot');
  const siteNameEl = document.getElementById('siteName');
  const btnSiteOn = document.getElementById('btnSiteOn');
  const btnSiteOff = document.getElementById('btnSiteOff');
  const btnSiteDefault = document.getElementById('btnSiteDefault');
  const openOptions = document.getElementById('openOptions');
  const langButtons = document.querySelectorAll('.lang-btn');

  const modeImageRadio = document.getElementById('modeImage');
  const modeVideoRadio = document.getElementById('modeVideo');
  const videoInput = document.getElementById('videoInput');
  const videoInfo = document.getElementById('videoInfo');
  const imageInput = document.getElementById('imageInput');
  const imageInfo = document.getElementById('imageInfo');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const saveStatusEl = document.getElementById('saveStatus');

  let settings = await getSettings();
  const tabUrl = await getCurrentTabUrl();
  const siteInfo = getSiteInfo(tabUrl);

  fwSetCurrentLang(settings.language);

  let flashTimer = null;
  function flashSaveStatus() {
    saveStatusEl.textContent = fwT('statusSaved');
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      saveStatusEl.textContent = '';
    }, 1200);
  }

  async function updateFileInfo(kind) {
    const record = await loadMediaRecord(kind);
    const infoEl = kind === 'image' ? imageInfo : videoInfo;
    infoEl.textContent = record
      ? `${record.name || fwT('defaultFileName')} (${fwFormatBytes(record.size)})`
      : fwT('fileNotSelected');
  }

  function renderPlayPause() {
    const isVideoMode = settings.mode === 'video';
    playPauseBtn.disabled = !isVideoMode;
    playPauseBtn.textContent = settings.paused ? fwT('play') : fwT('pause');
    playPauseBtn.classList.toggle('playing', !settings.paused);
  }

  function renderSiteStatus() {
    const enabled = siteInfo.supported ? isEnabledForSite(settings, siteInfo.key) : false;
    statusDot.classList.toggle('active', enabled);

    const override = siteInfo.supported ? settings.siteOverrides[siteInfo.key] : undefined;
    btnSiteOn.classList.toggle('selected', override === true);
    btnSiteOff.classList.toggle('selected', override === false);
    btnSiteDefault.classList.toggle('selected', override === undefined);

    const disableSiteButtons = !siteInfo.supported;
    [btnSiteOn, btnSiteOff, btnSiteDefault].forEach((b) => (b.disabled = disableSiteButtons));
  }

  function render() {
    globalToggle.checked = !!settings.enabledByDefault;
    siteNameEl.textContent = siteDisplayLabel(siteInfo) || fwT('unsupportedPage');
    modeImageRadio.checked = settings.mode !== 'video';
    modeVideoRadio.checked = settings.mode === 'video';
    renderPlayPause();
    renderSiteStatus();
  }

  async function renderAll() {
    fwApplyTranslations();
    await updateFileInfo('image');
    await updateFileInfo('video');
    render();
  }

  await renderAll();

  langButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const lang = btn.getAttribute('data-lang');
      settings.language = lang;
      fwSetCurrentLang(lang);
      await saveSettings(settings);
      await renderAll();
    });
  });

  globalToggle.addEventListener('change', async () => {
    settings.enabledByDefault = globalToggle.checked;
    await saveSettings(settings);
    renderSiteStatus();
    flashSaveStatus();
  });

  btnSiteOn.addEventListener('click', async () => {
    if (!siteInfo.supported) return;
    settings.siteOverrides[siteInfo.key] = true;
    await saveSettings(settings);
    renderSiteStatus();
    flashSaveStatus();
  });

  btnSiteOff.addEventListener('click', async () => {
    if (!siteInfo.supported) return;
    settings.siteOverrides[siteInfo.key] = false;
    await saveSettings(settings);
    renderSiteStatus();
    flashSaveStatus();
  });

  btnSiteDefault.addEventListener('click', async () => {
    if (!siteInfo.supported) return;
    delete settings.siteOverrides[siteInfo.key];
    await saveSettings(settings);
    renderSiteStatus();
    flashSaveStatus();
  });

  modeImageRadio.addEventListener('change', async () => {
    if (!modeImageRadio.checked) return;
    settings.mode = 'image';
    await saveSettings(settings);
    renderPlayPause();
    flashSaveStatus();
  });

  modeVideoRadio.addEventListener('change', async () => {
    if (!modeVideoRadio.checked) return;
    settings.mode = 'video';
    await saveSettings(settings);
    renderPlayPause();
    flashSaveStatus();
  });

  videoInput.addEventListener('change', async () => {
    const file = videoInput.files[0];
    if (!file) return;
    await saveMediaRecord('video', { blob: file, name: file.name, size: file.size });
    await updateFileInfo('video');
    flashSaveStatus();
  });

  imageInput.addEventListener('change', async () => {
    const file = imageInput.files[0];
    if (!file) return;
    await saveMediaRecord('image', { blob: file, name: file.name, size: file.size });
    await updateFileInfo('image');
    flashSaveStatus();
  });

  playPauseBtn.addEventListener('click', async () => {
    settings.paused = !settings.paused;
    await saveSettings(settings);
    renderPlayPause();
    flashSaveStatus();
  });

  openOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
})();
