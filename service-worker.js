// ソノサポ サービスワーカー
// ・「ホーム画面に追加」したときにアプリとして動くために必要なファイル
// ・ふだんは常にネットから最新を読み込み、電波がないときだけ保存しておいた画面を使う
// ・画面を直して公開したら、下の VERSION の数字を1つ上げると、古い保存分が確実に消えます
const VERSION = 'sonosapo-v1';
const SHELL = [
  './', './index.html', './manabu.html', './calendar.html', './chat.html', './launch.html', './account.html',
  './common.css', './common.js', './config.js', './manifest.json',
  './assets/doctor.webp', './assets/icon-192.png', './assets/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // 自分のサイトの GET だけを扱う（Supabase などへの通信には触らない）
  if(req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if(res && res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
