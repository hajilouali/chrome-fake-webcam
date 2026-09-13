// این فایل مشترکه بین background.js (با importScripts) و صفحات options/popup
// (با <script src>) چون هر سه هم‌مبدأ (chrome-extension://<id>) هستن و یک
// IndexedDB مشترک می‌بینن. content-bridge.js (که داخل صفحات وب اجرا می‌شه) از
// این فایل استفاده نمی‌کنه چون IndexedDB اون به مبدأ خودِ سایت می‌خوره، نه افزونه.

const DB_NAME = 'fakeWebcamDB';
const STORE_NAME = 'media';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveMediaRecord(kind, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record, `current_${kind}`);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function loadMediaRecord(kind) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(`current_${kind}`);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteMediaRecord(kind) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(`current_${kind}`);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
