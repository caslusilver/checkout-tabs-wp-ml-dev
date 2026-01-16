(function () {
  'use strict';

  var cfg = window.CTWPMLSplashConfig || null;
  if (!cfg || !cfg.durationMs) return;

  try {
    // Exibir só no primeiro load por sessão (evita atrapalhar navegação)
    if (window.sessionStorage && sessionStorage.getItem('ctwpml_splash_seen') === '1') return;
  } catch (e0) {}

  // Liga a splash o mais cedo possível (CSS controla a exibição)
  try {
    document.documentElement.classList.add('ctwpml-splash-on');
  } catch (e0a) {}

  function safeNumber(n, fallback) {
    n = Number(n);
    return isFinite(n) ? n : fallback;
  }

  function ensureSplash() {
    var existing = document.getElementById('ctwpml-splash');
    if (existing) return existing;

    var el = document.createElement('div');
    el.id = 'ctwpml-splash';
    el.setAttribute('aria-hidden', 'true');
    el.style.background = String(cfg.bg || '#ffdb15');

    var inner = document.createElement('div');
    inner.className = 'ctwpml-splash-inner';

    if (cfg.imageUrl) {
      var img = document.createElement('img');
      img.className = 'ctwpml-splash-image';
      img.src = String(cfg.imageUrl);
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      inner.appendChild(img);
    }

    if (cfg.textEnabled && cfg.text) {
      var p = document.createElement('p');
      p.className = 'ctwpml-splash-text';
      p.style.color = String(cfg.textColor || '#111111');
      p.style.fontFamily = String(cfg.textFont || 'Arial');
      p.style.marginTop = safeNumber(cfg.textGapPx, 12) + 'px';
      p.textContent = cfg.textTyping ? '' : String(cfg.text);
      inner.appendChild(p);
      el.__ctwpmlTextEl = p;
    }

    el.appendChild(inner);
    document.body.appendChild(el);
    return el;
  }

  function typeText(el, text, totalMs) {
    if (!el || !text) return;
    var s = String(text);
    var i = 0;
    var perChar = Math.max(12, Math.floor(totalMs / Math.max(10, s.length)));
    var t = setInterval(function () {
      i++;
      el.textContent = s.slice(0, i);
      if (i >= s.length) clearInterval(t);
    }, perChar);
    return t;
  }

  function closeSplash(el) {
    try {
      document.documentElement.classList.remove('ctwpml-splash-on');
    } catch (e0c) {}
    try {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    } catch (e1) {}
    try {
      if (window.sessionStorage) sessionStorage.setItem('ctwpml_splash_seen', '1');
    } catch (e2) {}
  }

  function show() {
    var el = ensureSplash();

    // Aplica background também no elemento já renderizado (garante consistência)
    try {
      el.style.background = String(cfg.bg || '#ffdb15');
    } catch (eBg) {}

    if (cfg.textTyping && el.__ctwpmlTextEl && cfg.text) {
      typeText(el.__ctwpmlTextEl, cfg.text, Math.min(900, safeNumber(cfg.durationMs, 1200)));
    }

    var duration = safeNumber(cfg.durationMs, 1200);
    var started = false;

    function startTimerOnce() {
      if (started) return;
      started = true;
      setTimeout(function () {
        closeSplash(el);
      }, duration);
    }

    // iOS: esperar o asset (animated webp/gif) começar a carregar antes de iniciar o timer.
    // Fallback: inicia o timer após 600ms caso o load demore.
    try {
      var img = el.querySelector ? el.querySelector('.ctwpml-splash-image') : null;
      if (img && img.complete) {
        startTimerOnce();
      } else if (img) {
        img.addEventListener('load', startTimerOnce, { once: true });
        img.addEventListener('error', startTimerOnce, { once: true });
        setTimeout(startTimerOnce, 600);
      } else {
        startTimerOnce();
      }
    } catch (eImg) {
      startTimerOnce();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', show);
  } else {
    show();
  }
})();

