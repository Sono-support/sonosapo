// ================================================================
// ソノサポ 共通の仕組み（全ページで読み込む）
// ================================================================
//  ・Supabase への接続（sb）
//  ・ログイン状態の確認（SS.boot）
//  ・画面の切り替え演出（多田先生の幕）
//  ・下のタブバー
//  ・小さな道具（文字の安全化、日付、画像の縮小とアップロード など）
// ================================================================
(function(){
  // 読み込み中は中身を隠し、紺色の幕だけ見せる（チラつき防止）
  const root = document.documentElement;
  root.classList.add('ss-boot');
  // iPad をホーム画面から開いたとき：画面のいちばん上は iPadOS が「ぼかし」をかける帯になる。
  // そこに文字が入るとボヤけるので、上の余白を最低64px確保する（CSS の --ss-top）。
  try {
    const ua = navigator.userAgent || '';
    const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = !!navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (isIPad) root.classList.add('ss-ipad');
    if (standalone) root.classList.add('ss-standalone');
  } catch (e) {}
})();

// パスワード再設定メールのリンクから来たかどうか（Supabase がURLを消す前に覚えておく）
const SS_INITIAL_HASH = location.hash + location.search;

const sb = supabase.createClient(window.SS_CONFIG.SUPABASE_URL, window.SS_CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const SS = window.SS = {
  me: null,        // 自分のプロフィール（profiles の行）
  univ: null,      // 自分の大学（universities の行）
  user: null,      // ログイン情報
  myOwned: null,   // 自分の投稿の id（Set）
};

// ---------------- 役割 ----------------
SS.ROLE_LABEL = { member: '部員', reviewer: '確認者', admin: '管理者' };
SS.YEARS = [
  [1,'1年'],[2,'2年'],[3,'3年'],[4,'4年'],[5,'5年'],[6,'6年'],[7,'研修医'],[8,'先生'],[9,'その他']
];
SS.yearLabel = y => (SS.YEARS.find(x => x[0] === y) || [0,''])[1];
SS.isAdmin = () => !!(SS.me && SS.me.role === 'admin');
SS.isStaff = () => !!(SS.me && (SS.me.role === 'admin' || SS.me.role === 'reviewer'));
SS.univLabel = () => {
  if(!SS.univ) return SS.isAdmin() ? '全国（管理者）' : '';
  return SS.univ.name + (SS.univ.group_name ? '　' + SS.univ.group_name : '');
};

// ---------------- 小さな道具 ----------------
SS.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
SS.$ = (sel, root) => (root || document).querySelector(sel);
SS.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
SS.pad = n => String(n).padStart(2, '0');
SS.fmtDate = iso => { if(!iso) return ''; const d = new Date(iso); return d.getFullYear() + '/' + SS.pad(d.getMonth()+1) + '/' + SS.pad(d.getDate()); };
SS.fmtSize = b => !b ? '' : (b < 1048576 ? Math.round(b/1024) + ' KB' : (b/1048576).toFixed(1) + ' MB');
SS.ago = iso => {
  if(!iso) return '';
  const d = new Date(iso), m = Math.floor((Date.now() - d) / 60000);
  if(m < 1) return 'たった今';
  if(m < 60) return m + '分前';
  if(m < 1440) return Math.floor(m/60) + '時間前';
  if(m < 10080) return Math.floor(m/1440) + '日前';
  return (d.getMonth()+1) + '/' + d.getDate();
};
SS.linkify = s => SS.esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--orange-light);word-break:break-all;">$1</a>');

// Supabase の英語のエラーを日本語に
SS.friendly = (e) => {
  const m = String((e && (e.message || e.error_description)) || e || '');
  if(/anonymous sign-ins are disabled/i.test(m)) return 'いまは新しい参加を受け付けられない設定になっています（管理者向け：Supabase で「Anonymous sign-ins」をオンにしてください）。';
  if(/invalid login credentials/i.test(m)) return 'メールアドレスかパスワードが違います。';
  if(/email not confirmed/i.test(m)) return 'メールアドレスの確認がまだです。届いたメールのリンクを開いてください。';
  if(/row-level security|violates|permission|not authorized/i.test(m)) return 'この操作をする権限がありません。';
  if(/failed to fetch|network|load failed/i.test(m)) return '通信に失敗しました。電波のいい場所でもう一度お試しください。';
  if(/jwt|token|session/i.test(m)) return 'ログイン情報が古くなっています。アプリを開き直してください。';
  if(/payload too large|maximum allowed size|413/i.test(m)) return 'ファイルが大きすぎます。';
  if(/rate limit/i.test(m)) return '短い時間に操作が集中しました。少し待ってからお試しください。';
  return m || 'うまくいきませんでした。';
};

