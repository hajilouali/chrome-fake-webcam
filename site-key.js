// این فایل هم داخل content-bridge.js (content script، دنیای ایزوله) و هم داخل
// popup.js لود می‌شه تا هر دو دقیقاً یک "کلید سایت" یکسان برای هر URL بسازن؛
// اگه این دو جا با هم فرق کنن، فعال/غیرفعال‌کردن از پاپ‌آپ روی صفحه واقعی اثر نمی‌کنه.
const FAKE_WEBCAM_UNSUPPORTED_PROTOCOLS = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'devtools:'];

function getSiteInfo(url) {
  if (!url) return { key: null, label: null, supported: false };

  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return { key: null, label: null, supported: false };
  }

  if (FAKE_WEBCAM_UNSUPPORTED_PROTOCOLS.includes(parsed.protocol)) {
    return { key: null, label: null, supported: false };
  }

  // برای file:// آدرس، hostname همیشه خالیه؛ همه‌ی فایل‌های محلی رو یک "سایت" حساب می‌کنیم.
  // برچسبِ نمایشی این حالت (چندزبانه) رو خودِ کد نمایش‌دهنده با کلید 'local-files' می‌سازه.
  if (parsed.protocol === 'file:') {
    return { key: 'local-files', label: null, supported: true };
  }

  if (!parsed.hostname) {
    return { key: null, label: null, supported: false };
  }

  return { key: parsed.hostname, label: parsed.hostname, supported: true };
}
