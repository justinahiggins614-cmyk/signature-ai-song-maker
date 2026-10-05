/* ============================================================================
   JAHGodMode — owner-only on-page editor for the 31-site Signature network.
   Version 1.0.0

   WHAT THIS IS
   -----------
   Manon's order: "make my name and Gmail a master controller so can have
   God mode on websites to change. Give me an ai pal to make those changes
   in God mode on each website, if need. So has button when I sign in can
   switch to God Mode to edit stuff." + "Only me as of now can do that each
   website."

   UNLOCK IS TWO STEPS:
     Step 1 (the REAL gate): signed in via Google and the Google-verified
       credential email exactly matches MASTER_EMAIL below. Local profiles
       NEVER get the button; signed-out visitors never see it.
     Step 2 (a second speed bump): a secret unlock code, prompted inside the
       email-verified session when the master taps the God Mode button. Only
       the SHA-256 hex digest of the code is stored in this file — the code
       itself appears nowhere in the repo, logs, or commits. 3 wrong tries
       -> 60-second lockout.

   HONESTY — READ THIS BEFORE SHIPPING
   ------------------------------------
   On static hosting there is no server, so this gate is enforced in the
   visitor's browser. That is the right shape for an OWNER tool (it keeps a
   casual tap out and ties the button to the Google-verified master email),
   not a bank vault: anyone who can read this file can see the digest, and
   client-side checks cannot stop a determined attacker. The Google email
   match remains the real gate; the code is a second speed bump.
   Edits save into the MASTER profile's namespaced localStorage on THIS
   DEVICE only ("Save"). "Export change list" downloads a JSON of every
   change (selector, before, after, page URL, timestamp) to hand to the
   builder, who applies it to the repo permanently. Until exported and
   applied, edits live on this device only — the module docs and the God
   bar say this plainly.

   The AI pal applies SAFE operations only: text/content swaps (textContent,
   never innerHTML — no script injection), style tweaks, show/hide. No
   network calls, no data exfiltration. Every applied change is recorded
   and undoable.

   THEME-SAFE: all God Mode chrome (button, bar, pal panel, unlock dialog)
   uses neutral dark/gold owner styling with jah-god-* ids. Exiting God
   Mode removes every trace; normal visitors never see any of it.

   ES5, zero dependencies. Load AFTER js/signin.js.
   ============================================================================ */