// 画面下にひとことメッセージ
SS.toast = (text) => {
  let t = document.getElementById('ss-toast');
  if(!t){ t = document.createElement('div'); t.id = 'ss-toast'; document.body.appendChild(t); }
  t.textContent = text; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400);
};
SS.msg = (el, text, kind) => {
  if(typeof el === 'string') el = document.getElementById(el);
  if(!el) return;
  if(!text){ el.className = 'msg'; el.textContent = ''; return; }
  el.className = 'msg show ' + (kind || 'ng'); el.textContent = text;
};

// ---------------- シート（下から出る画面） ----------------
SS.openSheet = id => {
  const el = document.getElementById(id); if(!el) return;
  el.classList.add('open');
  const b = el.querySelector('.sheet-body'); if(b) b.scrollTop = 0;
  document.body.style.overflow = 'hidden';
};
SS.closeSheet = id => {
  const el = document.getElementById(id); if(el) el.classList.remove('open');
  if(!document.querySelector('.sheet-overlay.open')) document.body.style.overflow = '';
};
document.addEventListener('click', ev => {
  const ov = ev.target.classList && ev.target.classList.contains('sheet-overlay') ? ev.target : null;
  if(ov && !ov.dataset.sticky) SS.closeSheet(ov.id);
  const closer = ev.target.closest && ev.target.closest('[data-close]');
  if(closer) SS.closeSheet(closer.getAttribute('data-close'));
});

// ---------------- 画像 ----------------
SS.lightbox = src => {
  const lb = document.createElement('div'); lb.className = 'lightbox';
  lb.innerHTML = '<img alt="">'; lb.querySelector('img').src = src;
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
};
// スマホの写真は大きいので、長い辺1600pxのJPEGに縮める（位置情報などの付加情報も消える）
SS.shrinkImage = (file, max = 1600) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob')), 'image/jpeg', 0.85);
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('この画像は読み込めませんでした')); };
  img.src = url;
});
SS.randName = ext => (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2))) + '.' + ext;
// 画像をまとめてアップロードして、保存場所の一覧を返す（失敗したら途中のものを消す）
SS.uploadImages = async (blobs, bucket = 'posts') => {
  const paths = [];
  try{
    for(const b of blobs){
      const path = new Date().toISOString().slice(0,7) + '/' + SS.randName('jpg');
      const { error } = await sb.storage.from(bucket).upload(path, b, { contentType: 'image/jpeg', upsert: false });
      if(error) throw error;
      paths.push(path);
    }
    return paths;
  }catch(e){
    if(paths.length) await sb.storage.from(bucket).remove(paths);
    throw e;
  }
};
const _urlCache = {};
SS.signedUrls = async (paths, bucket = 'posts') => {
  const need = [...new Set(paths)].filter(p => p && !_urlCache[bucket + p]);
  if(need.length){
    const { data } = await sb.storage.from(bucket).createSignedUrls(need, 3600 * 6);
    (data || []).forEach(x => { if(x && x.signedUrl) _urlCache[bucket + x.path] = x.signedUrl; });
  }
  const out = {}; paths.forEach(p => { if(_urlCache[bucket + p]) out[p] = _urlCache[bucket + p]; });
  return out;
};
SS.thumbsHtml = (paths, urlMap) => {
  const imgs = (paths || []).map(p => urlMap[p] ? `<img loading="lazy" alt="添付画像" src="${SS.esc(urlMap[p])}" data-full="${SS.esc(urlMap[p])}">` : '').join('');
  return imgs ? `<div class="thumbs">${imgs}</div>` : '';
};
document.addEventListener('click', ev => {
  const im = ev.target.closest && ev.target.closest('.thumbs img');
  if(im){ ev.stopPropagation(); SS.lightbox(im.dataset.full || im.src); }
});

