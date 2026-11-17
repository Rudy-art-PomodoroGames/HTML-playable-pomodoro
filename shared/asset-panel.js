// Asset panel for playables.
// Lists every image and the font a game uses, with a thumbnail. Lets you
// replace any of them from your device (saved in this browser), download them
// with the exact file name the game expects, and reset them.
//
// Where each asset comes from, first match wins:
//   1. your upload in this browser
//   2. a file in the game's assets/ folder (e.g. assets/minion_lv1.png)
//   3. the built-in drawn shape (images) or the default font (font)
//
// Usage:
//   AssetPanel.init({ storageKey, basePath: 'assets/', mount, uploadUrl,
//     onToggle, onFontChange, font: { family, fallback },
//     images: [{ key, label, size, draw(ctx, w, h) }] });
//   AssetPanel.image(key)   // loaded <img> or null (then draw the shape)
//   AssetPanel.fontStack    // CSS font-family to use

(function () {
  const DB_NAME = 'playable-assets';
  const STORE = 'files';
  const FONT_EXTS = ['woff2', 'woff', 'ttf', 'otf'];

  // ---- Storage (IndexedDB; falls back to memory only if unavailable) ------

  function openDb() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }
  function dbOp(db, mode, fn) {
    return new Promise((resolve) => {
      if (!db) return resolve(null);
      try {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }
  const dbGet = (db, k) => dbOp(db, 'readonly', (s) => s.get(k));
  const dbPut = (db, k, v) => dbOp(db, 'readwrite', (s) => s.put(v, k));
  const dbDel = (db, k) => dbOp(db, 'readwrite', (s) => s.delete(k));

  // ---- Helpers ------------------------------------------------------------

  async function fetchBlob(url) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      return res.ok ? await res.blob() : null;
    } catch (e) { return null; }
  }

  function loadImage(blob) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  }

  function sizeText(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  const extOf = (name) => (name.split('.').pop() || '').toLowerCase();

  const SOURCE_TEXT = {
    builtin: 'Built-in shape',
    builtinFont: 'Default font',
    repo: 'File in assets/',
    local: 'Your upload (this browser only)',
  };

  const CSS = `
    .ap-btn { position: absolute; top: 52px; left: 8px; width: 36px; height: 36px; border: 0; border-radius: 10px;
      background: rgba(0,0,0,0.35); color: #fff; font-size: 18px; line-height: 36px; padding: 0; cursor: pointer; z-index: 5; min-width: 0; }
    .ap-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: none; align-items: center;
      justify-content: center; z-index: 100; font-family: system-ui, sans-serif; }
    .ap-overlay.open { display: flex; }
    .ap-card { background: #17241a; color: #e8f5ea; width: min(440px, calc(100vw - 32px)); max-height: 85vh;
      border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; }
    .ap-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; font-weight: 700; }
    .ap-head button { background: transparent; border: 0; color: #fff; font-size: 20px; cursor: pointer; padding: 0 4px; }
    .ap-body { overflow-y: auto; padding: 0 16px 8px; }
    .ap-row { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #2a3a2e; }
    .ap-thumb { width: 56px; height: 56px; flex: none; border-radius: 8px; display: flex; align-items: center; justify-content: center;
      background: repeating-conic-gradient(#2a3a2e 0% 25%, #223026 0% 50%) 50% / 12px 12px; overflow: hidden; }
    .ap-thumb img, .ap-thumb canvas { max-width: 100%; max-height: 100%; }
    .ap-thumb .ap-font-sample { font-size: 22px; font-weight: 700; }
    .ap-info { flex: 1; min-width: 0; font-size: 13px; line-height: 1.35; }
    .ap-info b { font-size: 14px; }
    .ap-file { font-family: ui-monospace, monospace; color: #9fc3a6; font-size: 12px; }
    .ap-src { color: #9fc3a6; }
    .ap-src.local { color: #f5e663; }
    .ap-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .ap-actions button, .ap-actions label { font: inherit; font-size: 12px; font-weight: 600; border: 0; border-radius: 6px;
      padding: 6px 10px; background: #2a3a2e; color: #fff; cursor: pointer; }
    .ap-actions .ap-primary { background: #3d7a4a; }
    .ap-actions input { display: none; }
    .ap-foot { padding: 12px 16px; border-top: 1px solid #2a3a2e; font-size: 12px; line-height: 1.45; color: #9fc3a6; }
    .ap-foot a { color: #7bd389; }
  `;

  // ---- Panel --------------------------------------------------------------

  function init({ storageKey, basePath = 'assets/', mount, uploadUrl, onToggle, onFontChange, images = [], font = null }) {
    const api = window.AssetPanel;
    const entries = {};      // key -> { source, img, blob, name }
    const fallbackFont = (font && font.fallback) || 'system-ui, sans-serif';
    const fontEntry = { source: 'builtinFont', blob: null, name: null, face: null };
    let db = null;

    api.fontStack = fallbackFont;
    api.image = (key) => (entries[key] && entries[key].img) || null;
    for (const a of images) entries[a.key] = { source: 'builtin', img: null, blob: null, name: null };

    const dbKey = (key) => `${storageKey}:${key}`;

    async function useImage(key, blob, source, name) {
      const img = blob ? await loadImage(blob) : null;
      entries[key] = img ? { source, img, blob, name } : { source: 'builtin', img: null, blob: null, name: null };
      return !!img;
    }

    async function loadDefaultImage(key) {
      const blob = await fetchBlob(`${basePath}${key}.png`);
      await useImage(key, blob, 'repo', `${key}.png`);
    }

    async function useFont(blob, source, name) {
      if (fontEntry.face) document.fonts.delete(fontEntry.face);
      fontEntry.face = null;
      if (blob) {
        try {
          const face = new FontFace(font.family, await blob.arrayBuffer());
          await face.load();
          document.fonts.add(face);
          Object.assign(fontEntry, { source, blob, name, face });
          api.fontStack = `'${font.family}', ${fallbackFont}`;
          if (onFontChange) onFontChange(api.fontStack);
          return true;
        } catch (e) { /* not a valid font: fall through to default */ }
      }
      Object.assign(fontEntry, { source: 'builtinFont', blob: null, name: null, face: null });
      api.fontStack = fallbackFont;
      if (onFontChange) onFontChange(api.fontStack);
      return false;
    }

    async function loadDefaultFont() {
      for (const ext of FONT_EXTS) {
        const blob = await fetchBlob(`${basePath}font.${ext}`);
        if (blob && await useFont(blob, 'repo', `font.${ext}`)) return;
      }
      await useFont(null);
    }

    // Load everything: your uploads first, then the assets/ folder.
    (async () => {
      db = await openDb();
      await Promise.all(images.map(async (a) => {
        const saved = await dbGet(db, dbKey(a.key));
        if (saved && await useImage(a.key, saved.blob, 'local', saved.name)) return;
        await loadDefaultImage(a.key);
      }));
      if (font) {
        const saved = await dbGet(db, dbKey('__font'));
        if (!(saved && await useFont(saved.blob, 'local', saved.name))) await loadDefaultFont();
      }
      if (overlay.classList.contains('open')) render();
    })();

    // ---- UI ---------------------------------------------------------------

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.className = 'ap-btn';
    btn.textContent = '🎨';
    btn.setAttribute('aria-label', 'Assets');
    mount.appendChild(btn);

    const overlay = document.createElement('div');
    overlay.className = 'ap-overlay';
    overlay.innerHTML = `
      <div class="ap-card" role="dialog" aria-label="Assets">
        <div class="ap-head"><span>Assets</span><button class="ap-close" aria-label="Close">✕</button></div>
        <div class="ap-body"></div>
        <div class="ap-foot"></div>
      </div>`;
    document.body.appendChild(overlay);
    const body = overlay.querySelector('.ap-body');

    const foot = overlay.querySelector('.ap-foot');
    foot.innerHTML = `Your uploads show in the game right away but stay in <b>this browser only</b>.
      To publish them for everyone: tap <b>Download</b> on each one, then upload the files to the
      game's <b>assets</b> folder on GitHub (same file names replace the old ones).` +
      (uploadUrl ? ` <a href="${uploadUrl}" target="_blank" rel="noopener">Open the GitHub upload page</a>.` : '');

    function setOpen(open) {
      overlay.classList.toggle('open', open);
      if (open) render();
      if (onToggle) onToggle(open);
    }
    btn.addEventListener('click', () => setOpen(true));
    overlay.querySelector('.ap-close').addEventListener('click', () => setOpen(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) setOpen(false); });

    function actionButton(text, onClick, primary) {
      const b = document.createElement('button');
      b.textContent = text;
      if (primary) b.className = 'ap-primary';
      b.addEventListener('click', onClick);
      return b;
    }

    function fileButton(text, accept, onFile) {
      const label = document.createElement('label');
      label.className = 'ap-primary';
      label.textContent = text;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        input.value = '';
        if (file) onFile(file);
      });
      label.appendChild(input);
      return label;
    }

    function row(thumb, title, fileName, source, details, actions) {
      const r = document.createElement('div');
      r.className = 'ap-row';
      const t = document.createElement('div');
      t.className = 'ap-thumb';
      t.appendChild(thumb);
      const info = document.createElement('div');
      info.className = 'ap-info';
      info.innerHTML = `<b></b><div class="ap-file"></div><div class="ap-src"></div><div class="ap-details"></div>`;
      info.querySelector('b').textContent = title;
      info.querySelector('.ap-file').textContent = fileName;
      const src = info.querySelector('.ap-src');
      src.textContent = SOURCE_TEXT[source];
      if (source === 'local') src.classList.add('local');
      info.querySelector('.ap-details').textContent = details;
      const act = document.createElement('div');
      act.className = 'ap-actions';
      for (const a of actions) act.appendChild(a);
      info.appendChild(act);
      r.append(t, info);
      body.appendChild(r);
    }

    function render() {
      body.innerHTML = '';

      for (const a of images) {
        const e = entries[a.key];
        let thumb;
        if (e.img) {
          thumb = document.createElement('img');
          thumb.src = e.img.src;
          thumb.alt = a.label;
        } else {
          thumb = document.createElement('canvas');
          thumb.width = 112;
          thumb.height = 112;
          const c = thumb.getContext('2d');
          c.scale(2, 2);
          a.draw(c, 56, 56);
        }
        const details = (e.img ? `${e.img.naturalWidth}×${e.img.naturalHeight} px · ${sizeText(e.blob.size)}` : 'Drawn by the game') +
          (a.size ? ` · suggested ${a.size}` : '');
        const actions = [
          fileButton('Replace (PNG)', 'image/png', async (file) => {
            if (file.type !== 'image/png') { alert('Please choose a PNG file.'); return; }
            if (!(await useImage(a.key, file, 'local', file.name))) { alert('This file could not be opened as an image.'); return; }
            await dbPut(db, dbKey(a.key), { blob: file, name: file.name });
            render();
          }),
        ];
        if (e.blob) actions.push(actionButton('Download', () => download(e.blob, `${a.key}.png`)));
        if (e.source === 'local') {
          actions.push(actionButton('Reset', async () => {
            await dbDel(db, dbKey(a.key));
            await loadDefaultImage(a.key);
            render();
          }));
        }
        row(thumb, a.label, `${a.key}.png`, e.source, details, actions);
      }

      if (font) {
        const sample = document.createElement('div');
        sample.className = 'ap-font-sample';
        sample.style.fontFamily = api.fontStack;
        sample.textContent = 'Aa';
        const fileName = fontEntry.name && fontEntry.source === 'repo' ? fontEntry.name : 'font.woff2 / .woff / .ttf / .otf';
        const details = fontEntry.blob ? `${sizeText(fontEntry.blob.size)} · used for all text` : 'System font · used for all text';
        const actions = [
          fileButton('Replace (font)', '.woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf', async (file) => {
            if (!FONT_EXTS.includes(extOf(file.name))) { alert('Please choose a .woff2, .woff, .ttf or .otf font file.'); return; }
            if (!(await useFont(file, 'local', file.name))) { alert('This file could not be opened as a font.'); render(); return; }
            await dbPut(db, dbKey('__font'), { blob: file, name: file.name });
            render();
          }),
        ];
        if (fontEntry.blob) actions.push(actionButton('Download', () => download(fontEntry.blob, `font.${extOf(fontEntry.name) || 'woff2'}`)));
        if (fontEntry.source === 'local') {
          actions.push(actionButton('Reset', async () => {
            await dbDel(db, dbKey('__font'));
            await loadDefaultFont();
            render();
          }));
        }
        row(sample, 'Game font', fileName, fontEntry.source, details, actions);
      }
    }
  }

  window.AssetPanel = { init, image: () => null, fontStack: 'system-ui, sans-serif' };
})();
