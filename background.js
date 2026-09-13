// Service worker: فقط برای پاسخ‌دادن به content script هایی که داخل صفحات واقعی
// اجرا می‌شن و نمی‌تونن مستقیم به IndexedDB خود افزونه دسترسی داشته باشن.
// (صفحات options/popup مستقیماً با IndexedDB کار می‌کنن چون هم‌مبدأ این service worker هستن.)
importScripts('media-store.js');

// بعضی فایل‌های ویدیویی (مخصوصاً بسته به سیستم‌عامل/مرورگر) موقع انتخاب از
// input[type=file]، blob.type خالی برمی‌گردونن. اگه اون خالی رو مستقیم بذاریم
// توی data URL، مرورگر با خطای "content type" پخشش رو رد می‌کنه. برای همین وقتی
// blob.type خالیه، از روی پسوند فایل حدس می‌زنیم.
const EXTENSION_MIME_MAP = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  '3gp': 'video/3gpp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

function guessMimeType(blob, filename) {
  if (blob.type) return blob.type;
  const ext = (filename || '').split('.').pop().toLowerCase();
  return EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
}

// chrome.runtime.sendMessage یک Blob واقعی رو سالم منتقل نمی‌کنه (سمت گیرنده یه
// شیء خالی/غیرقابل‌استفاده می‌شه و URL.createObjectURL روش خطا می‌ده). برای همین
// این‌جا Blob رو به data URL (base64) تبدیل می‌کنیم که یک رشته‌ی ساده‌ست و بدون
// مشکل منتقل می‌شه.
async function blobToDataUrl(blob, filename) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return `data:${guessMimeType(blob, filename)};base64,${btoa(binary)}`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'GET_MEDIA') {
    loadMediaRecord(message.kind)
      .then(async (record) => {
        if (!record || !record.blob) {
          sendResponse(null);
          return;
        }
        try {
          const dataUrl = await blobToDataUrl(record.blob, record.name);
          sendResponse({ name: record.name, size: record.size, dataUrl });
        } catch (e) {
          sendResponse(null);
        }
      })
      .catch(() => sendResponse(null));
    return true; // async
  }

  return false;
});
