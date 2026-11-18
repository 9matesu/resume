// resuMe landing — texto caindo, escrita no scroll, hijack e ironia no hover.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- intro */
  var intro = document.getElementById('intro');
  if (intro) {
    window.setTimeout(function () {
      if (intro.parentNode) intro.parentNode.removeChild(intro);
    }, 2400);
  }

  /* -------------------------------------------------------------- reveal */
  var revealEls = [].slice.call(document.querySelectorAll('.reveal'));
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ----------------------------------------------------- split [data-split] */
  function splitWords(el) {
    if (el.getAttribute('data-split-done') === '1') return;
    el.setAttribute('data-split-done', '1');
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    var index = 0;
    nodes.forEach(function (node) {
      var text = node.textContent;
      if (!text || !text.trim()) return;
      var frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        var span = document.createElement('span');
        span.className = 'word';
        span.style.setProperty('--i', index);
        index += 1;
        span.textContent = part;
        frag.appendChild(span);
      });
      if (node.parentNode) node.parentNode.replaceChild(frag, node);
    });
  }
  [].slice.call(document.querySelectorAll('[data-split]')).forEach(splitWords);

  /* ------------------------------------------------------ escrita no scroll */
  function splitWrite(el) {
    if (el.getAttribute('data-write-done') === '1') return;
    el.setAttribute('data-write-done', '1');
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.textContent;
      if (!text || !text.trim()) return;
      var frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        var span = document.createElement('span');
        span.className = 'w';
        span.textContent = part;
        frag.appendChild(span);
      });
      if (node.parentNode) node.parentNode.replaceChild(frag, node);
    });
  }

  var writeEls = [].slice.call(document.querySelectorAll('[data-write]'));
  writeEls.forEach(splitWrite);

  function paintWrite() {
    var vh = window.innerHeight;
    writeEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) return;
      var start = vh * 0.92;
      var end = vh * 0.3;
      var p = (start - r.top) / Math.max(1, start - end);
      p = Math.max(0, Math.min(1, p));
      var list = el.querySelectorAll('.w');
      var n = list.length;
      for (var i = 0; i < n; i++) {
        var wp = Math.max(0, Math.min(1, p * (n + 3) - i));
        list[i].style.opacity = (0.18 + 0.82 * wp).toFixed(3);
      }
    });
  }

  /* --------------------------------------------------------- hero rotator */
  var PHRASES = [
    [{ t: 'Seu' }, { t: 'currículo' }, { t: 'já' }, { t: 'devia' }, { t: 'estar' }, { t: 'pronto', em: true }],
    [{ t: 'Cada' }, { t: 'vaga' }, { t: 'pede' }, { t: 'um' }, { t: 'currículo' }, { t: 'diferente?', em: true }],
    [{ t: 'Reescrever' }, { t: 'para' }, { t: 'cada' }, { t: 'vaga' }, { t: 'já' }, { t: 'é' }, { t: 'o' }, { t: 'trabalho?', em: true }],
    [{ t: 'O' }, { t: 'mercado' }, { t: 'chama' }, { t: 'isso' }, { t: 'de' }, { t: '“processo seletivo”?', em: true }],
    [{ t: 'O' }, { t: 'resuMe', em: true }, { t: 'faz' }, { t: 'essa' }, { t: 'parte' }]
  ];

  function buildPhrase(words) {
    var el = document.createElement('span');
    el.className = 'rot-phrase';
    words.forEach(function (w, i) {
      var span = document.createElement('span');
      span.className = 'word' + (w.em ? ' word--em' : '');
      span.style.setProperty('--i', i);
      span.textContent = w.t;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return el;
  }

  var rot = document.getElementById('hero-rot');
  if (rot) {
    rot.innerHTML = '';
    var phrases = PHRASES.map(buildPhrase);
    phrases.forEach(function (p, i) {
      if (i === 0) p.classList.add('is-active');
      rot.appendChild(p);
    });

    if (!reduce) {
      var idx = 0;
      window.setInterval(function () {
        if (document.hidden) return;
        var cur = phrases[idx];
        var next = (idx + 1) % phrases.length;
        var nxt = phrases[next];
        if (!cur || !nxt) return;
        cur.classList.remove('is-active');
        cur.classList.add('is-leaving');
        nxt.classList.remove('is-leaving');
        void nxt.offsetWidth;
        nxt.classList.add('is-active');
        window.setTimeout(function () { cur.classList.remove('is-leaving'); }, 720);
        idx = next;
      }, 3200);
    }
  }

  /* --------------------------------------------------------- scroll hijack */
  var sections = [].slice.call(document.querySelectorAll('[data-section]'));
  var dotsWrap = document.getElementById('dots');
  var pgNum = document.getElementById('pg-num');
  var pgTotal = document.getElementById('pg-total');
  var bar = document.querySelector('.progress');
  var current = 0;
  var locked = false;
  var scrollRaf = 0;
  var wheelAcc = 0;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  if (pgTotal && sections.length) pgTotal.textContent = pad(sections.length);

  function paintDots() {
    if (dotsWrap) {
      [].slice.call(dotsWrap.children).forEach(function (d, i) {
        d.classList.toggle('is-active', i === current);
      });
    }
    if (pgNum) pgNum.textContent = pad(current + 1);
  }

  function paintHeader() {
    var probe = 90;
    var theme = 'light';
    for (var i = 0; i < sections.length; i++) {
      var r = sections[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) {
        theme = sections[i].getAttribute('data-header') ||
          (sections[i].getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
        break;
      }
    }
    document.body.setAttribute('data-theme', theme);
  }

  function onScroll() {
    var el = document.documentElement;
    var max = el.scrollHeight - el.clientHeight;
    var p = max > 0 ? el.scrollTop / max : 0;
    if (bar) bar.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(2) + '%';

    if (!locked && sections.length) {
      var probe = 90;
      var idx = 0;
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= probe) idx = i;
      }
      if (idx !== current) {
        current = idx;
        paintDots();
      }
    }
    paintHeader();
    paintWrite();
  }

  function animateScrollTo(top, dur) {
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    var from = window.pageYOffset;
    var delta = top - from;
    if (Math.abs(delta) < 2) {
      window.scrollTo(0, top);
      locked = false;
      onScroll();
      return;
    }
    var start = performance.now();
    var d = dur || 760;
    locked = true;
    function tick(now) {
      var p = Math.min(1, (now - start) / d);
      var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      window.scrollTo(0, from + delta * e);
      if (p < 1) {
        scrollRaf = requestAnimationFrame(tick);
      } else {
        scrollRaf = 0;
        window.scrollTo(0, top);
        locked = false;
        onScroll();
      }
    }
    scrollRaf = requestAnimationFrame(tick);
  }

  function goTo(i) {
    if (!sections.length) return;
    i = Math.max(0, Math.min(sections.length - 1, i));
    var top = sections[i].getBoundingClientRect().top + window.pageYOffset;
    if (Math.abs(window.pageYOffset - top) < 4) {
      current = i;
      paintDots();
      return;
    }
    current = i;
    paintDots();
    if (reduce) {
      window.scrollTo(0, top);
      onScroll();
      return;
    }
    animateScrollTo(top, 760);
  }

  if (dotsWrap) {
    sections.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot';
      b.setAttribute('aria-label', 'Ir para a seção ' + (i + 1));
      b.addEventListener('click', function () { goTo(i); });
      dotsWrap.appendChild(b);
    });
  }

  function inScrollable(target) {
    return !!(target && target.closest &&
      target.closest('dialog, .faq, .flow-list, .package, .tips, .manifesto-cols'));
  }

  function normalizeWheel(e) {
    var d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (e.deltaMode === 1) d *= 16;
    else if (e.deltaMode === 2) d *= window.innerHeight;
    return d;
  }

  window.addEventListener('wheel', function (e) {
    if (reduce || !sections.length) return;
    if (inScrollable(e.target)) return;

    var delta = normalizeWheel(e);
    if (Math.abs(delta) < 2) return;
    var dir = delta > 0 ? 1 : -1;

    var r = sections[current].getBoundingClientRect();
    if (dir > 0 && r.bottom > window.innerHeight + 6) { wheelAcc = 0; return; }
    if (dir < 0 && r.top < -6) { wheelAcc = 0; return; }

    if (dir > 0 && current >= sections.length - 1) return;
    if (dir < 0 && current <= 0) return;

    if (locked) {
      e.preventDefault();
      wheelAcc = 0;
      return;
    }
    e.preventDefault();
    wheelAcc += delta;
    if (Math.abs(wheelAcc) < 60) return;

    var d = wheelAcc > 0 ? 1 : -1;
    wheelAcc = 0;
    goTo(current + d);
  }, { passive: false });

  /* teclado: setas, PageUp/Down, Home/End */
  window.addEventListener('keydown', function (e) {
    if (!sections.length) return;
    if (e.target.closest && e.target.closest('input, textarea, select, dialog')) return;
    if (e.key === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(sections.length - 1);
    } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      if (current < sections.length - 1) {
        e.preventDefault();
        goTo(current + 1);
      }
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      if (current > 0) {
        e.preventDefault();
        goTo(current - 1);
      }
    }
  });

  /* toque: swipe nas bordas da seção */
  var touchY = null;
  window.addEventListener('touchstart', function (e) {
    if (!sections.length) return;
    if (e.touches.length !== 1) { touchY = null; return; }
    if (inScrollable(e.target)) { touchY = null; return; }
    touchY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchend', function (e) {
    if (touchY == null || !e.changedTouches.length) { touchY = null; return; }
    var dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(dy) < 70) return;
    var dir = dy > 0 ? 1 : -1;
    if (dir > 0 && current >= sections.length - 1) return;
    if (dir < 0 && current <= 0) return;
    var r = sections[current].getBoundingClientRect();
    if (dir > 0 && r.bottom > window.innerHeight + 6) return;
    if (dir < 0 && r.top < -6) return;
    if (locked) return;
    goTo(current + dir);
  }, { passive: true });

  /* links internos usam o mesmo hijack */
  [].slice.call(document.querySelectorAll('a[href^="#"]')).forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href');
      if (!href || href === '#') return;
      var target = document.getElementById(href.slice(1));
      if (!target) return;
      var sec = target.closest('[data-section]');
      if (sec) {
        e.preventDefault();
        var idx = sections.indexOf(sec);
        if (idx >= 0) goTo(idx);
      }
    });
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { onScroll(); });
  onScroll();
  paintDots();

  /* ------------------------------------------------------------- how-to */
  var dlg = document.getElementById('howto');
  [].slice.call(document.querySelectorAll('.install-cta')).forEach(function (a) {
    a.addEventListener('click', function () {
      if (dlg) dlg.showModal();
    });
  });
})();