(function (root) {
  'use strict';

  /* ================= 1. CONFIG ================= */
  var MASTER_EMAIL = 'justinahiggins614@gmail.com';

  /* Step-2 unlock code: ONLY the SHA-256 hex digest is stored here.
     The code itself is never written into this file, the repo, logs, or
     commit messages. Verified: digest matches the code Manon chose. */
  var UNLOCK_HASH = '7c75aa4401bae90ee4e30ffb1a81ea99d75097d657741a16662407639a2c8acd';
  var MAX_TRIES = 3;
  var LOCK_MS = 60000;
  var LOCK_KEY = 'jah-godmode-lock-v1';   /* plain localStorage: {tries, until} */
  var EDITS_KEY = 'godmode-edits-v1';     /* via JAHProfile.store (master profile namespace) */
  var SESSION_KEY = 'jah-godmode-unlocked';

  /* ================= 2. SAFE ENVIRONMENT HELPERS ================= */
  function _ls() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
      if (root && root.localStorage) return root.localStorage;
    } catch (e) {}
    return null;
  }
  function _ss() {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) return sessionStorage;
      if (root && root.sessionStorage) return root.sessionStorage;
    } catch (e) {}
    return null;
  }
  function _doc() {
    try {
      if (typeof document !== 'undefined' && document) return document;
      if (root && root.document) return root.document;
    } catch (e) {}
    return null;
  }

  /* ================= 3. SHA-256 (compact, synchronous, ES5) =================
     Standard implementation; verified against the 'abc' test vector in the
     harness. ASCII input only — returns null for non-ASCII. */
  function sha256Hex(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var maxWord = Math.pow(2, 32), i, j;
    var result = '';
    var words = [], bitLen = ascii.length * 8;
    var hash = sha256Hex.h = sha256Hex.h || [];
    var k = sha256Hex.k = sha256Hex.k || [];
    var primeCounter = k.length;
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return null; /* non-ASCII */
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (bitLen / maxWord) | 0;
    words[words.length] = bitLen;
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var t1 = hash[7]
          + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (w[i - 16]
            + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  /* ================= 4. MASTER GATE =================
     Step 1: the Google-verified email on the active profile must exactly
     match MASTER_EMAIL. signin.js stores payload.email on Google-created
     profiles (see its onGoogleCredential patch); local profiles never
     carry an email, so they can never pass. Fail closed: anything missing
     or mismatched -> false. */
  function masterEmail() {
    try {
      if (!root.JAHProfile || typeof root.JAHProfile.current !== 'function') return '';
      var c = root.JAHProfile.current();
      if (!c) return '';
      var e = (c.email != null) ? c.email : '';
      return String(e).toLowerCase().replace(/^\s+|\s+$/g, '');
    } catch (err) { return ''; }
  }
  function isMaster() {
    return masterEmail() === MASTER_EMAIL;
  }

  /* ================= 5. STEP-2 CODE CHECK + LOCKOUT ================= */
  function lockState() {
    var l = _ls(), s = { tries: 0, until: 0 };
    if (!l) return s;
    try {
      var raw = l.getItem(LOCK_KEY);
      if (raw) {
        var v = JSON.parse(raw);
        if (v && typeof v === 'object') {
          s.tries = v.tries | 0;
          s.until = v.until | 0;
        }
      }
    } catch (e) {}
    return s;
  }
  function saveLock(s) {
    var l = _ls();
    if (!l) return;
    try { l.setItem(LOCK_KEY, JSON.stringify({ tries: s.tries | 0, until: s.until | 0 })); } catch (e) {}
  }
  function resetLock() { saveLock({ tries: 0, until: 0 }); }
  function isLocked() {
    var s = lockState();
    if (s.until && Date.now() < s.until) return true;
    if (s.until && Date.now() >= s.until) resetLock(); /* lockout expired */
    return false;
  }
  function _cmp(a, b) { /* simple constant-shape compare */
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    var diff = 0, i;
    for (i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }
  /* Returns {ok} | {ok:false, locked:true} | {ok:false, left:<tries left>} */
  function checkUnlock(code) {
    if (isLocked()) return { ok: false, locked: true };
    var clean = String(code == null ? '' : code).replace(/^\s+|\s+$/g, '');
    var h = sha256Hex(clean);
    if (h && _cmp(h, UNLOCK_HASH)) {
      resetLock();
      return { ok: true };
    }
    var s = lockState();
    s.tries = (s.tries | 0) + 1;
    if (s.tries >= MAX_TRIES) {
      s.until = Date.now() + LOCK_MS;
      s.tries = 0;
      saveLock(s);
      return { ok: false, locked: true };
    }
    saveLock(s);
    return { ok: false, locked: false, left: MAX_TRIES - s.tries };
  }

  /* Session unlock flag (tab session only — the code is asked once per tab). */
  var _unlocked = false;
  (function () {
    try {
      var s = _ss();
      if (s && s.getItem(SESSION_KEY) === '1' && isMaster()) _unlocked = true;
    } catch (e) {}
  })();
  function _setUnlocked(on) {
    _unlocked = !!on;
    try {
      var s = _ss();
      if (!s) return;
      if (on) s.setItem(SESSION_KEY, '1');
      else s.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  /* ================= 6. CHANGE RECORDING ================= */
  var changes = []; /* session change list: {kind,selector,prop,before,after,pageUrl,at} */
  function _pageUrl() {
    try { return (root.location && root.location.href) || ''; } catch (e) { return ''; }
  }
  function record(c) {
    c.pageUrl = _pageUrl();
    c.at = Date.now();
    changes.push(c);
    return c;
  }
  function cssPath(el) {
    var doc = _doc(), parts = [];
    try {
      while (el && el.nodeType === 1 && el !== doc.documentElement && parts.length < 6) {
        var tag = String(el.tagName || '').toLowerCase() || 'el';
        if (el.id && /^[a-zA-Z][\w:.-]*$/.test(el.id) && doc.getElementById(el.id) === el) {
          parts.unshift('#' + el.id);
          break;
        }
        var sib = el, n = 1;
        while ((sib = sib.previousElementSibling)) {
          if (sib.tagName === el.tagName) n++;
        }
        parts.unshift(tag + ':nth-of-type(' + n + ')');
        el = el.parentElement;
      }
    } catch (e) {}
    return parts.length ? parts.join(' > ') : 'body';
  }
  function isGodChrome(el) {
    try {
      if (!el || el.nodeType !== 1) return false;
      if (el.closest) return !!el.closest('#jah-god-bar,#jah-god-pal,#jah-god-unlock,#jah-god-btn');
      var p = el;
      while (p) {
        if (p.id === 'jah-god-bar' || p.id === 'jah-god-pal' || p.id === 'jah-god-unlock' || p.id === 'jah-god-btn') return true;
        p = p.parentElement;
      }
    } catch (e) {}
    return false;
  }
  function findEl(selector) {
    var doc = _doc();
    if (!doc) return null;
    try {
      var el = doc.querySelector(selector);
      return (el && !isGodChrome(el)) ? el : null;
    } catch (e) { return null; }
  }
  function applyChange(c, silent) {
    var el = findEl(c.selector);
    if (!el) return false;
    try {
      if (c.kind === 'text') el.textContent = c.after;
      else if (c.kind === 'style') el.style[c.prop] = c.after;
      else return false;
    } catch (e) { return false; }
    if (!silent) record({ kind: c.kind, selector: c.selector, prop: c.prop || null, before: c.before, after: c.after });
    return true;
  }
  function undoLast() {
    var c = changes.pop();
    if (!c) return 'Nothing to undo.';
    var el = findEl(c.selector);
    if (!el) return 'Could not find the element to undo.';
    try {
      if (c.kind === 'text') el.textContent = c.before;
      else if (c.kind === 'style') el.style[c.prop] = c.before;
    } catch (e) { return 'Undo failed.'; }
    return 'Undone.';
  }

  /* ================= 7. PERSISTENCE (this device, master profile) =================
     Edits live in the master profile's namespaced localStorage on THIS
     DEVICE. They re-apply to the master's view on load. They become
     permanent for everyone only when exported and applied to the repo. */
  function saveEdits() {
    try {
      if (!root.JAHProfile || !root.JAHProfile.store) return false;
      root.JAHProfile.store.set(EDITS_KEY, JSON.stringify({ savedAt: Date.now(), changes: changes }));
      return true;
    } catch (e) { return false; }
  }
  function loadSavedEdits() {
    try {
      if (!isMaster() || !root.JAHProfile || !root.JAHProfile.store) return;
      var raw = root.JAHProfile.store.get(EDITS_KEY);
      if (!raw) return;
      var v = JSON.parse(raw);
      var list = (v && v.changes) || [];
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (!c || !c.selector) continue;
        /* re-apply silently, then adopt into the session list so Undo works */
        var el = findEl(c.selector);
        if (!el) continue;
        try {
          if (c.kind === 'text') el.textContent = c.after;
          else if (c.kind === 'style') el.style[c.prop] = c.after;
          else continue;
          changes.push({ kind: c.kind, selector: c.selector, prop: c.prop || null,
                         before: c.before, after: c.after, pageUrl: c.pageUrl || _pageUrl(), at: c.at || Date.now() });
        } catch (e) {}
      }
    } catch (e) {}
  }

  /* ================= 8. EXPORT ================= */
  function buildExport(list) {
    var out = [];
    var src = list || [];
    for (var i = 0; i < src.length; i++) {
      var c = src[i];
      out.push({
        selector: c.selector,
        kind: c.kind,
        prop: c.prop || null,
        before: c.before,
        after: c.after,
        pageUrl: c.pageUrl,
        at: c.at
      });
    }
    return {
      tool: 'JAH God Mode',
      exportedAt: new Date().toISOString(),
      pageUrl: _pageUrl(),
      note: 'Hand this file to the site builder to apply these edits to the repo permanently. ' +
            'Until applied, they live on this device only.',
      changes: out
    };
  }
  function downloadExport() {
    var doc = _doc();
    if (!doc) return false;
    try {
      var data = JSON.stringify(buildExport(changes), null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var a = doc.createElement('a');
      a.href = (root.URL && root.URL.createObjectURL) ? root.URL.createObjectURL(blob) : 'data:application/json,' + encodeURIComponent(data);
      a.download = 'godmode-changes.json';
      doc.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try {
          if (root.URL && root.URL.revokeObjectURL && a.href.indexOf('blob:') === 0) root.URL.revokeObjectURL(a.href);
          a.remove();
        } catch (e) {}
      }, 800);
      return true;
    } catch (e) { return false; }
  }

  /* ================= 9. AI PAL (safe DOM ops only) =================
     Plain-language commands -> text swaps (textContent, never innerHTML),
     style tweaks, show/hide. No script injection, no network calls. */
  var PAL_COLORS = {
    gold: '#d4af37', red: '#c0392b', blue: '#2471a3', green: '#1e8449',
    black: '#141414', white: '#ffffff', yellow: '#f7dc6f',
    purple: '#7d3c98', orange: '#e67e22', pink: '#f1948a'
  };
  function findByDesc(desc) {
    var doc = _doc();
    var out = [], i, els;
    if (!doc || !doc.querySelectorAll) return out;
    function push(list) {
      for (var i = 0; i < list.length && out.length < 8; i++) {
        if (!isGodChrome(list[i])) out.push(list[i]);
      }
    }
    var d = String(desc || '').toLowerCase().replace(/^\s+|\s+$/g, '').replace(/^(the|a|an)\s+/, '');
    if (!d) return out;
    if (/hero/.test(d) && /title/.test(d)) { els = doc.querySelectorAll('h1'); if (els.length) { push(els); return out; } }
    if (d === 'title' || d === 'page title' || d === 'hero title' || d === 'heading') {
      els = doc.querySelectorAll('h1'); push(els); return out;
    }
    if (/button/.test(d)) { push(doc.querySelectorAll('button')); return out; }
    if (/^(header|footer|nav|main)$/.test(d)) { push(doc.querySelectorAll(d)); return out; }
    if (/banner|promo/.test(d)) {
      els = doc.querySelectorAll('[class*="promo"],[class*="banner"],[id*="promo"],[id*="banner"]');
      push(els);
      if (out.length) return out;
    }
    try { els = doc.querySelectorAll(d); push(els); } catch (e) {}
    if (out.length) return out;
    var words = d.split(/[^a-z0-9]+/);
    var keep = [];
    for (i = 0; i < words.length; i++) { if (words[i].length > 2) keep.push(words[i]); }
    if (keep.length) {
      els = doc.querySelectorAll('h1,h2,h3,h4,p,li,span');
      for (i = 0; i < els.length && out.length < 8; i++) {
        var txt = String(els[i].textContent || '').toLowerCase();
        var hit = true, k;
        for (k = 0; k < keep.length; k++) {
          if (txt.indexOf(keep[k]) < 0) { hit = false; break; }
        }
        if (hit && !isGodChrome(els[i])) out.push(els[i]);
      }
    }
    return out;
  }
  function palApply(text) {
    var t = String(text == null ? '' : text).replace(/^\s+|\s+$/g, '');
    if (!t) return { ok: false, msg: 'Tell me what to change.' };
    var m, i, els, sel;
    if ((m = t.match(/^hide\s+(.+)$/i))) {
      els = findByDesc(m[1]);
      if (!els.length) return { ok: false, msg: 'Could not find "' + m[1] + '".' };
      for (i = 0; i < els.length; i++) {
        sel = cssPath(els[i]);
        record({ kind: 'style', selector: sel, prop: 'display', before: els[i].style.display || '', after: 'none' });
        els[i].style.display = 'none';
      }
      return { ok: true, msg: 'Hidden ' + els.length + ' element(s).' };
    }
    if ((m = t.match(/^(?:show|unhide)\s+(.+)$/i))) {
      els = findByDesc(m[1]);
      if (!els.length) return { ok: false, msg: 'Could not find "' + m[1] + '".' };
      for (i = 0; i < els.length; i++) {
        sel = cssPath(els[i]);
        record({ kind: 'style', selector: sel, prop: 'display', before: els[i].style.display || '', after: '' });
        els[i].style.display = '';
      }
      return { ok: true, msg: 'Shown ' + els.length + ' element(s).' };
    }
    if ((m = t.match(/^(?:make|set|change)\s+(.+?)\s+(?:say|read|to)\s+["']?(.+?)["']?$/i))) {
      els = findByDesc(m[1]);
      if (!els.length) return { ok: false, msg: 'Could not find "' + m[1] + '".' };
      for (i = 0; i < els.length; i++) {
        sel = cssPath(els[i]);
        record({ kind: 'text', selector: sel, prop: null, before: els[i].textContent, after: m[2] });
        els[i].textContent = m[2]; /* textContent only — never innerHTML */
      }
      return { ok: true, msg: 'Updated ' + els.length + ' element(s).' };
    }
    if ((m = t.match(/^(?:make|turn)\s+(.+?)\s+(gold|red|blue|green|black|white|yellow|purple|orange|pink)$/i))) {
      els = findByDesc(m[1]);
      if (!els.length) return { ok: false, msg: 'Could not find "' + m[1] + '".' };
      var hex = PAL_COLORS[m[2].toLowerCase()];
      for (i = 0; i < els.length; i++) {
        sel = cssPath(els[i]);
        record({ kind: 'style', selector: sel, prop: 'backgroundColor', before: els[i].style.backgroundColor || '', after: hex });
        els[i].style.backgroundColor = hex;
      }
      return { ok: true, msg: 'Recolored ' + els.length + ' element(s).' };
    }
    return { ok: false, msg: 'Try: "hide the promo banner" · "make the hero title say Hello" · "make all buttons gold" · "show the banner".' };
  }

  /* ================= 10. GOD MODE CHROME (neutral dark/gold, theme-safe) ================= */
  var _godOn = false;
  var GOD_BAR_CSS = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;' +
    'background:#141414;color:#f5f5f5;border-top:2px solid #d4af37;' +
    'font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13px;' +
    'padding:8px 10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;';
  var GOD_BTN_CSS = 'display:inline-flex;align-items:center;gap:6px;' +
    'border:1px solid #d4af37;border-radius:999px;background:#1a1a1a;color:#f3d27a;' +
    'font:700 12px/1.4 system-ui,sans-serif;padding:6px 14px;cursor:pointer;white-space:nowrap;';
  var GOD_ACTION_CSS = 'border:1px solid #d4af37;border-radius:8px;background:#222;color:#f3d27a;' +
    'font:600 12px/1.2 system-ui,sans-serif;padding:8px 12px;cursor:pointer;min-height:36px;';

  function el(tag, css, text) {
    var doc = _doc();
    var e = doc.createElement(tag);
    if (css) e.setAttribute('style', css);
    if (text != null) e.textContent = text;
    return e;
  }
  function palSay(msg, good) {
    var doc = _doc();
    var s = doc.getElementById('jah-god-palmsg');
    if (!s) return;
    s.textContent = msg;
    s.style.color = good ? '#9fe6a0' : '#f3d27a';
  }

  function openUnlockDialog() {
    var doc = _doc();
    if (!doc || doc.getElementById('jah-god-unlock')) return;
    if (isLocked()) {
      openUnlockDialogLocked();
      return;
    }
    var ov = el('div', 'position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.6);' +
      'display:flex;align-items:center;justify-content:center;padding:16px;');
    ov.id = 'jah-god-unlock';
    var box = el('div', 'background:#1a1a1a;color:#f5f5f5;border:2px solid #d4af37;border-radius:14px;' +
      'padding:22px;width:320px;max-width:100%;font-family:system-ui,sans-serif;');
    box.appendChild(el('div', 'font-size:16px;font-weight:800;color:#f3d27a;margin-bottom:6px;', '\u26A1 God Mode unlock'));
    box.appendChild(el('div', 'font-size:12px;color:#bbb;margin-bottom:12px;line-height:1.5;',
      'Second step: enter your unlock code.'));
    var inp = el('input', 'width:100%;box-sizing:border-box;padding:10px;border-radius:8px;' +
      'border:1px solid #d4af37;background:#0d0d0d;color:#fff;font-size:15px;margin-bottom:10px;');
    inp.id = 'jah-god-code';
    inp.type = 'password';
    inp.setAttribute('placeholder', 'Unlock code');
    inp.setAttribute('autocomplete', 'off');
    box.appendChild(inp);
    var msg = el('div', 'font-size:12px;min-height:18px;margin-bottom:10px;color:#f3d27a;');
    msg.id = 'jah-god-unlockmsg';
    box.appendChild(msg);
    var row = el('div', 'display:flex;gap:8px;');
    var ok = el('button', GOD_ACTION_CSS + 'flex:1;', 'Unlock');
    ok.type = 'button';
    var cancel = el('button', GOD_ACTION_CSS + 'flex:1;background:#333;', 'Cancel');
    cancel.type = 'button';
    row.appendChild(ok);
    row.appendChild(cancel);
    box.appendChild(row);
    ov.appendChild(box);
    function close() { try { ov.remove(); } catch (e) {} }
    function attempt() {
      var r = checkUnlock(inp.value);
      if (r.ok) {
        _setUnlocked(true);
        close();
        engageGod();
        return;
      }
      if (r.locked) {
        msg.textContent = 'Too many wrong tries — locked for 60 seconds.';
        msg.style.color = '#ff9d9d';
        setTimeout(close, 1200);
        return;
      }
      msg.textContent = 'Wrong code (' + r.left + ' ' + (r.left === 1 ? 'try' : 'tries') + ' left).';
      msg.style.color = '#ff9d9d';
      inp.value = '';
      try { inp.focus(); } catch (e) {}
    }
    ok.addEventListener('click', attempt);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') attempt(); });
    cancel.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    doc.body.appendChild(ov);
    try { inp.focus(); } catch (e) {}
  }
  function openUnlockDialogLocked() {
    var doc = _doc();
    if (!doc || doc.getElementById('jah-god-unlock')) return;
    var ov = el('div', 'position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.6);' +
      'display:flex;align-items:center;justify-content:center;padding:16px;');
    ov.id = 'jah-god-unlock';
    var box = el('div', 'background:#1a1a1a;color:#f5f5f5;border:2px solid #d4af37;border-radius:14px;padding:22px;width:300px;max-width:100%;font-family:system-ui,sans-serif;text-align:center;');
    box.appendChild(el('div', 'font-size:15px;font-weight:800;color:#f3d27a;margin-bottom:8px;', '\u26A1 Locked'));
    box.appendChild(el('div', 'font-size:13px;color:#bbb;line-height:1.5;', 'Too many wrong tries. Wait 60 seconds, then tap the God Mode button again.'));
    var ok = el('button', GOD_ACTION_CSS + 'margin-top:14px;', 'OK');
    ok.type = 'button';
    ok.addEventListener('click', function () { try { ov.remove(); } catch (e) {} });
    box.appendChild(ok);
    ov.appendChild(box);
    doc.body.appendChild(ov);
  }

  /* ---- click-any-text-to-edit ---- */
  var TEXT_TAGS = /^(P|H1|H2|H3|H4|H5|H6|LI|SPAN|A|TD|TH|BLOCKQUOTE|FIGCAPTION|DIV)$/;
  function closestText(t) {
    try {
      while (t && t.nodeType === 1) {
        if (isGodChrome(t)) return null;
        var tag = t.tagName;
        if (TEXT_TAGS.test(tag) && tag !== 'BUTTON' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return t;
        t = t.parentElement;
      }
    } catch (e) {}
    return null;
  }
  function godClick(e) {
    if (!_godOn) return;
    var t = e.target;
    if (isGodChrome(t)) return;
    var tgt = closestText(t);
    if (!tgt) return;
    try {
      e.preventDefault();
      e.stopPropagation();
      if (tgt.isContentEditable) return;
      var before = tgt.textContent;
      var sel = cssPath(tgt);
      tgt.contentEditable = 'true';
      tgt.setAttribute('data-jah-god-editable', '1');
      tgt.focus();
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        try {
          tgt.contentEditable = 'false';
          tgt.removeAttribute('data-jah-god-editable');
          if (tgt.textContent !== before) {
            record({ kind: 'text', selector: sel, prop: null, before: before, after: tgt.textContent });
            palSay('Edited. Undo is available.', true);
          }
        } catch (err) {}
      }
      tgt.addEventListener('blur', finish);
      tgt.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); tgt.blur(); }
        if (ev.key === 'Escape') { tgt.textContent = before; tgt.blur(); }
      });
    } catch (err) {}
  }

  function engageGod() {
    var doc = _doc();
    if (!doc || _godOn) return;
    if (!isMaster() || !_unlocked) return; /* both steps required */
    _godOn = true;
    if (doc.getElementById('jah-god-bar')) return;
    var bar = el('div', GOD_BAR_CSS);
    bar.id = 'jah-god-bar';
    bar.appendChild(el('span', 'font-weight:800;color:#f3d27a;white-space:nowrap;', '\u26A1 GOD MODE'));
    var inp = el('input', 'flex:1;min-width:160px;padding:8px 10px;border-radius:8px;border:1px solid #d4af37;' +
      'background:#0d0d0d;color:#fff;font-size:13px;');
    inp.id = 'jah-god-pal';
    inp.type = 'text';
    inp.setAttribute('placeholder', 'AI pal: "hide the promo banner" · "make the hero title say Hello" · "make all buttons gold"');
    inp.setAttribute('aria-label', 'God Mode AI pal command');
    bar.appendChild(inp);
    function mkBtn(label, fn) {
      var b = el('button', GOD_ACTION_CSS, label);
      b.type = 'button';
      b.addEventListener('click', fn);
      bar.appendChild(b);
      return b;
    }
    mkBtn('Apply', function () {
      var r = palApply(inp.value);
      palSay(r.msg, r.ok);
      inp.value = '';
    });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var r = palApply(inp.value);
        palSay(r.msg, r.ok);
        inp.value = '';
      }
    });
    mkBtn('Undo', function () { palSay(undoLast(), true); });
    mkBtn('Save', function () {
      var ok = saveEdits();
      palSay(ok ? 'Saved on this device (master profile).' : 'Save failed.', ok);
    });
    mkBtn('Export', function () {
      palSay(downloadExport() ? 'Change list downloaded — hand it to the builder to apply permanently.' : 'Export failed.', true);
    });
    mkBtn('Exit', exitGod);
    var msg = el('span', 'flex-basis:100%;font-size:11px;color:#bbb;', 'Edits live on this device until exported and applied to the repo.');
    msg.id = 'jah-god-palmsg';
    bar.appendChild(msg);
    doc.body.appendChild(bar);
    doc.addEventListener('click', godClick, true);
    palSay('God Mode on. Click any text to edit it, or tell the AI pal what to change.', true);
  }

  function exitGod() {
    var doc = _doc();
    _godOn = false;
    try {
      if (doc) {
        doc.removeEventListener('click', godClick, true);
        var bar = doc.getElementById('jah-god-bar');
        if (bar) bar.remove();
        var ov = doc.getElementById('jah-god-unlock');
        if (ov) ov.remove();
        var eds = doc.querySelectorAll('[data-jah-god-editable]');
        for (var i = 0; i < eds.length; i++) {
          try {
            eds[i].contentEditable = 'false';
            eds[i].removeAttribute('data-jah-god-editable');
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  /* ================= 11. HEADER BUTTON (master only) ================= */
  function renderButton(mount) {
    var doc = _doc();
    if (!doc || !mount || !mount.appendChild) return null;
    if (!isMaster()) return null; /* fail closed: nobody else ever sees it */
    var existing = doc.getElementById('jah-god-btn');
    if (existing) return existing;
    var btn = el('button', GOD_BTN_CSS, '\u26A1 God Mode');
    btn.id = 'jah-god-btn';
    btn.type = 'button';
    btn.title = 'Owner editing mode';
    btn.addEventListener('click', function () {
      if (isLocked()) { openUnlockDialogLocked(); return; }
      if (!_unlocked) { openUnlockDialog(); return; }
      if (_godOn) exitGod();
      else engageGod();
    });
    mount.appendChild(btn);
    return btn;
  }

  /* ================= 12. BOOT ================= */
  function boot() {
    try {
      /* Re-apply the master's saved device-local edits to his own view. */
      loadSavedEdits();
      /* Auto-mount the button for the master (pages only add the script tag). */
      if (isMaster()) {
        var doc = _doc();
        if (doc && !doc.getElementById('jah-god-btn')) {
          var mount = doc.querySelector('header') || doc.body;
          if (mount) renderButton(mount);
        }
      }
    } catch (e) {}
  }
  (function () {
    var doc = _doc();
    if (!doc) return;
    try {
      if (doc.readyState === 'complete' || doc.readyState === 'interactive') boot();
      else if (doc.addEventListener) doc.addEventListener('DOMContentLoaded', boot);
      else boot();
    } catch (e) {}
  })();

  /* ================= 13. EXPORT ================= */
  var JAHGodMode = {
    version: '1.0.0',
    masterEmail: MASTER_EMAIL,
    isMaster: isMaster,
    isUnlocked: function () { return _unlocked; },
    isGodOn: function () { return _godOn; },
    isLocked: isLocked,
    renderButton: renderButton,
    engage: engageGod,
    exit: exitGod,
    palApply: palApply,
    undo: undoLast,
    save: saveEdits,
    exportChanges: function () { return buildExport(changes); },
    _internals: {
      sha256Hex: sha256Hex,
      checkUnlock: checkUnlock,
      resetLock: resetLock,
      buildExport: buildExport,
      cssPath: cssPath,
      findByDesc: findByDesc
    }
  };
  root.JAHGodMode = JAHGodMode;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
