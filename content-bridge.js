// این اسکریپت در دنیای ایزوله (isolated world) اجرا می‌شه، یعنی به chrome.storage
// و chrome.runtime دسترسی داره ولی مستقیماً با متغیرهای صفحه در ارتباط نیست.
// نقشش پل‌زدن بین inject.js (دنیای اصلی) و باقی افزونه‌ست.
(function () {
  const DEFAULT_SETTINGS = {
    enabledByDefault: false,
    siteOverrides: {},
    mode: 'image', // 'image' | 'video'
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

  function isEnabledForSite(settings, siteKey) {
    if (Object.prototype.hasOwnProperty.call(settings.siteOverrides || {}, siteKey)) {
      return !!settings.siteOverrides[siteKey];
    }
    return !!settings.enabledByDefault;
  }

  function getMedia(kind) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_MEDIA', kind }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response);
      });
    });
  }

  async function buildState() {
    const settings = await getSettings();
    fwSetCurrentLang(settings.language);
    const siteInfo = getSiteInfo(location.href);
    const enabled = siteInfo.supported && isEnabledForSite(settings, siteInfo.key);

    let media = { kind: settings.mode, url: null };

    if (enabled) {
      const stored = await getMedia(settings.mode);
      if (stored && stored.dataUrl) {
        media.url = stored.dataUrl;
      }
    }

    return {
      enabled,
      media,
      settings: {
        zoom: settings.zoom,
        panX: settings.panX,
        panY: settings.panY,
        paused: settings.paused,
      },
      // inject.js توی دنیای اصلی اجرا می‌شه و به chrome.storage/i18n دسترسی نداره؛
      // برای همین متن‌های آماده‌ی ترجمه‌شده رو خودمون این‌جا می‌سازیم و می‌فرستیم.
      strings: {
        canvasNoFile: fwT('canvasNoFile'),
        canvasLoadingVideo: fwT('canvasLoadingVideo'),
      },
    };
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.__fakeWebcam !== 'request') return;

    const state = await buildState();
    window.postMessage({ __fakeWebcam: 'response', id: event.data.id, payload: state }, '*');
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.fakeWebcamSettings) return;
    const newVal = changes.fakeWebcamSettings.newValue;
    if (!newVal) return;
    window.postMessage(
      {
        __fakeWebcam: 'live-update',
        settings: { zoom: newVal.zoom, panX: newVal.panX, panY: newVal.panY, paused: newVal.paused },
      },
      '*'
    );
  });
})();
