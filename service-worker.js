// ソノサポ サービスワーカー
// ・「ホーム画面に追加」したときにアプリとして動くために必要なファイル
// ・画面（html・css・js）は、ふだんは常にネットから最新を読み込み、電波がないときだけ保存しておいたものを使う
// ・画像（assets の中）は、保存しておいたものをすぐ使う（画面切り替えの車がすぐ出るように）
// ・画面を直して公開したら、下の VERSION の数字を1つ上げると、古い保存分が確実に消えます
const VERSION = 'sonosapo-v7';
const SHELL = [
  './', './index.html', './manabu.html', './calendar.html', './chat.html', './launch.html', './account.html', './nintei.html', './legal.html',
  './common.css', './common.js', './config.js', './manifest.json', './vendor/supabase-js-2.117.3.js',
  './assets/doctor.webp', './assets/car.webp', './assets/car-glow.webp', './assets/car-city.webp', './assets/icon-192.png', './assets/apple-touch-icon.png'
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
  // 画像は保存分を優先（VERSION を上げると入れ替わる）
  if(url.pathname.includes('/assets/') || url.pathname.includes('/vendor/')){
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if(res && res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  e.respondWith(
    fetch(req).then(res => {
      if(res && res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});

// ---------------- プッシュ通知 ----------------
// Supabase の Edge Function（send-push）から届いた通知を、ロック画面に表示する
self.addEventListener('push', e => {
  let d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(_){ d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'ソノサポ', {
    body: d.body || '', icon: 'assets/icon-192.png', badge: 'assets/icon-192.png',
    tag: d.tag || undefined, data: { url: d.url || 'index.html' },
  }));
});
// 通知を押したら、その画面を開く
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || 'index.html', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for(const c of list){ if(c.url.startsWith(self.registration.scope) && 'focus' in c){ return c.focus().then(w => (w && 'navigate' in w) ? w.navigate(url) : clients.openWindow(url)); } }
    return clients.openWindow(url);
  }));
});
