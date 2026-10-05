/* ============================================================================
   JAHProfile — shared sign-in / device-profile module
   for the 31-site Signature network.  Version 2.0.0

   WHAT THIS IS
   -----------
   Optional on-device profiles. Manon's order: "Make so user can sign in or
   sign in with google and such so to use user information and fresh start
   for everyone and only need to train once. Otherwise default is how is
   now where keeps teaching you and on public version."

   - Default (signed out / public): EVERYTHING works exactly as it does
     today. Storage keys pass through unprefixed; chat memory keeps the
     existing 24h expiry. Zero behavior change.
   - Signed in (profile active): storage keys are namespaced per profile,
     so each person gets a fresh start; chat memory never expires
     ("train once").

   v2.0.0 — ONE ACCOUNT, ALL SITES: jah-profiles-v1 / jah-profile-active-v1
   are origin-level localStorage keys, so all 31 github.io sites share ONE
   profile list and ONE active profile — sign in once, signed in everywhere.
   Site data keys are namespaced per profile AND per site
   (jah-profile-<id>:<site>:<key>) so sites never clobber each other's data;
   chat memory is namespaced per profile only (jah-profile-<id>:<base>) so a
   user's AI training follows them across the whole network.
   MIRROR TOGGLE: signed-in users get a visible "My view / Signature view"
   switch in the header on every page — Signature view is the standard site
   exactly as-is (the default, and all a signed-out visitor ever sees); My
   view is the personalized version (opt-in "Make it mine": greeted by name,
   your stuff first, the AI addresses you personally). The toggle is visible
   in both views and keeps the user's place on the page.
   ADDITIVE ONLY (Manon's explicit constraint): My view must NEVER hide,
   remove, or truncate a site's archive/catalog/A-Z — personalization puts
   the user's own items FIRST; the full archive stays complete and reachable
   in BOTH views. The mirror is additive, never a replacement.

   HONESTY — READ THIS BEFORE SHIPPING
   ------------------------------------
   A profile lives ONLY in this browser's localStorage, on THIS DEVICE.
   There is NO account, NO server, NO cloud sync, and this module NEVER
   sends profile data anywhere (the only network call in the entire file
   is loading Google's own sign-in script, and only when a Google client
   ID has been pasted in). Never claim sync. Never promise a server.
   The in-dialog copy says it plainly:
       "Your profile lives on this device. No account, no cloud sync."

   ES5, zero dependencies. Safe to include before or after other scripts.
   ============================================================================ */
