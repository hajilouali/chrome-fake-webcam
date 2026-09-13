// این اسکریپت داخل "دنیای اصلی" صفحه اجرا می‌شه (world: MAIN) یعنی دقیقاً همون
// چیزی رو می‌بینه که خود سایت می‌بینه. کارش عوض‌کردن getUserMedia/enumerateDevices هست
// تا به‌جای وبکم واقعی، یک ویدیو/عکس روی canvas رو به‌عنوان stream برگردونه.
(function () {
  if (window.__fakeWebcamInjected) return;
  window.__fakeWebcamInjected = true;

  const FAKE_DEVICE_ID = 'fake-webcam-virtual-camera-0001';
  const FAKE_GROUP_ID = 'fake-webcam-virtual-group-0001';

  const md = navigator.mediaDevices;
  const originalGetUserMedia = md.getUserMedia.bind(md);
  const originalEnumerateDevices = md.enumerateDevices.bind(md);

  let bridgeRequestId = 0;
  const pendingResolvers = new Map();

  // درخواست داده (تنظیمات + فایل رسانه) از content-bridge.js که در دنیای ایزوله
  // اجرا می‌شه و به chrome.storage / background دسترسی داره.
  function requestFromBridge() {
    return new Promise((resolve) => {
      const id = ++bridgeRequestId;
      pendingResolvers.set(id, resolve);
      window.postMessage({ __fakeWebcam: 'request', id }, '*');
    });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    const data = event.data;

    if (data.__fakeWebcam === 'response' && pendingResolvers.has(data.id)) {
      const resolve = pendingResolvers.get(data.id);
      pendingResolvers.delete(data.id);
      resolve(data.payload);
      return;
    }

    if (data.__fakeWebcam === 'live-update') {
      activeDrawStates.forEach((state) => {
        state.zoom = data.settings.zoom;
        state.panX = data.settings.panX;
        state.panY = data.settings.panY;

        // پلی/پاز زنده‌ی ویدیو حتی وقتی همین الان داره برای یک تماس فعال پخش می‌شه.
        if (state.isVideo && state.sourceEl && typeof data.settings.paused === 'boolean') {
          const videoPaused = data.settings.paused;
          if (videoPaused && !state.sourceEl.paused) {
            state.sourceEl.pause();
          } else if (!videoPaused && state.sourceEl.paused) {
            state.sourceEl.play().catch(() => {});
          }
        }
      });
    }
  });

  const activeDrawStates = new Set();

  function computeCrop(sw, sh, zoom, panX, panY) {
    const z = Math.min(Math.max(zoom || 1, 1), 8);
    const cropW = sw / z;
    const cropH = sh / z;
    const maxX = Math.max(sw - cropW, 0);
    const maxY = Math.max(sh - cropH, 0);
    const cx = Math.min(Math.max(panX ?? 0.5, 0), 1) * maxX;
    const cy = Math.min(Math.max(panY ?? 0.5, 0), 1) * maxY;
    return { sx: cx, sy: cy, sw: cropW, sh: cropH };
  }

  async function buildFakeVideoTrack(videoConstraints, mediaInfo, settings, strings) {
    const noFileText = (strings && strings.canvasNoFile) || 'No file configured';
    const loadingText = (strings && strings.canvasLoadingVideo) || 'Loading video...';

    const width =
      (videoConstraints && videoConstraints.width && (videoConstraints.width.ideal || videoConstraints.width)) ||
      1280;
    const height =
      (videoConstraints && videoConstraints.height && (videoConstraints.height.ideal || videoConstraints.height)) ||
      720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });

    let sourceEl = null;
    let fakeAudioTrack = null;
    const hasSource = !!mediaInfo.url;
    const isVideo = mediaInfo.kind === 'video';

    // اگه هیچ فایلی تنظیم نشده باشه، اصلاً video/img نمی‌سازیم (تا یه درخواست
    // بی‌مورد برای src خالی نره) و فقط یک فریم خاکستری با متن راهنما نشون می‌دیم
    // به‌جای شکست‌خوردن کامل درخواست.
    if (hasSource && isVideo) {
      sourceEl = document.createElement('video');
      sourceEl.loop = true;
      sourceEl.muted = true;
      sourceEl.playsInline = true;
      sourceEl.autoplay = true;
      sourceEl.addEventListener('error', () => {
        const err = sourceEl.error;
        console.error(
          '[Fake Webcam] بارگذاری فایل ویدیو با خطا مواجه شد (کد ' + (err && err.code) + '). ' +
            'اگه سایت CSP سخت‌گیرانه‌ای روی media-src داره یا فرمت ویدیو پشتیبانی نمی‌شه، همین‌جا مشخص می‌شه.',
          err
        );
      });
      sourceEl.src = mediaInfo.url;
      try {
        await sourceEl.play();
        if (settings.paused) sourceEl.pause();
      } catch (e) {
        console.error('[Fake Webcam] پخش ویدیو با خطا مواجه شد؛ فریم‌های بعدی هم امتحان می‌شن:', e);
      }

      // اگه فایل ویدیو خودش صدا داره، همون رو به‌عنوان میکروفون هم برمی‌گردونیم
      // (به‌جای صدای واقعی)؛ muted فقط پخش از بلندگو رو خاموش می‌کنه، captureStream
      // صدای واقعیِ فایل رو همچنان می‌گیره.
      if (typeof sourceEl.captureStream === 'function') {
        try {
          const sourceStream = sourceEl.captureStream();
          const [audioTrack] = sourceStream.getAudioTracks();
          if (audioTrack) fakeAudioTrack = audioTrack;
        } catch (e) {}
      }
    } else if (hasSource) {
      sourceEl = new Image();
      sourceEl.src = mediaInfo.url;
      await new Promise((res) => {
        sourceEl.onload = res;
        sourceEl.onerror = res;
      });
    }

    const state = {
      zoom: settings.zoom || 1,
      panX: settings.panX ?? 0.5,
      panY: settings.panY ?? 0.5,
      running: true,
      isVideo,
      sourceEl,
    };
    activeDrawStates.add(state);

    function drawPlaceholder(message) {
      ctx.fillStyle = '#202124';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#9aa0a6';
      ctx.font = `${Math.round(height / 18)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(message, width / 2, height / 2);
    }

    // HTMLMediaElement.readyState >= 2 یعنی HAVE_CURRENT_DATA؛ زودتر از این، خودِ
    // drawImage روی ویدیو استثنا پرتاب می‌کنه (InvalidStateError) و اگه چک نکنیم،
    // همون یک خطا کل حلقه‌ی rAF رو برای همیشه متوقف می‌کنه.
    function draw() {
      if (!state.running) return;

      if (!hasSource) {
        drawPlaceholder(noFileText);
        requestAnimationFrame(draw);
        return;
      }

      if (isVideo && sourceEl.readyState < 2) {
        drawPlaceholder(loadingText);
        requestAnimationFrame(draw);
        return;
      }

      const sw = isVideo ? sourceEl.videoWidth : sourceEl.naturalWidth;
      const sh = isVideo ? sourceEl.videoHeight : sourceEl.naturalHeight;

      if (sw && sh) {
        try {
          const { sx, sy, sw: cw, sh: ch } = computeCrop(sw, sh, state.zoom, state.panX, state.panY);
          ctx.drawImage(sourceEl, sx, sy, cw, ch, 0, 0, width, height);
        } catch (e) {
          // این فریم آماده نبود؛ حلقه رو نگه می‌داریم تا فریم بعدی دوباره امتحان بشه
        }
      }

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    const stream = canvas.captureStream(30);
    const track = stream.getVideoTracks()[0];

    try {
      Object.defineProperty(track, 'label', { value: 'Virtual Camera', configurable: true });
    } catch (e) {}

    const originalStop = track.stop.bind(track);
    track.stop = () => {
      state.running = false;
      activeDrawStates.delete(state);
      try {
        if (sourceEl && sourceEl.pause) sourceEl.pause();
        if (mediaInfo.url) URL.revokeObjectURL(mediaInfo.url);
      } catch (e) {}
      originalStop();
    };

    return { videoTrack: track, audioTrack: fakeAudioTrack };
  }

  md.getUserMedia = async function (constraints) {
    const wantsVideo = !!(constraints && constraints.video);
    if (!wantsVideo) {
      return originalGetUserMedia(constraints);
    }

    const bridgeData = await requestFromBridge();

    if (!bridgeData || !bridgeData.enabled) {
      return originalGetUserMedia(constraints);
    }

    const videoConstraints = typeof constraints.video === 'object' ? constraints.video : {};
    const { videoTrack, audioTrack: fakeAudioTrack } = await buildFakeVideoTrack(
      videoConstraints,
      bridgeData.media || {},
      bridgeData.settings || {},
      bridgeData.strings || {}
    );

    const tracks = [videoTrack];

    if (constraints.audio) {
      if (fakeAudioTrack) {
        // فایل ویدیوی جایگزین خودش صدا داره؛ همون رو به‌جای میکروفون واقعی می‌فرستیم.
        tracks.push(fakeAudioTrack);
      } else {
        try {
          const audioStream = await originalGetUserMedia({ audio: constraints.audio });
          audioStream.getAudioTracks().forEach((t) => tracks.push(t));
        } catch (e) {
          // اگه میکروفون رد شد، فقط ویدیوی فیک رو برمی‌گردونیم
        }
      }
    } else if (fakeAudioTrack) {
      // سایت صدا درخواست نداده؛ ترک صدای بلااستفاده رو آزاد می‌کنیم
      fakeAudioTrack.stop();
    }

    return new MediaStream(tracks);
  };

  md.enumerateDevices = async function () {
    const devices = await originalEnumerateDevices();
    const bridgeData = await requestFromBridge();

    if (!bridgeData || !bridgeData.enabled) return devices;

    const fakeDevice = {
      deviceId: FAKE_DEVICE_ID,
      groupId: FAKE_GROUP_ID,
      kind: 'videoinput',
      label: 'Virtual Camera',
      toJSON() {
        return { deviceId: this.deviceId, groupId: this.groupId, kind: this.kind, label: this.label };
      },
    };

    // وقتی فعاله، دوربین‌های واقعی رو از لیست حذف می‌کنیم تا هم UI سایت با
    // چیزی که واقعاً پخش می‌شه (ویدیوی فیک) هم‌خوان باشه و هم دوربین واقعی لو نره.
    const nonVideoDevices = devices.filter((d) => d.kind !== 'videoinput');
    return nonVideoDevices.concat([fakeDevice]);
  };

  if (navigator.getUserMedia) {
    const legacyOriginal = navigator.getUserMedia.bind(navigator);
    navigator.getUserMedia = function (constraints, onSuccess, onError) {
      md.getUserMedia(constraints).then(onSuccess, onError || (() => {}));
      void legacyOriginal;
    };
  }
})();
