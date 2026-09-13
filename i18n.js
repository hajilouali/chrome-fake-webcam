// سیستم چندزبانه‌ی سبک افزونه (فارسی/انگلیسی). این فایل قبل از popup.js/options.js
// و همچنین (در دنیای ایزوله) قبل از content-bridge.js لود می‌شه.
// Lightweight bilingual (Persian/English) system for the extension. Loaded before
// popup.js/options.js, and also (in the isolated world) before content-bridge.js.

const FAKE_WEBCAM_TRANSLATIONS = {
  en: {
    popupHeading: 'Fake Webcam',
    unsupportedPage: "This page isn't supported",
    enabledByDefaultAll: 'Enabled by default (all sites)',
    forThisSite: 'For this site:',
    siteOn: 'On',
    siteOff: 'Off',
    siteDefault: 'Default',
    modeImage: 'Photo',
    modeVideo: 'Video',
    videoFileTitleShort: 'Video file (for camera mode)',
    imageFileTitle: 'Photo file',
    play: '▶ Play',
    pause: '⏸ Pause',
    openOptions: 'Zoom / Pan',
    fileNotSelected: 'No file selected',
    defaultFileName: 'file',
    statusSaved: 'Saved',
    localFilesLabel: 'Local files (file://)',
    enabledLabel: 'Enabled',
    disabledLabel: 'Disabled',
    unitBytes: 'bytes',
    unitKB: 'KB',
    unitMB: 'MB',
    unitGB: 'GB',

    optionsTitle: 'Fake Webcam Settings',
    step1Title: '1. Choose a file',
    videoFileTitle: 'Video file',
    removePhoto: 'Remove photo',
    removeVideo: 'Remove video',
    step2Title: '2. Preview, zoom & pan',
    dragHint: 'Click and drag on the preview to pan. Use the slider below to zoom.',
    zoomLabel: 'Zoom',
    resetView: 'Reset zoom/pan',
    step3Title: '3. Activation',
    enabledByDefaultAllSites: 'Enabled by default for all sites',
    siteExceptions: 'Site exceptions',
    siteExceptionsHint: 'Sites with a status different from the default.',
    tableSite: 'Site',
    tableStatus: 'Status',
    remove: 'Remove',
    noOverrides: 'No exceptions yet. Use the extension popup on any site to change its status.',
    previewNoFile: 'No file selected for this mode',

    canvasNoFile: 'No file configured in the extension settings',
    canvasLoadingVideo: 'Loading video...',
  },
  fa: {
    popupHeading: 'جایگزین وبکم',
    unsupportedPage: 'این صفحه پشتیبانی نمی‌شود',
    enabledByDefaultAll: 'فعال به‌صورت پیش‌فرض (همه سایت‌ها)',
    forThisSite: 'برای همین سایت:',
    siteOn: 'فعال',
    siteOff: 'غیرفعال',
    siteDefault: 'پیش‌فرض',
    modeImage: 'عکس',
    modeVideo: 'ویدیو',
    videoFileTitleShort: 'فایل ویدیو (برای حالت دوربین)',
    imageFileTitle: 'فایل عکس',
    play: '▶ پخش',
    pause: '⏸ توقف',
    openOptions: 'زوم / جابجایی تصویر',
    fileNotSelected: 'فایلی انتخاب نشده',
    defaultFileName: 'فایل',
    statusSaved: 'ذخیره شد',
    localFilesLabel: 'فایل‌های محلی (file://)',
    enabledLabel: 'فعال',
    disabledLabel: 'غیرفعال',
    unitBytes: 'بایت',
    unitKB: 'کیلوبایت',
    unitMB: 'مگابایت',
    unitGB: 'گیگابایت',

    optionsTitle: 'تنظیمات جایگزین وبکم',
    step1Title: '۱. انتخاب فایل',
    videoFileTitle: 'فایل ویدیو',
    removePhoto: 'حذف عکس',
    removeVideo: 'حذف ویدیو',
    step2Title: '۲. پیش‌نمایش، زوم و جابجایی',
    dragHint: 'برای جابجایی تصویر، روی پیش‌نمایش کلیک نگه‌دار و بکش. اسلایدر زیر برای زوم است.',
    zoomLabel: 'زوم',
    resetView: 'بازنشانی زوم/جابجایی',
    step3Title: '۳. فعال‌سازی',
    enabledByDefaultAllSites: 'فعال به‌صورت پیش‌فرض برای همه‌ی سایت‌ها',
    siteExceptions: 'استثناهای سایت',
    siteExceptionsHint: 'سایت‌هایی که وضعیت متفاوتی از حالت پیش‌فرض دارند.',
    tableSite: 'سایت',
    tableStatus: 'وضعیت',
    remove: 'حذف',
    noOverrides: 'در حال حاضر استثنایی ثبت نشده. از پاپ‌آپ افزونه روی هر سایت می‌توانید وضعیت آن را تغییر دهید.',
    previewNoFile: 'فایلی برای این حالت انتخاب نشده',

    canvasNoFile: 'فایلی در تنظیمات افزونه انتخاب نشده',
    canvasLoadingVideo: 'در حال بارگذاری ویدیو...',
  },
};

let fwCurrentLang = 'fa';

function fwSetCurrentLang(lang) {
  fwCurrentLang = lang === 'en' ? 'en' : 'fa';
}

function fwT(key) {
  const dict = FAKE_WEBCAM_TRANSLATIONS[fwCurrentLang] || FAKE_WEBCAM_TRANSLATIONS.fa;
  return dict[key] !== undefined ? dict[key] : key;
}

// المنت‌های [data-i18n]/[data-i18n-placeholder] رو با متن زبان فعلی پر می‌کنه و
// جهت صفحه (rtl/ltr) رو هم بر اساس زبان تنظیم می‌کنه. برای صفحات popup/options.
function fwApplyTranslations(root) {
  const scope = root || document;
  document.documentElement.lang = fwCurrentLang;
  document.documentElement.dir = fwCurrentLang === 'fa' ? 'rtl' : 'ltr';

  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = fwT(el.getAttribute('data-i18n'));
  });
  scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', fwT(el.getAttribute('data-i18n-placeholder')));
  });

  scope.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === fwCurrentLang);
  });
}

function fwFormatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  const units = [fwT('unitBytes'), fwT('unitKB'), fwT('unitMB'), fwT('unitGB')];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}