(function (root) {
  'use strict';

  /* ================= 1. CONFIG =================
     GOOGLE ONE-STEP (for Manon):
     Get a free Web OAuth client ID at:
       Google Cloud Console -> APIs & Services -> Credentials
       -> Create Credentials -> OAuth client ID -> Web application
     Add your site origin (e.g. https://justinahiggins614-cmyk.github.io)
     to "Authorized JavaScript origins", then paste the client ID between
     the quotes below. The official "Sign in with Google" button then
     appears in the profile dialog automatically.
     Leave it empty and everything works locally; the Google button stays
     hidden and no Google script is ever loaded. */
  var GOOGLE_CLIENT_ID = "967916753695-gudocn7gavc57c2d9udacjlnkuhnq427.apps.googleusercontent.com";

  var PROFILES_KEY = 'jah-profiles-v1';       /* localStorage: [{id,name,color,created,picture}] */
  var ACTIVE_KEY = 'jah-profile-active-v1';   /* localStorage: active profile id, or "" = public */
  var PROFILE_NS_PREFIX = 'jah-profile-';     /* namespaced storage keys look like jah-profile-<id>:<key> */
  var PUBLIC_CHAT_TTL = 24 * 3600 * 1000;     /* 24h, matches GuideTalk v2.1 default */

  /* Site id for per-site data namespacing (first URL path segment, e.g.
     "jah-ai-models"). Signed-in storage keys are
     jah-profile-<id>:<site>:<key> so sites on the shared origin never
     clobber each other's data under one profile. Public keys stay
     unprefixed (today's behavior, byte-identical). */
  var SITE_ID = (function () {
    try {
      var segs = String((root.location && root.location.pathname) || '').split('/');
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i].replace(/[^a-z0-9-]/gi, '').toLowerCase();
        if (s) return s.slice(0, 40);
      }
    } catch (e) {}
    return 'site';
  })();

  /* Scroll restore: the mirror toggle saves scrollY before reloading so the
     user keeps their place on the page. Runs once at load. */
  (function () {
    var y = null;
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) {
        y = sessionStorage.getItem('jah-scroll-restore');
        if (y != null) sessionStorage.removeItem('jah-scroll-restore');
      }
    } catch (e) { y = null; }
    if (y == null) return;
    var yy = parseInt(y, 10);
    if (isNaN(yy)) return;
    function go() { try { if (root.scrollTo) root.scrollTo(0, yy); } catch (e) {} }
    try {
      var d = _doc();
      if (d && d.readyState === 'complete') go();
      else if (root.addEventListener) root.addEventListener('load', go);
      else go();
    } catch (e) {}
  })();
  function _saveScroll() {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage && root.scrollY != null) {
        sessionStorage.setItem('jah-scroll-restore', String(root.scrollY | 0));
      }
    } catch (e) {}
  }

  /* Provider registry — "and such". Each provider has the same shape:
       { label, enabled(), renderButton(containerEl), handleCredential(resp) }
     Apple / Facebook plug in here later with no changes to the core. */
  var PROVIDERS = {
    google: {
      label: 'Google',
      enabled: googleEnabled,
      renderButton: renderGoogleButton,
      handleCredential: onGoogleCredential
    }
    /* Future providers (stubs — same shape):
    ,
    apple:    { label: 'Apple',    enabled: function () { return false; }, renderButton: null, handleCredential: null },
    facebook: { label: 'Facebook', enabled: function () { return false; }, renderButton: null, handleCredential: null }
    */
  };

  /* ================= 2. SAFE ENVIRONMENT HELPERS ================= */
  function _ls() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
      if (root && root.localStorage) return root.localStorage;
    } catch (e) { /* private mode / unavailable */ }
    return null;
  }
  function _doc() {
    try {
      if (typeof document !== 'undefined' && document) return document;
      if (root && root.document) return root.document;
    } catch (e) {}
    return null;
  }
  function _readJSON(key, fallback) {
    var l = _ls();
    if (!l) return fallback;
    try {
      var raw = l.getItem(key);
      if (raw == null) return fallback;
      var v = JSON.parse(raw);
      return (v == null) ? fallback : v;
    } catch (e) { return fallback; }
  }
  function _writeJSON(key, val) {
    var l = _ls();
    if (!l) return;
    try { l.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* ================= 3. PROFILES ================= */
  function list() {
    var a = _readJSON(PROFILES_KEY, []);
    return Object.prototype.toString.call(a) === '[object Array]' ? a.slice() : [];
  }
  function _saveList(a) { _writeJSON(PROFILES_KEY, a); }
  function _saveProfile(p) {
    var all = list(), i;
    for (i = 0; i < all.length; i++) {
      if (all[i].id === p.id) { all[i] = p; break; }
    }
    _saveList(all);
  }
  function current() {
    var l = _ls();
    var id = l ? l.getItem(ACTIVE_KEY) : null;
    if (!id) return null;
    var all = list(), i;
    for (i = 0; i < all.length; i++) {
      if (all[i].id === id) return all[i];
    }
    return null; /* stale active id -> treat as public */
  }
  function _setActive(id) {
    var l = _ls();
    if (!l) return;
    try {
      if (id) l.setItem(ACTIVE_KEY, id);
      else l.removeItem(ACTIVE_KEY);
    } catch (e) {}
  }
  function colorForName(name) {
    var h = 0, i;
    name = String(name || '?');
    for (i = 0; i < name.length; i++) { h = ((h << 5) - h + name.charCodeAt(i)) | 0; }
    return 'hsl(' + (Math.abs(h) % 360) + ',60%,42%)';
  }
  function createProfile(name) {
    name = String(name == null ? '' : name).replace(/^\s+|\s+$/g, '');
    if (!name) name = 'User';
    var p = {
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: name.slice(0, 40),
      color: colorForName(name),
      created: Date.now(),
      picture: ''
    };
    var all = list();
    all.push(p);
    _saveList(all);
    _setActive(p.id);
    _fire();
    return p;
  }
  function switchProfile(id) {
    var all = list(), i, found = null;
    for (i = 0; i < all.length; i++) {
      if (all[i].id === id) { found = all[i]; break; }
    }
    if (!found) return null;
    _setActive(found.id);
    _fire();
    return found;
  }
  function signOut() {
    _setActive(null);
    _fire();
  }
  var _cbs = [];
  function onChange(cb) {
    if (typeof cb === 'function') _cbs.push(cb);
    return function () {
      var i = _cbs.indexOf(cb);
      if (i >= 0) _cbs.splice(i, 1);
    };
  }
  function _fire() {
    var c = current(), i;
    for (i = 0; i < _cbs.length; i++) {
      try { _cbs[i](c); } catch (e) {}
    }
  }

  /* ================= 4. NAMESPACED STORE =================
     Public (signed out): keys pass through UNPREFIXED — byte-for-byte
     the behavior every site has today.
     Signed in: keys are namespaced per profile AND per site:
     jah-profile-<id>:<site>:<key>. The profile is network-wide (one
     account, all sites); the site segment keeps sites from clobbering
     each other's data on the shared origin. */
  function _pns() { /* profile-only prefix: jah-profile-<id>: */
    var c = current();
    return c ? (PROFILE_NS_PREFIX + c.id + ':') : '';
  }
  function _ns() { /* full store prefix: jah-profile-<id>:<site>: */
    var p = _pns();
    return p ? (p + SITE_ID + ':') : '';
  }
  var store = {
    get: function (k) {
      var l = _ls();
      return l ? l.getItem(_ns() + String(k)) : null;
    },
    set: function (k, v) {
      var l = _ls();
      if (l) { try { l.setItem(_ns() + String(k), String(v)); } catch (e) {} }
    },
    remove: function (k) {
      var l = _ls();
      if (l) { try { l.removeItem(_ns() + String(k)); } catch (e) {} }
    },
    keys: function () {
      var l = _ls(), out = [], i, k, p;
      if (!l || typeof l.length !== 'number') return out;
      p = _ns();
      for (i = 0; i < l.length; i++) {
        try { k = l.key(i); } catch (e) { k = null; }
        if (k == null) continue;
        if (!p) out.push(k);                       /* public: raw keys */
        else if (k.indexOf(p) === 0) out.push(k.slice(p.length)); /* profile: strip prefix */
      }
      return out;
    }
  };

  /* ================= 5. CHAT-MEMORY HELPERS (GuideTalk) ================= */
  function chatKey(baseKey) {
    baseKey = String(baseKey == null ? '' : baseKey);
    /* Deliberately profile-scoped WITHOUT the site segment: chat memory is
       keyed per AI already, so a profile's training of an AI follows the
       user across the whole network ("train once", everywhere). */
    return _pns() ? (_pns() + baseKey) : baseKey; /* public -> unchanged */
  }
  function chatTTL() {
    return current() ? Infinity : PUBLIC_CHAT_TTL; /* signed in -> train once, no expiry */
  }

  /* ================= 5b. MIRROR VIEW + "MAKE IT MINE" =================
     - view(): 'signature' | 'mine'. Public (signed out) is ALWAYS
       'signature' — the standard site exactly as-is, never personalized.
     - "Make it mine" is opt-in per profile (c.mine). Personalization
       (greeting, name-addressing, your-stuff-first) is live ONLY when the
       user opted in AND is in My view.
     - ADDITIVE ONLY (Manon's explicit constraint): My view must NEVER hide,
       remove, or truncate the site's archive/catalog/A-Z. It puts the user's
       own items FIRST; the full archive stays complete and reachable in
       BOTH views. The mirror is additive, never a replacement. */
  function view() {
    var c = current();
    if (!c) return 'signature';
    return (c.view === 'mine') ? 'mine' : 'signature';
  }
  function setView(v) {
    var c = current();
    if (!c) return 'signature';
    c.view = (v === 'mine') ? 'mine' : 'signature';
    _saveProfile(c);
    _fire();
    return c.view;
  }
  function mine() {
    var c = current();
    return !!(c && c.mine);
  }
  function setMine(on) {
    var c = current();
    if (!c) return false;
    c.mine = !!on;
    _saveProfile(c);
    _fire();
    return c.mine;
  }
  function personalized() { /* personalization is live: opted in AND My view */
    return mine() && view() === 'mine';
  }
  function userName() {
    if (!personalized()) return '';
    var c = current();
    return c ? String(c.name || '') : '';
  }
  function greeting() {
    var n = userName();
    return n ? ('Welcome back, ' + n + '.') : '';
  }

  /* ================= 6. GOOGLE SIGN-IN (one-step, inert when unconfigured) ================= */
  function googleEnabled() {
    return GOOGLE_CLIENT_ID !== '';
  }
  var _gsiLoading = false, _gsiQueue = [];
  function ensureGsiScript(cb) {
    var doc = _doc();
    if (typeof cb !== 'function') return;
    if (root.google && root.google.accounts && root.google.accounts.id) { cb(); return; }
    if (!doc) return;
    _gsiQueue.push(cb);
    if (_gsiLoading) return;
    _gsiLoading = true;
    try {
      var s = doc.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = function () {
        _gsiLoading = false;
        var q = _gsiQueue; _gsiQueue = [];
        for (var i = 0; i < q.length; i++) { try { q[i](); } catch (e) {} }
      };
      s.onerror = function () { _gsiLoading = false; _gsiQueue = []; };
      var head = doc.head || (doc.getElementsByTagName ? doc.getElementsByTagName('head')[0] : null);
      if (head && head.appendChild) head.appendChild(s);
      else { _gsiLoading = false; _gsiQueue = []; }
    } catch (e) { _gsiLoading = false; _gsiQueue = []; }
  }
  function _b64ToUtf8(b64) {
    var atobFn = (typeof atob === 'function') ? atob : null;
    if (!atobFn) return null;
    try {
      var bin = atobFn(b64);
      return decodeURIComponent(bin.split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
    } catch (e) {
      try { return atobFn(b64); } catch (e2) { return null; }
    }
  }
  function decodeJwt(token) {
    try {
      var parts = String(token).split('.');
      if (parts.length < 2) return null;
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var json = _b64ToUtf8(b64);
      return json ? JSON.parse(json) : null;
    } catch (e) { return null; }
  }
  function onGoogleCredential(resp) {
    var payload = decodeJwt(resp && resp.credential);
    if (!payload) return null;
    var name = String(payload.name || payload.email || 'Google user').replace(/^\s+|\s+$/g, '');
    var pic = payload.picture ? String(payload.picture) : '';
    var email = String(payload.email || '').toLowerCase().replace(/^\s+|\s+$/g, '');
    var all = list(), i, existing = null;
    for (i = 0; i < all.length; i++) {
      if (String(all[i].name).toLowerCase() === name.toLowerCase()) { existing = all[i]; break; }
    }
    var p = existing || createProfile(name);
    if (pic && p.picture !== pic) { p.picture = pic; _saveProfile(p); }
    /* God Mode gate: keep the Google-verified email on the profile so the owner-only editor can check it. Local profiles never have an email. */
    if (email && p.email !== email) { p.email = email; _saveProfile(p); }
    if (!existing) { /* createProfile already switched */ }
    else switchProfile(p.id);
    _reloadPage();
    return p;
  }
  function renderGoogleButton(container) {
    var doc = _doc();
    if (!doc || !container || !googleEnabled()) return;
    try { container.innerHTML = ''; } catch (e) {}
    ensureGsiScript(function () {
      try {
        root.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: onGoogleCredential,
          auto_select: false
        });
        root.google.accounts.id.renderButton(container, {
          theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill'
        });
      } catch (e) { /* GSI failed -> local profiles still work */ }
    });
  }

  /* ================= 7. UI — theme-neutral header button + dropdown ================= */
  function _reloadPage() {
    try { if (root.location && root.location.reload) root.location.reload(); } catch (e) {}
  }
  function _avatarEl(doc, p, size) {
    size = size || 26;
    if (p.picture) {
      var img = doc.createElement('img');
      img.src = p.picture;
      img.alt = '';
      img.setAttribute('style', 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;flex:0 0 auto;');
      return img;
    }
    var s = doc.createElement('span');
    var initial = (String(p.name || '?').replace(/^\s+/, '').charAt(0) || '?').toUpperCase();
    s.textContent = initial;
    s.setAttribute('style', 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;flex:0 0 auto;' +
      'background:' + p.color + ';color:#fff;font:700 ' + Math.round(size * 0.55) + 'px/1 system-ui,sans-serif;' +
      'display:inline-flex;align-items:center;justify-content:center;');
    return s;
  }
  var ui = {
    renderButton: function (mount) {
      var doc = _doc();
      if (!doc || !mount || !mount.appendChild) return null;
      var wrap = doc.createElement('span');
      wrap.setAttribute('style', 'position:relative;display:inline-block;vertical-align:middle;z-index:9999;font-family:system-ui,sans-serif;');
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('style', 'display:inline-flex;align-items:center;gap:8px;border:1px solid #bbb;border-radius:999px;' +
        'background:#fff;color:#111;font:600 13px/1.4 system-ui,sans-serif;padding:5px 12px 5px 5px;cursor:pointer;white-space:nowrap;');
      var drop = doc.createElement('div');
      drop.setAttribute('style', 'display:none;position:absolute;right:0;top:calc(100% + 6px);min-width:250px;max-width:300px;' +
        'background:#fff;color:#111;border:1px solid #ccc;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.25);' +
        'padding:10px;font-size:13px;text-align:left;');
      function refresh() {
        var c = current(), i;
        try { btn.innerHTML = ''; } catch (e) {}
        if (c) {
          btn.appendChild(_avatarEl(doc, c, 26));
          var nm = doc.createElement('span');
          nm.textContent = c.name;
          btn.appendChild(nm);
        } else {
          var ic = doc.createElement('span');
          ic.textContent = '\uD83D\uDC64'; /* bust in silhouette */
          ic.setAttribute('style', 'font-size:16px;');
          btn.appendChild(ic);
          var tx = doc.createElement('span');
          tx.textContent = 'Sign in / Profiles';
          btn.appendChild(tx);
        }
        /* rebuild dropdown */
        try { drop.innerHTML = ''; } catch (e) {}
        var title = doc.createElement('div');
        title.textContent = 'PROFILES ON THIS DEVICE';
        title.setAttribute('style', 'font-size:11px;font-weight:700;letter-spacing:.08em;color:#666;margin:2px 4px 8px;');
        drop.appendChild(title);
        var all = list();
        for (i = 0; i < all.length; i++) { drop.appendChild(profileRow(doc, all[i])); }
        drop.appendChild(actionRow(doc, '\uFF0B New profile\u2026', function () {
          var name = '';
          try {
            if (typeof prompt === 'function') name = prompt('Profile name:', '');
            else if (root.prompt) name = root.prompt('Profile name:', '');
          } catch (e) {}
          if (name == null) return;
          createProfile(name);
          _reloadPage();
        }));
        if (c) {
          drop.appendChild(actionRow(doc, 'Sign out (use public)', function () {
            signOut();
            _reloadPage();
          }));
          /* ---- "Make it mine" opt-in (signed-in only) ---- */
          var mrow = doc.createElement('label');
          mrow.setAttribute('style', 'display:flex;align-items:center;gap:8px;padding:7px 8px;cursor:pointer;color:#111;');
          var mcb = doc.createElement('input');
          mcb.type = 'checkbox';
          try { mcb.checked = !!mine(); } catch (e) {}
          mcb.addEventListener('click', function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); });
          mcb.addEventListener('change', function () {
            setMine(!!mcb.checked);
            _reloadPage();
          });
          mrow.appendChild(mcb);
          var mtx = doc.createElement('span');
          mtx.textContent = 'Make it mine (greet me, my stuff first)';
          mrow.appendChild(mtx);
          drop.appendChild(mrow);
        }
        var prov, anyProv = false;
        for (var key in PROVIDERS) {
          if (!Object.prototype.hasOwnProperty.call(PROVIDERS, key)) continue;
          prov = PROVIDERS[key];
          if (prov && typeof prov.enabled === 'function' && prov.enabled() && typeof prov.renderButton === 'function') {
            anyProv = true;
            var sep = doc.createElement('div');
            sep.setAttribute('style', 'border-top:1px solid #e3e3e3;margin:8px 0;');
            drop.appendChild(sep);
            var gwrap = doc.createElement('div');
            gwrap.setAttribute('style', 'display:flex;justify-content:center;padding:2px 0;');
            drop.appendChild(gwrap);
            prov.renderButton(gwrap);
          }
        }
        if (!anyProv) { /* Google not configured -> nothing extra; local profiles only */ }
        var honest = doc.createElement('div');
        honest.textContent = 'Your profile lives on this device. No account, no cloud sync.';
        honest.setAttribute('style', 'font-size:11px;color:#777;margin:8px 4px 2px;line-height:1.4;');
        drop.appendChild(honest);
        var legal = doc.createElement('div');
        legal.textContent = 'Built with Signature \u2014 your creations are yours.';
        legal.setAttribute('style', 'font-size:11px;color:#777;margin:0 4px 2px;line-height:1.4;');
        drop.appendChild(legal);
      }
      function profileRow(doc, p) {
        var row = doc.createElement('div');
        var c = current();
        row.setAttribute('style', 'display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;cursor:pointer;' +
          (c && c.id === p.id ? 'background:#f0f0f0;font-weight:700;' : ''));
        row.appendChild(_avatarEl(doc, p, 24));
        var label = doc.createElement('span');
        label.textContent = p.name;
        label.setAttribute('style', 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;');
        row.appendChild(label);
        if (c && c.id === p.id) {
          var chk = doc.createElement('span');
          chk.textContent = '\u2713';
          chk.setAttribute('style', 'color:#1a7f37;font-weight:700;');
          row.appendChild(chk);
        }
        row.addEventListener('click', function (ev) {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          switchProfile(p.id);
          _reloadPage();
        });
        /* hover affordance */
        row.addEventListener('mouseenter', function () { row.style.background = '#f5f5f5'; });
        row.addEventListener('mouseleave', function () {
          row.style.background = (c && c.id === p.id) ? '#f0f0f0' : '';
        });
        return row;
      }
      function actionRow(doc, labelText, fn) {
        var row = doc.createElement('div');
        row.textContent = labelText;
        row.setAttribute('style', 'padding:7px 8px;border-radius:8px;cursor:pointer;color:#0b5bd3;font-weight:600;');
        row.addEventListener('click', function (ev) {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          fn();
        });
        row.addEventListener('mouseenter', function () { row.style.background = '#f0f7ff'; });
        row.addEventListener('mouseleave', function () { row.style.background = ''; });
        return row;
      }
      refresh();
      btn.addEventListener('click', function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        refresh();
        drop.style.display = (drop.style.display === 'none' || !drop.style.display) ? 'block' : 'none';
      });
      drop.addEventListener('click', function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); });
      try {
        doc.addEventListener('click', function () { drop.style.display = 'none'; });
      } catch (e) {}
      wrap.appendChild(btn);
      wrap.appendChild(drop);
      mount.appendChild(wrap);
      /* ---- mirror toggle: visible header switch, signed-in only.
             "My view" = personalized; "Signature view" = the standard site
             exactly as-is (default; all a signed-out visitor ever sees).
             Visible in both views; switching keeps the user's place. ---- */
      if (current()) {
        var vt = doc.createElement('button');
        vt.type = 'button';
        var _isMine = (view() === 'mine');
        vt.textContent = _isMine ? 'My view \u21C4' : '\u21C4 Signature view';
        vt.title = _isMine
          ? 'You are in My view (personalized). Switch to the standard Signature view.'
          : 'You are in Signature view (standard site). Switch to your personalized My view.';
        vt.setAttribute('style', 'display:inline-flex;align-items:center;gap:6px;margin-left:8px;' +
          'border:1px solid #bbb;border-radius:999px;background:' + (_isMine ? '#e8f0fe' : '#fff') + ';' +
          'color:#111;font:600 12px/1.4 system-ui,sans-serif;padding:5px 12px;cursor:pointer;' +
          'white-space:nowrap;vertical-align:middle;');
        vt.addEventListener('click', function (ev) {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          setView(view() === 'mine' ? 'signature' : 'mine');
          _saveScroll();
          _reloadPage();
        });
        mount.appendChild(vt);
      }
      return wrap;
    },
    /* Optional page greeting: renders "Welcome back, <name>." plus the legal
       line, ONLY when personalization is live (opted in + My view).
       Theme-neutral; safe to call with any element or null. */
    renderGreeting: function (mount) {
      var doc = _doc();
      var g = greeting();
      if (!doc || !mount || !mount.appendChild || !g) return null;
      var box = doc.createElement('div');
      box.setAttribute('style', 'display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;' +
        'font:600 15px/1.5 system-ui,sans-serif;margin:6px 0;');
      var t = doc.createElement('span');
      t.textContent = g;
      box.appendChild(t);
      var l = doc.createElement('span');
      l.textContent = 'Built with Signature \u2014 your creations are yours.';
      l.setAttribute('style', 'font-size:12px;font-weight:400;opacity:.75;');
      box.appendChild(l);
      mount.appendChild(box);
      return box;
    }
  };

  /* ================= 8. EXPORT ================= */
  var JAHProfile = {
    version: '2.0.0',
    googleClientId: GOOGLE_CLIENT_ID, /* public by design (OAuth client IDs are public) */
    providers: PROVIDERS,
    googleEnabled: googleEnabled,
    list: list,
    create: createProfile,
    switch: switchProfile,
    signOut: signOut,
    current: current,
    onChange: onChange,
    store: store,
    chatKey: chatKey,
    chatTTL: chatTTL,
    view: view,
    setView: setView,
    mine: mine,
    setMine: setMine,
    personalized: personalized,
    userName: userName,
    greeting: greeting,
    ui: ui
  };
  root.JAHProfile = JAHProfile;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
