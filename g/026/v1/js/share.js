"use strict";
// GitHub Pages 版だけに入れる: Xに投稿 / 画像を保存ダイアログ。window.SHARE = { postX, saveImage, isOpen }
// ふりーむ・itch 版には入れない（外部URLと DOM 追加を含むため）。main.js より前でも後でも読み込める。
(function () {
  const SHARE_URL = 'https://shjuno-git.github.io/g/026/v1/';
  const CSS = `
#sv{position:fixed;inset:0;z-index:10;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;box-sizing:border-box;background:rgba(30,22,16,.82);touch-action:auto;font-family:sans-serif}
#sv.on{display:flex}
#sv img{display:block;max-width:min(380px,92vw);max-height:70vh;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.45);-webkit-touch-callout:default;-webkit-user-select:auto;user-select:auto;pointer-events:auto}
#sv .hint{color:#fff8e0;font-weight:bold;font-size:15px;text-align:center;line-height:1.5}
#sv .hint small{display:block;font-size:12px;font-weight:normal;opacity:.8}
#sv button{width:min(320px,86vw);height:46px;border-radius:23px;border:2px solid #3b2a22;font:bold 16px sans-serif;cursor:pointer}
#sv .share{background:#f08a3c;color:#fff;border-color:#a0501c}
#sv .close{background:transparent;color:#fff8e0;border-color:#fff8e0;height:38px;font-size:14px}
`;
  let el = null, img = null, shareBtn = null, cur = null, elHint = null, elHintSub = null, elClose = null;

  function build() {
    if (el) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'sv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', t('shareAria'));
    el.innerHTML = '<img id="svImg" alt="">'
      + '<div class="hint"><span id="svHint"></span><small id="svHintSub"></small></div>'
      + '<button class="share" id="svShare"></button>'
      + '<button class="close" id="svClose"></button>';
    document.body.appendChild(el);
    img = el.querySelector('#svImg'); shareBtn = el.querySelector('#svShare');
    elHint = el.querySelector('#svHint'); elHintSub = el.querySelector('#svHintSub'); elClose = el.querySelector('#svClose');
    el.querySelector('#svClose').onclick = () => { if (cur) cur.pick(); close(); };
    el.addEventListener('click', e => { if (e.target === el) close(); });
    shareBtn.onclick = async () => {
      try { await navigator.share({ files: [file] }); close(); cur.toast(t('shareDone')); } // クリックの中で すぐ呼ぶ(ジェスチャー扱いのうちに)
      catch (e) { if (e && e.name === 'AbortError') return; shareBtn.style.display = 'none'; }
    };
  }
  let file = null;
  function close() { if (el) el.classList.remove('on'); }
  function isOpen() { return !!el && el.classList.contains('on'); }
  addEventListener('keydown', e => { if (isOpen() && e.key === 'Escape') close(); });
  function canShare(f) { try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [f] })); } catch (_) { return false; } }
  async function copyText(s) { try { await navigator.clipboard.writeText(s); return true; } catch (_) { return false; } }

  // c: main.js の shareCtx() = { name, tag, title, makeCanvas, toast, pick }
  async function postX(c) {
    c.pick();
    const text = t('sharePostFmt')(c.name, c.title, c.tag, SHARE_URL);
    const url = 'https://x.com/intent/post?text=' + encodeURIComponent(text);
    let w = null;
    try { w = window.open(url, '_blank'); } catch (_) { }
    if (!w) c.toast(await copyText(text) ? t('shareCopied') : t('shareXFail'));
  }
  // 画像を大きく出して「長押しで保存」。共有シートが使えれば「共有・写真に保存」も(スマホの写真アプリに入る)
  async function saveImage(c) {
    c.pick(); build(); cur = c;
    const cv = c.makeCanvas();
    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    if (!blob) { c.toast(t('shareImgFail')); return; }
    const filename = 'washigakimeta_' + c.name.replace(/\s+/g, '_') + '.png';
    try { file = new File([blob], filename, { type: 'image/png' }); } catch (_) { file = null; }
    el.setAttribute('aria-label', t('shareAria')); img.alt = t('shareImgAlt');   // 言語はそのつど引き直す
    elHint.textContent = t('shareHint'); elHintSub.textContent = t('shareHintSub'); shareBtn.textContent = t('shareBtn'); elClose.textContent = t('shareClose');
    img.src = cv.toDataURL('image/png'); // data URL のほうが iPhone の長押し保存が安定
    shareBtn.style.display = file && canShare(file) ? '' : 'none';
    el.classList.add('on');
  }
  window.SHARE = { postX, saveImage, isOpen };
})();