// 画像を選ぶ部品（最大 max 枚）。picker.get() で縮小済みの画像を返す
SS.imagePicker = (box, max = 4) => {
  let items = [];
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.className = 'file-hidden';
  box.after(input);
  function draw(){
    box.innerHTML = items.map((it, i) => `<div class="img-pick"><img src="${it.url}" alt=""><button type="button" data-i="${i}" aria-label="外す">✕</button></div>`).join('')
      + (items.length < max ? `<button type="button" class="img-add"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>画像</button>` : '');
    box.querySelectorAll('.img-pick button').forEach(b => b.onclick = () => { URL.revokeObjectURL(items[+b.dataset.i].url); items.splice(+b.dataset.i, 1); draw(); box.dispatchEvent(new Event('change')); });
    const add = box.querySelector('.img-add'); if(add) add.onclick = () => input.click();
  }
  input.addEventListener('change', async () => {
    const files = Array.from(input.files || []); input.value = '';
    for(const f of files){
      if(items.length >= max){ SS.toast('画像は' + max + '枚までです'); break; }
      if(!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)){ SS.toast('画像ファイルを選んでください'); continue; }
      try{ const blob = await SS.shrinkImage(f); items.push({ blob, url: URL.createObjectURL(blob) }); }
      catch(e){ SS.toast('この画像は読み込めませんでした（HEICは「互換性優先」で撮った写真をお使いください）'); }
    }
    draw(); box.dispatchEvent(new Event('change'));
  });
  draw();
  return {
    get: () => items.map(i => i.blob),
    count: () => items.length,
    clear: () => { items.forEach(i => URL.revokeObjectURL(i.url)); items = []; draw(); }
  };
};

// 「参考になった」
SS.likes = {
  async load(ids){
    const out = {}; ids.forEach(id => out[id] = { n: 0, mine: false });
    if(!ids.length) return out;
    const { data } = await sb.from('likes').select('target_id,user_id').in('target_id', ids);
    (data || []).forEach(r => { const o = out[r.target_id]; if(o){ o.n++; if(r.user_id === SS.user.id) o.mine = true; } });
    return out;
  },
  async toggle(id, mine){
    if(mine) return sb.from('likes').delete().eq('target_id', id).eq('user_id', SS.user.id);
    return sb.from('likes').insert({ target_id: id });
  },
  html(id, st){
    return `<button type="button" class="like-btn${st && st.mine ? ' on' : ''}" data-like="${id}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="${st && st.mine ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
      参考になった<b>${st ? st.n : 0}</b></button>`;
  }
};

// 自分の投稿かどうか（owners 表は本人の分しか見えない）
SS.loadOwned = async () => {
  const { data } = await sb.from('owners').select('row_id');
  SS.myOwned = new Set((data || []).map(r => r.row_id));
  return SS.myOwned;
};
SS.owns = id => !!(SS.myOwned && SS.myOwned.has(id));

// 投稿者の表示
SS.authorHtml = (r) => {
  if(r.is_anonymous || !r.author_name) return `<span class="au-name anon">匿名</span>`;
  const badge = r.author_role === 'reviewer' ? '<span class="role-badge reviewer">確認者</span>'
              : r.author_role === 'admin' ? '<span class="role-badge admin">運営</span>' : '';
  return `<span class="au-name">${SS.esc(r.author_name)}</span>${badge}${r.author_univ ? `<span class="au-univ">${SS.esc(r.author_univ)}</span>` : ''}`;
};

// ================================================================
// 画面の切り替え
// ================================================================
//  ・アプリを開いたとき／「エコー部立ち上げ」へ行くとき … 多田先生の幕（doc）
//  ・それ以外 … 全国にエコー教育を届けるため奔走する SS-7 が走り抜ける（4パターンからランダム）
//      dash    … 黒地にスピード線。右から飛び込んできて、左へ走り去る
//      glow    … ヘッドライト点灯 → アンダーグローを残して発進
//      stripes … レーシングストライプが走り、その上を SS-7 が駆け抜ける
//      city    … 夜の街の SS-7。最後はワープするように吸い込まれる
//  前のページで「入ってくる」動き、次のページで「出ていく」動きをして、1本の演出に見せる。
const CAR_PATTERNS = ['dash', 'glow', 'stripes', 'city'];
const DOC_HTML = `
  <div class="cur-brand"><div class="cur-name">ソノサポ</div><div class="cur-sub">SONOGRAPHY × SUPPORT</div></div>
  <div class="cur-waves"><span class="cur-wave"></span><span class="cur-wave"></span></div>
  <img class="cur-doc" src="assets/doctor.webp" alt="">`;
