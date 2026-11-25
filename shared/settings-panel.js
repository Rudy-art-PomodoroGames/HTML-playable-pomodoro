// Settings panel for tuning a playable.
// Lists every value of a config object (generated automatically, so new
// values show up without extra work), applies edits live, saves them in this
// browser, and can export them as JSON to paste back as the new defaults.
//
// Usage:
//   SettingsPanel.init({ config: CONFIG, storageKey: 'my-game.config',
//                        mount: stageElement, onRestart, onToggle });
//   SettingsPanel.save()   // after changing CONFIG from elsewhere, keep it saved

(function () {
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // Copy values from src into target in place, only for keys target has.
  // In place matters: the game keeps references to nested objects.
  function assignIn(target, src) {
    for (const k of Object.keys(target)) {
      if (!src || !(k in src)) continue;
      const t = target[k];
      const s = src[k];
      if (t && typeof t === 'object') assignIn(t, s);
      else if (typeof s === typeof t) target[k] = s;
    }
  }

  // Only the values that differ from the defaults, so new defaults in a
  // later build still apply to everything you haven't changed.
  function diff(cfg, def) {
    const out = {};
    for (const k of Object.keys(cfg)) {
      if (cfg[k] && typeof cfg[k] === 'object') {
        const d = diff(cfg[k], def[k] || {});
        if (Object.keys(d).length) out[k] = d;
      } else if (cfg[k] !== def[k]) out[k] = cfg[k];
    }
    return out;
  }

  function load(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function save(key, cfg) {
    try { localStorage.setItem(key, JSON.stringify(cfg)); } catch (e) { /* storage unavailable */ }
  }
  function clear(key) {
    try { localStorage.removeItem(key); } catch (e) { /* storage unavailable */ }
  }

  const CSS = `
    .sp-gear { position: absolute; top: 8px; left: 8px; width: 36px; height: 36px; border: 0; border-radius: 10px;
      background: rgba(0,0,0,0.35); color: #fff; font-size: 20px; line-height: 36px; padding: 0; cursor: pointer; z-index: 5; min-width: 0; }
    .sp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.1); display: none; align-items: center;
      justify-content: center; z-index: 100; font-family: system-ui, sans-serif; }
    .sp-overlay.open { display: flex; }
    .sp-card { background: rgba(23,36,26,0.85); text-shadow: 0 1px 2px rgba(0,0,0,0.6); color: #e8f5ea; width: min(420px, calc(100vw - 32px)); max-height: 85vh;
      border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; }
    .sp-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; font-weight: 700; }
    .sp-body { overflow-y: auto; padding: 0 16px 8px; }
    .sp-actions { display: flex; flex-direction: column; gap: 8px; padding: 10px 0; }
    .sp-action { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .sp-action-go { flex: 1; min-width: 90px; padding: 10px; border: 0; border-radius: 8px; background: #e0a526; color: #1b1b1b;
      font: 700 15px system-ui, sans-serif; cursor: pointer; }
    .sp-field { display: flex; align-items: center; gap: 3px; font: 600 13px system-ui, sans-serif; }
    .sp-field > span { margin-right: 2px; }
    .sp-field button { width: 28px; height: 32px; padding: 0; border: 0; border-radius: 6px; background: rgba(255,255,255,0.15);
      color: #fff; font-size: 12px; cursor: pointer; min-width: 0; }
    .sp-field input { width: 40px; height: 32px; box-sizing: border-box; text-align: center; padding: 0 2px; }
    .sp-group { margin: 12px 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #9fc3a6; }
    .sp-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 5px 0; font-size: 14px; }
    .sp-row.changed label { color: #f5e663; }
    .sp-row input[type=number], .sp-row input[type=text] { width: 96px; font-size: 16px; padding: 4px 6px; border-radius: 6px;
      border: 1px solid #3d5a43; background: #0f1a12; color: #e8f5ea; }
    .sp-row input[type=color] { width: 48px; height: 30px; border: 0; background: none; padding: 0; }
    .sp-row input[type=checkbox] { width: 22px; height: 22px; }
    .sp-foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; border-top: 1px solid #2a3a2e; }
    .sp-foot button, .sp-head button { flex: 1; min-width: 0; padding: 10px; font: inherit; font-weight: 600; font-size: 14px;
      border: 0; border-radius: 8px; background: #3d7a4a; color: #fff; cursor: pointer; }
    .sp-head button { flex: none; background: transparent; font-size: 20px; padding: 0 4px; }
    .sp-foot .sp-secondary { background: #2a3a2e; }
    .sp-json { width: 100%; box-sizing: border-box; height: 140px; margin-top: 8px; font: 12px ui-monospace, monospace;
      background: #0f1a12; color: #e8f5ea; border: 1px solid #3d5a43; border-radius: 6px; display: none; }
    .sp-hint { font-size: 12px; color: #9fc3a6; margin: 8px 0 0; }
    .sp-row label.sp-has-help { text-decoration: underline dotted rgba(232,245,234,0.5); text-underline-offset: 3px; cursor: help; }
    .sp-tip { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; z-index: 110;
      background: rgba(0,0,0,0.35); font-family: system-ui, sans-serif; }
    .sp-tip.open { display: flex; }
    .sp-tip-card { background: #24382a; color: #e8f5ea; width: min(340px, calc(100vw - 48px)); border-radius: 12px;
      padding: 14px 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
    .sp-tip-title { font: 600 13px ui-monospace, monospace; color: #9fc3a6; margin-bottom: 6px; word-break: break-all; }
    .sp-tip-text { font-size: 15px; line-height: 1.4; }
    .sp-tip-close { font-size: 12px; color: #9fc3a6; margin-top: 10px; }
  `;

  // help: { 'path.to.value': 'what it does' }. Tapping a setting's name shows it.
  function init({ config, storageKey, mount, onRestart, onToggle, help = {}, actions = [], hide = [] }) {
    const defaults = clone(config);
    assignIn(config, load(storageKey));
    // Lets other panels (e.g. 🎨 font weight) change a value and keep it saved.
    window.SettingsPanel.save = () => save(storageKey, diff(config, defaults));

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const gear = document.createElement('button');
    gear.className = 'sp-gear';
    gear.textContent = '⚙';
    gear.setAttribute('aria-label', 'Settings');
    mount.appendChild(gear);

    const overlay = document.createElement('div');
    overlay.className = 'sp-overlay';
    overlay.innerHTML = `
      <div class="sp-card" role="dialog" aria-label="Settings">
        <div class="sp-head"><span>Settings</span><button class="sp-close" aria-label="Close">✕</button></div>
        <div class="sp-body"></div>
        <div class="sp-foot">
          <button class="sp-restart">Restart</button>
          <button class="sp-copy sp-secondary">Copy JSON</button>
          <button class="sp-reset sp-secondary">Reset defaults</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const body = overlay.querySelector('.sp-body');

    // Help popup, shown on top of the panel when a setting's name is tapped.
    const tip = document.createElement('div');
    tip.className = 'sp-tip';
    tip.innerHTML = '<div class="sp-tip-card"><div class="sp-tip-title"></div><div class="sp-tip-text"></div>' +
      '<div class="sp-tip-close">Tap anywhere to close</div></div>';
    document.body.appendChild(tip);
    tip.addEventListener('click', () => tip.classList.remove('open'));
    const helpFor = (path) => help[path] || help[path.replace(/\.\d+$/, '')]; // list items share their list's text
    function showTip(path, text) {
      tip.querySelector('.sp-tip-title').textContent = path;
      tip.querySelector('.sp-tip-text').textContent = text;
      tip.classList.add('open');
    }

    function setOpen(open) {
      overlay.classList.toggle('open', open);
      if (onToggle) onToggle(open);
    }

    function addRow(obj, def, key, path) {
      const value = obj[key];
      const row = document.createElement('div');
      row.className = 'sp-row';
      const label = document.createElement('label');
      label.textContent = path;
      const text = helpFor(path);
      if (text) {
        label.classList.add('sp-has-help');
        label.addEventListener('click', () => showTip(path, text));
      }
      const input = document.createElement('input');

      if (typeof value === 'boolean') {
        input.type = 'checkbox';
        input.checked = value;
      } else if (typeof value === 'number') {
        input.type = 'number';
        input.step = 'any';
        input.inputMode = 'decimal';
        input.value = value;
      } else if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
        input.type = 'color';
        input.value = value;
      } else {
        input.type = 'text';
        input.value = value;
      }

      const markChanged = () => row.classList.toggle('changed', obj[key] !== def[key]);
      input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', () => {
        if (input.type === 'checkbox') obj[key] = input.checked;
        else if (input.type === 'number') {
          const n = parseFloat(input.value);
          if (Number.isNaN(n)) return;
          obj[key] = n;
        } else obj[key] = input.value;
        save(storageKey, diff(config, defaults));
        markChanged();
      });

      markChanged();
      row.append(label, input);
      body.appendChild(row);
    }

    function walk(obj, def, prefix) {
      // Plain values first, then nested groups. Paths listed in `hide` (and everything under them) are left out.
      const shown = (key) => !hide.includes(prefix ? `${prefix}.${key}` : key);
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] !== 'object' && shown(key)) addRow(obj, def, key, prefix ? `${prefix}.${key}` : key);
      }
      for (const key of Object.keys(obj)) {
        if (obj[key] && typeof obj[key] === 'object' && shown(key)) {
          const h = document.createElement('div');
          h.className = 'sp-group';
          h.textContent = prefix ? `${prefix}.${key}` : key;
          body.appendChild(h);
          walk(obj[key], def[key], prefix ? `${prefix}.${key}` : key);
        }
      }
    }

    const json = document.createElement('textarea');
    json.className = 'sp-json';
    json.readOnly = true;

    function build() {
      body.innerHTML = '';
      // Optional game buttons (e.g. cheats) at the very top of the list.
      if (actions.length) {
        const bar = document.createElement('div');
        bar.className = 'sp-actions';
        // An action can have number fields with ◀ ▶ arrows: { label, fields: [{ key, label, value, min, max }], onClick(values) }.
        for (const a of actions) {
          const line = document.createElement('div');
          line.className = 'sp-action';
          for (const f of a.fields || []) {
            const clamp = (v) => Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, Math.round(v) || 0));
            const wrap = document.createElement('span');
            wrap.className = 'sp-field';
            wrap.innerHTML = `<span>${f.label}</span><button>◀</button><input type="number" inputmode="numeric"><button>▶</button>`;
            const [less, more] = wrap.querySelectorAll('button');
            const input = wrap.querySelector('input');
            const set = (v) => { f.value = clamp(v); input.value = f.value; };
            set(f.value);
            less.addEventListener('click', () => set(f.value - 1));
            more.addEventListener('click', () => set(f.value + 1));
            input.addEventListener('change', () => set(Number(input.value)));
            line.appendChild(wrap);
          }
          const b = document.createElement('button');
          b.className = 'sp-action-go';
          b.textContent = a.label;
          b.addEventListener('click', () => a.onClick(Object.fromEntries((a.fields || []).map((f) => [f.key, f.value]))));
          line.appendChild(b);
          bar.appendChild(line);
        }
        body.appendChild(bar);
      }
      walk(config, defaults, '');
      const hint = document.createElement('p');
      hint.className = 'sp-hint';
      hint.textContent = 'Tap a setting name to see what it does. Changes apply live and are saved in this browser. Start and zone values apply on Restart. Yellow = changed from default.';
      body.appendChild(hint);
      json.style.display = 'none';
      body.appendChild(json);
    }

    gear.addEventListener('click', () => { build(); setOpen(true); });
    overlay.querySelector('.sp-close').addEventListener('click', () => setOpen(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) setOpen(false); });

    overlay.querySelector('.sp-restart').addEventListener('click', () => {
      setOpen(false);
      if (onRestart) onRestart();
    });

    overlay.querySelector('.sp-reset').addEventListener('click', () => {
      assignIn(config, clone(defaults));
      clear(storageKey);
      build();
    });

    overlay.querySelector('.sp-copy').addEventListener('click', () => {
      const text = JSON.stringify(config, null, 2);
      json.value = text;
      json.style.display = 'block';
      json.focus();
      json.select();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => { /* text stays selected for manual copy */ });
      }
    });
  }

  window.SettingsPanel = { init, save: () => {} };
})();
