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
    pt: { flag: '🇵🇹', code: 'PT', name: 'Português' },
    tr: { flag: '🇹🇷', code: 'TR', name: 'Türkçe' },
    nl: { flag: '🇳🇱', code: 'NL', name: 'Nederlands' },
    pl: { flag: '🇵🇱', code: 'PL', name: 'Polski' },
    ru: { flag: '🇷🇺', code: 'RU', name: 'Русский' },
    ar: { flag: '🇸🇦', code: 'AR', name: 'العربية' },
  };

  // Inject dropdown CSS once
  function injectStyles() {
    if (document.getElementById('burgtv-lang-dd-styles')) return;
    const css = `
      .bv-lang-dd { position: relative; display: inline-block; font-family: inherit; }
      .bv-lang-dd-trigger { display: flex; align-items: center; gap: 7px; background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.10); color: #e7e6f0; padding: 8px 12px; border-radius: 11px; cursor: pointer; font-size: 14px; font-weight: 500; transition: border-color .2s, background .2s; font-family: inherit; line-height: 1; min-height: 36px; }
      .bv-lang-dd-trigger:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.18); }
      .bv-lang-dd-trigger .bv-globe { width: 16px; height: 16px; opacity: .85; flex-shrink: 0; }
      .bv-lang-dd-trigger .bv-code { font-weight: 700; letter-spacing: .03em; }
      .bv-lang-dd-trigger .bv-chev { width: 11px; height: 11px; transition: transform 0.2s; opacity: 0.7; flex-shrink: 0; }
      .bv-lang-dd-trigger[aria-expanded="true"] .bv-chev { transform: rotate(180deg); }
      .bv-lang-dd-menu { position: absolute; top: calc(100% + 8px); right: 0; width: 312px; max-width: calc(100vw - 24px); max-height: 360px; overflow-y: auto; background: rgba(14,11,24,0.97); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.18); border-radius: 16px; padding: 8px; list-style: none; margin: 0; opacity: 0; pointer-events: none; transform: translateY(-8px) scale(.98); transform-origin: top right; transition: opacity .2s, transform .2s; z-index: 99999; box-shadow: 0 18px 50px -12px rgba(0,0,0,0.6); display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
      .bv-lang-dd-menu.open { opacity: 1; pointer-events: auto; transform: none; }
      .bv-lang-dd-opt { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border: 1px solid transparent; border-radius: 10px; cursor: pointer; font-size: 13.5px; color: #cfcde0; transition: background .15s, border-color .15s, color .15s; }
      .bv-lang-dd-opt:hover { background: rgba(255,255,255,0.07); color: #fff; }
      .bv-lang-dd-opt.active { background: rgba(185,74,142,0.16); border-color: rgba(185,74,142,0.4); color: #fff; font-weight: 600; }
      .bv-lang-dd-opt .bv-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; padding: 2px 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.10); background: rgba(185,74,142,0.12); color: #e06bb0; font-size: 11px; font-weight: 700; letter-spacing: .04em; }
      .bv-lang-dd-opt.active .bv-badge { background: linear-gradient(135deg,#d85aa3,#B94A8E 45%,#7B4397); color: #fff; border-color: transparent; }
      .bv-lang-dd-opt .bv-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bv-lang-replaced { display: none !important; }
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
    Object.keys(LANG_META).forEach(l => {
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

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }
  function setCookie(name, value, days) {
    const d = new Date(); d.setTime(d.getTime() + days * 86400000);
    // Use parent domain so cookie is shared across burgtv.com, app.burgtv.com, download.burgtv.com
    const host = location.hostname;
    let domain = '';
    if (host.endsWith('.burgtv.com') || host === 'burgtv.com') domain = '; Domain=.burgtv.com';
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + d.toUTCString() + '; path=/' + domain + '; SameSite=Lax';
  }
  function getCurrentLang(buttons) {
    // Cookie has cross-subdomain priority; then localStorage; then DOM lang; then default Italian
    const fromCookie = getCookie('burgtv_lang');
    if (fromCookie && /^(it|en|de|es|fr|pt|tr|nl|pl|ru|ar)$/.test(fromCookie)) return fromCookie;
    for (const [l, btn] of Object.entries(buttons)) {
      if (btn.classList.contains('active')) return l;
    }
    var RE=/^(it|en|de|es|fr|pt|tr|nl|pl|ru|ar)$/;
    var sv = localStorage.getItem('preferredLang') || localStorage.getItem('burgtv_lang'); if(sv && RE.test(sv)) return sv;
    var nv = ((navigator.languages && navigator.languages[0]) || navigator.language || '').slice(0,2).toLowerCase(); if(RE.test(nv)) return nv;
    return 'en';
  }

  function buildDropdown(currentLang) {
    const wrap = document.createElement('div');
    wrap.className = 'bv-lang-dd';
    const meta = LANG_META[currentLang] || LANG_META.it;
    wrap.innerHTML = `
      <button class="bv-lang-dd-trigger" aria-expanded="false" aria-haspopup="listbox" aria-label="Language">
        <svg class="bv-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18 M12 3c2.6 2.7 2.6 15.3 0 18 M12 3c-2.6 2.7-2.6 15.3 0 18"/></svg>
        <span class="bv-code">${meta.code}</span>
        <svg class="bv-chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 4.5L6 8l3.5-3.5"/></svg>
      </button>
      <ul class="bv-lang-dd-menu" role="listbox">
        ${Object.entries(LANG_META).map(([l, m]) => `
          <li class="bv-lang-dd-opt${l === currentLang ? ' active' : ''}" data-lang="${l}" role="option">
            <span class="bv-badge">${m.code}</span>
            <span class="bv-name">${m.name}</span>
          </li>
        `).join('')}
      </ul>
    `;
    return wrap;
  }

  function setActiveInDropdown(wrap, lang) {
    const meta = LANG_META[lang];
    if (!meta) return;
    const code = wrap.querySelector('.bv-lang-dd-trigger .bv-code');
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

    // Read original positioning BEFORE hiding (so getComputedStyle returns true rendered values)
    const cs = window.getComputedStyle(found.container);
    const wasFixed = (cs.position === 'fixed' || cs.position === 'absolute');
    // CRITICAL: capture bounding rect BEFORE hiding — display:none returns 0
    const savedRect = wasFixed ? found.container.getBoundingClientRect() : null;
    const savedPos = wasFixed ? {
      position: cs.position,
      zIndex: cs.zIndex && cs.zIndex !== 'auto' ? cs.zIndex : '1000',
      top: cs.top, right: cs.right, bottom: cs.bottom, left: cs.left
    } : null;

    // Insert dropdown right after the container of old buttons
    found.container.parentElement.insertBefore(dropdown, found.container.nextSibling);

    // Hide the old switcher
    found.container.classList.add('bv-lang-replaced');

    // Apply original positioning to dropdown if original was fixed/absolute
    if (savedPos && savedRect) {
      // Use the rect captured BEFORE hiding (after hide returns 0)
      const fromTop = Math.round(savedRect.top);
      const fromRight = Math.round(window.innerWidth - savedRect.right);
      dropdown.style.position = savedPos.position;
      dropdown.style.zIndex = savedPos.zIndex;
      dropdown.style.top = fromTop + 'px';
      dropdown.style.right = fromRight + 'px';
      dropdown.style.left = 'auto';
      dropdown.style.bottom = 'auto';
      // CRITICAL: shrink wrapper to trigger width — otherwise it inherits the
      // old flex container's width (with 11 hidden buttons inside ~330px) and
      // the menu's right:0 anchors to wrapper-right (far off from trigger).
      dropdown.style.width = 'max-content';
    }

    // Defensive: if dropdown lacks fixed/sticky context, force fixed positioning
    // so it stays at top of viewport during scroll on every page.
    (function ensureStaysOnTopDuringScroll() {
      if (dropdown.style.position === 'fixed' || dropdown.style.position === 'absolute') return;
      let p = dropdown.parentElement;
      while (p && p !== document.body) {
        const pos = window.getComputedStyle(p).position;
        if (pos === 'sticky' || pos === 'fixed') return; // sticky ancestor handles it
        p = p.parentElement;
      }
      // No sticky/fixed ancestor — pin to top-right of viewport
      dropdown.style.position = 'fixed';
      dropdown.style.top = '0.75rem';
      dropdown.style.right = '0.75rem';
      dropdown.style.left = 'auto';
      dropdown.style.bottom = 'auto';
      dropdown.style.zIndex = '1000';
      dropdown.style.width = 'max-content';
    })();
    // Else: dropdown stays inline where the original .lang-switch was (e.g. inside nav)

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
        // Save in cookie for cross-subdomain persistence (burgtv.com → app.burgtv.com → download.burgtv.com)
        setCookie('burgtv_lang', lang, 365);
        try { localStorage.setItem('preferredLang', lang); } catch(e){}
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

    // Observe active class changes on old buttons to sync dropdown + cookie
    const observer = new MutationObserver(() => {
      for (const [l, btn] of Object.entries(found.buttons)) {
        if (btn.classList.contains('active')) {
          setActiveInDropdown(dropdown, l);
          // Also persist any external lang change to cross-subdomain cookie
          if (getCookie('burgtv_lang') !== l) setCookie('burgtv_lang', l, 365);
          break;
        }
      }
    });
    Object.values(found.buttons).forEach(btn => {
      observer.observe(btn, { attributes: true, attributeFilter: ['class'] });
    });

    // On page load: if cookie has a different lang than currently active, trigger the corresponding button
    const savedLang = getCookie('burgtv_lang');
    if (savedLang && /^(it|en|de|es|fr|pt|tr|nl|pl|ru|ar)$/.test(savedLang) && savedLang !== current) {
      const targetBtn = found.buttons[savedLang];
      if (targetBtn) {
        // Defer to allow the page's own setLang to be wired up first
        setTimeout(() => targetBtn.click(), 0);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