const carHtml = (pat) => `
  <div class="cc-bg"></div>
  <div class="cc-stripes"><i></i><i></i><i></i></div>
  <div class="cc-lines">${'<i></i>'.repeat(9)}</div>
  <div class="cc-road"></div>
  <div class="cc-floor"></div>
  <div class="cc-stage"><div class="cc-trail"></div><img class="cc-ghost" src="assets/${pat === 'glow' ? 'car-glow' : 'car'}.webp" width="1400" height="${pat === 'glow' ? 448 : 439}" alt="" decoding="sync"><img class="cc-car" src="assets/${pat === 'glow' ? 'car-glow' : 'car'}.webp" width="1400" height="${pat === 'glow' ? 448 : 439}" alt="" decoding="sync"></div>
  <div class="cc-tag">SS-7 ・ SONOGRAPHY × SUPPORT</div>`;
function makeCurtain(kind, phase){
  let c = document.getElementById('ss-curtain');
  if(c && c.dataset.kind !== kind){ c.remove(); c = null; }
  if(!c){
    c = document.createElement('div'); c.id = 'ss-curtain'; c.setAttribute('aria-hidden', 'true');
    c.dataset.kind = kind;
    c.innerHTML = kind === 'doc' ? DOC_HTML : carHtml(kind);
    document.body.appendChild(c);
  }
  c.className = (kind === 'doc' ? '' : 'car p-' + kind) + ' in' + (phase ? ' ' + phase : '');
  return c;
}
function pickPattern(){
  let last = ''; try{ last = localStorage.getItem('ss_last_pat') || ''; }catch(e){}
  const pool = CAR_PATTERNS.filter(p => p !== last);
  const p = pool[Math.floor(Math.random() * pool.length)];
  try{ localStorage.setItem('ss_last_pat', p); }catch(e){}
  return p;
}
// 読み込みが始まったらすぐ幕を出す（前のページから来たときは、その続きの止まった状態から）
let _bootCurtain = null;
function bootCurtain(){
  if(_bootCurtain) return _bootCurtain;
  let kind = null;
  try{ kind = sessionStorage.getItem('ss_nav'); sessionStorage.removeItem('ss_nav'); }catch(e){}
  if(kind && (kind === 'doc' || CAR_PATTERNS.includes(kind))) _bootCurtain = makeCurtain(kind, '');
  else _bootCurtain = makeCurtain('doc', 'enter');   // アプリを開いたとき
  return _bootCurtain;
}
document.addEventListener('DOMContentLoaded', () => {
  if(document.documentElement.classList.contains('ss-boot')) bootCurtain();
});
// ページの準備ができたら幕を上げる
SS.reveal = (minMs = 0) => {
  const start = SS._bootAt || Date.now();
  setTimeout(() => {
    let c = document.getElementById('ss-curtain') || bootCurtain();
    const kind = c.dataset.kind;
    c.className = c.className.replace(/\benter\b/, '').trim();
    document.documentElement.classList.remove('ss-boot');
    requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('leave')));
    setTimeout(() => c.remove(), kind === 'doc' ? 620 : 760);
    // 次の移動にそなえて、SS-7 の画像を先に読み込んでおく
    setTimeout(() => ['car', 'car-glow', 'car-city'].forEach(n => { const i = new Image(); i.src = 'assets/' + n + '.webp'; }), 900);
  }, Math.max(0, minMs - (Date.now() - start)));
};
// 別のページへ移るときは、幕を下ろしてから移動
SS.go = (href) => {
  if(SS._leaving) return; SS._leaving = true;
  const url = new URL(href, location.href);
  const kind = /launch\.html$/.test(url.pathname) ? 'doc' : pickPattern();
  makeCurtain(kind, 'enter');
  try{ sessionStorage.setItem('ss_nav', kind); }catch(e){}
  setTimeout(() => { location.href = url.href; }, kind === 'doc' ? 300 : 500);
};
document.addEventListener('click', ev => {
  const a = ev.target.closest && ev.target.closest('a[href]');
  if(!a || ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
  if(a.target === '_blank' || a.hasAttribute('download') || a.dataset.noCurtain !== undefined) return;
  const href = a.getAttribute('href');
  if(!href || href.startsWith('#') || /^(https?:|mailto:|tel:)/.test(href)) return;
  const url = new URL(href, location.href);
  if(url.origin !== location.origin) return;
  if(url.pathname === location.pathname){ return; }   // 同じページ内の移動は幕なし
  ev.preventDefault();
  SS.go(url.href);
});
// 「戻る」で戻ってきたとき、幕が残らないようにする
window.addEventListener('pageshow', e => { if(e.persisted){ SS._leaving = false; const c = document.getElementById('ss-curtain'); if(c) c.remove(); document.documentElement.classList.remove('ss-boot'); } });

// ================================================================
// ログイン確認
// ================================================================
// 使い方： SS.boot().then(ctx => { ...ページの処理... })
//   opts.requireProfile … 招待コードで参加済みでなければ index.html へ戻す（既定：true）
//   opts.adminOnly      … 管理者でなければ index.html へ戻す
SS.boot = async (opts = {}) => {
  SS._bootAt = Date.now();
  const requireProfile = opts.requireProfile !== false;
  let session = null;
  try{ ({ data: { session } } = await sb.auth.getSession()); }catch(e){}
  SS.user = session ? session.user : null;
  if(SS.user){
    const { data: prof } = await sb.from('profiles').select('*').eq('id', SS.user.id).maybeSingle();
    SS.me = prof || null;
    if(SS.me && SS.me.university_id){
      const { data: u } = await sb.from('universities').select('*').eq('id', SS.me.university_id).maybeSingle();
      SS.univ = u || null;
    }
  }
  if((requireProfile && !SS.me) || (opts.adminOnly && !SS.isAdmin())){
    location.replace('index.html');
    return new Promise(() => {});   // 移動するまで先に進ませない
  }
  // 別の端末でログアウトされた等に備える
  sb.auth.onAuthStateChange((event) => {
    if(event === 'SIGNED_OUT' && requireProfile) location.replace('index.html');
  });
  return { user: SS.user, me: SS.me, univ: SS.univ };
};

// ================================================================
// 下のタブバー
// ================================================================
SS.tabbar = (active) => {
  const tabs = [
    ['home', 'index.html', 'ホーム', '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/>'],
    ['manabu', 'manabu.html', 'まなぶ', '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>'],
    ['calendar', 'calendar.html', 'カレンダー', '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'],
    ['chat', 'chat.html', 'チャット', '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>'],
  ];
  const nav = document.createElement('nav');
  nav.className = 'tabbar'; nav.setAttribute('aria-label', 'メインメニュー');
  nav.innerHTML = tabs.map(([k, href, label, icon]) =>
    `<a class="tab${k === active ? ' on' : ''}" href="${href}" data-tab="${k}"${k === active ? ' aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
      <span>${label}</span></a>`).join('');
  document.body.appendChild(nav);
  document.body.classList.add('has-tabbar');
  SS.refreshChatBadge();
};
// チャットの新着（この端末で前に見たときより返信が増えた質問の数）
SS.SEEN_KEY = 'ss_seen_v1';
SS.getSeen = () => { try{ return JSON.parse(localStorage.getItem(SS.SEEN_KEY) || '{}'); }catch(e){ return {}; } };
SS.setSeen = (id, n) => { try{ const m = SS.getSeen(); m[id] = n; localStorage.setItem(SS.SEEN_KEY, JSON.stringify(m)); }catch(e){} };
SS.refreshChatBadge = async () => {
  if(!SS.me) return;
  const tab = document.querySelector('.tab[data-tab="chat"]'); if(!tab) return;
  try{
    const owned = SS.myOwned || await SS.loadOwned();
    const ids = [...owned]; if(!ids.length) return;
    const { data } = await sb.from('threads').select('id,reply_count').in('id', ids.slice(0, 200));
    const seen = SS.getSeen();
    const n = (data || []).filter(t => t.reply_count > (seen[t.id] || 0)).length;
    let b = tab.querySelector('.dot-badge');
    if(n > 0){ if(!b){ b = document.createElement('span'); b.className = 'dot-badge'; tab.appendChild(b); } b.textContent = n > 9 ? '9+' : n; }
    else if(b) b.remove();
  }catch(e){}
};

// ---------------- PWA ----------------
if('serviceWorker' in navigator){
  window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
}
SS.isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
SS.device = () => { const ua = navigator.userAgent; if(/iPhone|iPod/.test(ua) || (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))) return 'ios'; if(/Android/.test(ua)) return 'android'; return null; };

// role="button" の要素を Enter／スペースでも押せるように
document.addEventListener('keydown', ev => {
  if(ev.key !== 'Enter' && ev.key !== ' ') return;
  const el = document.activeElement;
  if(el && el.getAttribute('role') === 'button' && !['BUTTON','A','INPUT','TEXTAREA','SELECT'].includes(el.tagName)){ ev.preventDefault(); el.click(); }
});
