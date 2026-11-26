// Cheat panel (🕹) for testing a playable: a list of buttons that change the game.
// A cheat can have number fields with ◀ ▶ arrows; their values are passed to onClick.
//
// Usage:
//   CheatPanel.init({ mount: stageElement, onToggle, cheats: [
//     { label: '+1M juice', onClick: () => { ... } },
//     { label: 'Add minions', fields: [{ key: 'level', label: 'Lv', value: 1, min: 1, max: 50 }],
//       onClick: ({ level }) => { ... } },
//   ] });

(function () {
  const CSS = `
    .cp-btn { position: absolute; top: 8px; left: 8px; width: 36px; height: 36px; border: 0; border-radius: 10px;
      background: rgba(0,0,0,0.35); color: #fff; font-size: 20px; line-height: 36px; padding: 0; cursor: pointer; z-index: 5; min-width: 0; }
    .cp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.1); display: none; align-items: center;
      justify-content: center; z-index: 100; font-family: system-ui, sans-serif; }
    .cp-overlay.open { display: flex; }
    .cp-card { background: rgba(23,36,26,0.85); text-shadow: 0 1px 2px rgba(0,0,0,0.6); color: #e8f5ea; width: min(420px, calc(100vw - 32px));
      max-height: 85vh; border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; }
    .cp-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; font-weight: 700; }
    .cp-head button { border: 0; background: transparent; color: #fff; font-size: 20px; padding: 0 4px; cursor: pointer; }
    .cp-body { overflow-y: auto; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 10px; }
    .cp-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .cp-go { flex: 1; min-width: 110px; padding: 12px; border: 0; border-radius: 8px; background: #e0a526; color: #1b1b1b;
      font: 700 15px system-ui, sans-serif; cursor: pointer; }
    .cp-go:active { transform: scale(0.97); }
    .cp-field { display: flex; align-items: center; gap: 3px; font: 600 13px system-ui, sans-serif; }
    .cp-field > span { margin-right: 2px; }
    .cp-field button { width: 30px; height: 36px; padding: 0; border: 0; border-radius: 6px; background: rgba(255,255,255,0.15);
      color: #fff; font-size: 12px; cursor: pointer; min-width: 0; }
    .cp-field input { width: 44px; height: 36px; box-sizing: border-box; text-align: center; padding: 0 2px; font-size: 16px;
      border: 1px solid #3d5a43; border-radius: 6px; background: #0f1a12; color: #e8f5ea; }
  `;

  function init({ mount, onToggle, cheats = [] }) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.className = 'cp-btn';
    btn.textContent = '🕹';
    btn.setAttribute('aria-label', 'Cheats');
    mount.appendChild(btn);

    const overlay = document.createElement('div');
    overlay.className = 'cp-overlay';
    overlay.innerHTML = `
      <div class="cp-card" role="dialog" aria-label="Cheats">
        <div class="cp-head"><span>Cheats</span><button aria-label="Close">✕</button></div>
        <div class="cp-body"></div>
      </div>`;
    document.body.appendChild(overlay);
    const body = overlay.querySelector('.cp-body');

    for (const c of cheats) {
      const row = document.createElement('div');
      row.className = 'cp-row';
      for (const f of c.fields || []) {
        const clamp = (v) => Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, Math.round(v) || 0));
        const wrap = document.createElement('span');
        wrap.className = 'cp-field';
        wrap.innerHTML = `<span>${f.label}</span><button>◀</button><input type="number" inputmode="numeric"><button>▶</button>`;
        const [less, more] = wrap.querySelectorAll('button');
        const input = wrap.querySelector('input');
        const set = (v) => { f.value = clamp(v); input.value = f.value; };
        set(f.value);
        less.addEventListener('click', () => set(f.value - 1));
        more.addEventListener('click', () => set(f.value + 1));
        input.addEventListener('change', () => set(Number(input.value)));
        row.appendChild(wrap);
      }
      const go = document.createElement('button');
      go.className = 'cp-go';
      go.textContent = c.label;
      go.addEventListener('click', () => c.onClick(Object.fromEntries((c.fields || []).map((f) => [f.key, f.value]))));
      row.appendChild(go);
      body.appendChild(row);
    }

    function setOpen(open) {
      overlay.classList.toggle('open', open);
      if (onToggle) onToggle(open);
    }
    btn.addEventListener('click', () => setOpen(true));
    overlay.querySelector('.cp-head button').addEventListener('click', () => setOpen(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) setOpen(false); });
  }

  window.CheatPanel = { init };
})();
