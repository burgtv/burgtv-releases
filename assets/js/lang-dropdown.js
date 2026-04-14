/**
 * BurgTV Universal Language Dropdown
 * Auto-detects old .lang-switch button groups and replaces them with a professional dropdown.
 * Works with both patterns:
 *   - <button id="btn-xx">XX</button>  (legal pages, burgtv.com)
 *   - <button class="lang-btn" data-lang="xx">XX</button>  (login, register, portal)
 *
 * Include via: <script src="/assets/js/lang-dropdown.js" defer></script>
 */
(function () {
  'use strict';

  const LANG_META = {
    it: { flag: '🇮🇹', code: 'IT', name: 'Italiano' },
    en: { flag: '🇬🇧', code: 'EN', name: 'English' },
    de: { flag: '🇩🇪', code: 'DE', name: 'Deutsch' },
    es: { flag: '🇪🇸', code: 'ES', name: 'Español' },
    fr: { flag: '🇫🇷', code: 'FR', name: 'Français' },
  };

  // Inject dropdown CSS once
  function injectStyles() {
    if (document.getElementById('burgtv-lang-dd-styles')) return;
    const css = `
      .bv-lang-dd { position: relative; display: inline-block; font-family: inherit; }
      .bv-lang-dd-trigger { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 8px 14px; border-radius: 12px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; font-family: inherit; line-height: 1; min-height: 36px; }
      .bv-lang-dd-trigger:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
      .bv-lang-dd-trigger .bv-flag { font-size: 18px; line-height: 1; }
      .bv-lang-dd-trigger .bv-chev { width: 14px; height: 14px; transition: transform 0.2s; opacity: 0.7; flex-shrink: 0; }
      .bv-lang-dd-trigger[aria-expanded="true"] .bv-chev { transform: rotate(180deg); }
      .bv-lang-dd-menu { position: absolute; top: calc(100% + 8px); right: 0; min-width: 170px; background: rgba(20,20,30,0.98); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 6px; list-style: none; margin: 0; opacity: 0; pointer-events: none; transform: translateY(-6px); transition: all 0.2s; z-index: 99999; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
      .bv-lang-dd-menu.open { opacity: 1; pointer-events: auto; transform: translateY(0); }
      .bv-lang-dd-opt { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; cursor: pointer; font-size: 14px; color: #d9def7; transition: background 0.15s; }
      .bv-lang-dd-opt:hover { background: rgba(255,255,255,0.06); color: #fff; }
      .bv-lang-dd-opt.active { background: rgba(185,74,142,0.18); color: #fff; }
      .bv-lang-dd-opt .bv-flag { font-size: 18px; line-height: 1; }
      .bv-lang-dd-opt .bv-name { flex: 1; }
      .bv-lang-dd-opt .bv-check { width: 14px; height: 14px; opacity: 0; color: #B94A8E; flex-shrink: 0; }
      .bv-lang-dd-opt.active .bv-check { opacity: 1; }
      .bv-lang-replaced { display: none !important; }
      /* Fallback: if dropdown was inserted next to a hidden .lang-switch, mimic its typical fixed positioning */
      .lang-switch.bv-lang-replaced + .bv-lang-dd {
        position: fixed;
        top: 1.5rem;
        right: 1.5rem;
        z-index: 1000;
      }
      @media (max-width: 640px) {
        .lang-switch.bv-lang-replaced + .bv-lang-dd { top: 1rem; right: 1rem; }
      }
    `;
    const style = document.createElement('style');
    style.id = 'burgtv-lang-dd-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Find the language buttons and their container
  function findLangButtons() {
    // Pattern 1: buttons with id="btn-XX" (burgtv.com, legal pages)
    const idButtons = {};
    ['it', 'en', 'de', 'es', 'fr'].forEach(l => {
      const b = document.getElementById('btn-' + l);
      if (b) idButtons[l] = b;
    });
    if (Object.keys(idButtons).length >= 2) {
      const container = idButtons.it?.parentElement || idButtons.en?.parentElement;
      return { buttons: idButtons, container, pattern: 'id' };
    }

    // Pattern 2: buttons with class="lang-btn" data-lang="xx" (portal login/register)
    const dataButtons = {};
    document.querySelectorAll('[data-lang]').forEach(b => {
      const l = b.getAttribute('data-lang');
      if (LANG_META[l] && !dataButtons[l]) dataButtons[l] = b;
    });
    if (Object.keys(dataButtons).length >= 2) {
      const container = dataButtons.it?.parentElement || dataButtons.en?.parentElement;
      return { buttons: dataButtons, container, pattern: 'data' };
    }

    return null;
  }

  function getCurrentLang(buttons) {
    for (const [l, btn] of Object.entries(buttons)) {
      if (btn.classList.contains('active')) return l;
    }
    return localStorage.getItem('preferredLang') || localStorage.getItem('burgtv_lang') || document.documentElement.lang || 'it';
  }

  function buildDropdown(currentLang) {
    const wrap = document.createElement('div');
    wrap.className = 'bv-lang-dd';
    const meta = LANG_META[currentLang] || LANG_META.it;
    wrap.innerHTML = `
      <button class="bv-lang-dd-trigger" aria-expanded="false" aria-haspopup="listbox" aria-label="Language">
        <span class="bv-flag">${meta.flag}</span>
        <span class="bv-code">${meta.code}</span>
        <svg class="bv-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <ul class="bv-lang-dd-menu" role="listbox">
        ${Object.entries(LANG_META).map(([l, m]) => `
          <li class="bv-lang-dd-opt${l === currentLang ? ' active' : ''}" data-lang="${l}" role="option">
            <span class="bv-flag">${m.flag}</span>
            <span class="bv-name">${m.name}</span>
            <svg class="bv-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </li>
        `).join('')}
      </ul>
    `;
    return wrap;
  }

  function setActiveInDropdown(wrap, lang) {
    const meta = LANG_META[lang];
    if (!meta) return;
    const flag = wrap.querySelector('.bv-lang-dd-trigger .bv-flag');
    const code = wrap.querySelector('.bv-lang-dd-trigger .bv-code');
    if (flag) flag.textContent = meta.flag;
    if (code) code.textContent = meta.code;
    wrap.querySelectorAll('.bv-lang-dd-opt').forEach(o => {
      o.classList.toggle('active', o.dataset.lang === lang);
    });
  }

  function init() {
    const found = findLangButtons();
    if (!found) return;

    injectStyles();

    const current = getCurrentLang(found.buttons);
    const dropdown = buildDropdown(current);

    // Copy positioning from original container if it's fixed/absolute
    const cs = window.getComputedStyle(found.container);
    if (cs.position === 'fixed' || cs.position === 'absolute') {
      dropdown.style.position = cs.position;
      dropdown.style.zIndex = cs.zIndex && cs.zIndex !== 'auto' ? cs.zIndex : '1000';
      ['top', 'right', 'bottom', 'left'].forEach(side => {
        const v = cs[side];
        if (v && v !== 'auto') dropdown.style[side] = v;
      });
    }

    // Insert dropdown right after the container of old buttons
    found.container.parentElement.insertBefore(dropdown, found.container.nextSibling);

    // Hide the old switcher
    found.container.classList.add('bv-lang-replaced');

    // Wire up dropdown
    const trigger = dropdown.querySelector('.bv-lang-dd-trigger');
    const menu = dropdown.querySelector('.bv-lang-dd-menu');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.toggle('open');
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    dropdown.querySelectorAll('.bv-lang-dd-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const lang = opt.dataset.lang;
        const btn = found.buttons[lang];
        if (btn) btn.click();
        setActiveInDropdown(dropdown, lang);
        menu.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        menu.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        menu.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    // Observe active class changes on old buttons to sync dropdown
    const observer = new MutationObserver(() => {
      for (const [l, btn] of Object.entries(found.buttons)) {
        if (btn.classList.contains('active')) {
          setActiveInDropdown(dropdown, l);
          break;
        }
      }
    });
    Object.values(found.buttons).forEach(btn => {
      observer.observe(btn, { attributes: true, attributeFilter: ['class'] });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
