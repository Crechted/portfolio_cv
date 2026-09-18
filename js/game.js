(function () {
  'use strict';

  var shell = document.getElementById('game-shell');
  var canvas = document.getElementById('game-canvas');
  if (!shell || !canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var startOverlay = document.getElementById('game-start');
  var overOverlay = document.getElementById('game-over');
  var startBtn = document.getElementById('game-start-btn');
  var restartBtn = document.getElementById('game-restart-btn');
  var hudEl = document.getElementById('game-hud');
  var hudScoreValue = document.getElementById('game-hud-score-value');
  var hudBestValue = document.getElementById('game-hud-best-value');
  var hudAmmoValue = document.getElementById('game-hud-ammo-value');
  var hudAmmoBlock = hudAmmoValue ? hudAmmoValue.parentNode : null;
  var controlHint = document.getElementById('game-control-hint');
  var overScoreEl = document.getElementById('game-over-score');
  var overBestEl = document.getElementById('game-over-best');
  var touchControls = document.getElementById('game-touch');
  var fireBtn = document.getElementById('game-fire-btn');

  var BEST_KEY = 'portfolio-game-best';
  var AMMO_KEY = 'portfolio-game-ammo';
  var AMMO_DEFAULT = 0;
  var AMMO_MAX = 7;
  var SHOT_SPEED = 240;
  var t = function (k) { return (window.i18n && i18n.t) ? i18n.t(k) : k; };

  var IS_TOUCH = ('ontouchstart' in window) || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0);

  function updateHintText() {
    controlHint.textContent = t(IS_TOUCH ? 'game.controlHintTouch' : 'game.controlHintMouse');
  }

  function updateTouchMode() {
    canvas.style.touchAction = (state === 'playing') ? 'none' : 'auto';
    if (touchControls) {
      var show = IS_TOUCH && state === 'playing';
      touchControls.classList.toggle('hidden', !show);
    }
  }

  function ammoClaimed() {
    try {
      var v = JSON.parse(localStorage.getItem(AMMO_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  function ammoCapacity() {
    return Math.min(AMMO_MAX, AMMO_DEFAULT + ammoClaimed().length);
  }

  var TAU = Math.PI * 2;
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };

  var SHIP_Z = 0.3;
  var SHIP_Y0 = 0.6;
  var SHIP_Y_MIN = -1.1;
  var SHIP_Y_MAX = 5.6;
  var SHIP_Y_RANGE_UP = 9.8;
  var SHIP_Y_RANGE_DOWN = 3.0;
  var SHIP_SCALE = 0.78;
  var SHIP_R = 0.58;
  var AIM_FAR = 600;
  var SHOT_RANGE = 700;
  var BOLT_FADE_IN = 30;
  var BOLT_FADE_OUT = 170;
  var CRYSTAL_FADE_IN = 0.9;
  var BASE_SPEED = 26;
  var MAX_SPEED = 54;
  var FOV = (62 * Math.PI) / 180;

  var _ll = Math.hypot(0.32, 0.78, 0.54);
  var LIGHT = [0.32 / _ll, 0.78 / _ll, 0.54 / _ll];

  var vw = 0, vh = 0, dpr = 1, cx = 0, cy = 0, FL = 0;
  var eye = [0, 0, 7], fwd = [0, 0, -1], right = [1, 0, 0], upv = [0, 1, 0];
  var nebula = null;

  var state = 'idle';
  var time = 0, speed = BASE_SPEED, dist = 0, score = 0, bonus = 0;
  var best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) {}
  var shipX = 0, shipY = SHIP_Y0, targetX = 0, targetY = SHIP_Y0;
  var playerVx = 0, playerVy = 0;
  var shipPitch = 0, shipYaw = 0, shipRoll = 0;
  var targetPitch = 0, targetYaw = 0, targetRoll = 0;
  var pointerX = 0.5, pointerY = 0.5;
  var smVx = 0, smVy = 0, prevPointerX = 0.5, prevPointerY = 0.5;
  var touchId = null, touchLastX = 0, touchLastY = 0;
  var spawnTimer = 0, crystalTimer = 0, hintTimer = 0;
  var dispScore = -1;
  var asteroids = [], crystals = [], particles = [], popups = [], stars = [], shots = [];
  var currentAmmo = ammoCapacity();

  var m00 = 1, m01 = 0, m02 = 0, m10 = 0, m11 = 1, m12 = 0, m20 = 0, m21 = 0, m22 = 1;

  function setRot(rx, ry, rz) {
    var crx = Math.cos(rx), srx = Math.sin(rx);
    var cry = Math.cos(ry), sry = Math.sin(ry);
    var crz = Math.cos(rz), srz = Math.sin(rz);
    m00 = cry * crz;
    m01 = -cry * srz;
    m02 = sry;
    m10 = srx * sry * crz + crx * srz;
    m11 = -srx * sry * srz + crx * crz;
    m12 = -srx * cry;
    m20 = -crx * sry * crz + srx * srz;
    m21 = crx * sry * srz + srx * crz;
    m22 = crx * cry;
  }

  // ---- mesh helpers ----
  function makeMesh() { return { v: [], f: [] }; }

  function addV(m, x, y, z) { m.v.push([x, y, z]); return m.v.length - 1; }

  function addFace(m, idx, color, glass) { m.f.push({ i: idx, c: color, glass: glass ? 1 : 0 }); }

  function addBox(m, cx0, cy0, cz0, sx, sy, sz, color, glass) {
    var hx = sx / 2, hy = sy / 2, hz = sz / 2;
    var b = m.v.length;
    m.v.push(
      [cx0 - hx, cy0 - hy, cz0 - hz], [cx0 + hx, cy0 - hy, cz0 - hz],
      [cx0 + hx, cy0 + hy, cz0 - hz], [cx0 - hx, cy0 + hy, cz0 - hz],
      [cx0 - hx, cy0 - hy, cz0 + hz], [cx0 + hx, cy0 - hy, cz0 + hz],
      [cx0 + hx, cy0 + hy, cz0 + hz], [cx0 - hx, cy0 + hy, cz0 + hz]
    );
    addFace(m, [b + 0, b + 1, b + 2, b + 3], color, glass);
    addFace(m, [b + 4, b + 5, b + 6, b + 7], color, glass);
    addFace(m, [b + 0, b + 1, b + 5, b + 4], color, glass);
    addFace(m, [b + 3, b + 2, b + 6, b + 7], color, glass);
    addFace(m, [b + 0, b + 3, b + 7, b + 4], color, glass);
    addFace(m, [b + 1, b + 2, b + 6, b + 5], color, glass);
  }

  function addPyramid(m, b, apex, color) {
    addFace(m, [b[0], b[1], apex], color);
    addFace(m, [b[1], b[2], apex], color);
    addFace(m, [b[2], b[3], apex], color);
    addFace(m, [b[3], b[0], apex], color);
  }

  // triangular delta wing (thin prism)
  function addWing(m, s, color) {
    var b = m.v.length;
    var yT = 0.03, yB = -0.05;
    m.v.push(
      [0.25 * s, yT, -0.70], [0.25 * s, yT, 0.90], [1.95 * s, -0.02, 0.45],
      [0.25 * s, yB, -0.70], [0.25 * s, yB, 0.90], [1.95 * s, -0.08, 0.45]
    );
    addFace(m, [b + 0, b + 1, b + 2], color);
    addFace(m, [b + 3, b + 4, b + 5], color);
    addFace(m, [b + 0, b + 1, b + 4, b + 3], color);
    addFace(m, [b + 1, b + 2, b + 5, b + 4], color);
    addFace(m, [b + 2, b + 0, b + 3, b + 5], color);
  }

  function finalizeNormals(m) {
    var n = m.v.length, i, j;
    var parent = new Array(n);
    for (i = 0; i < n; i++) parent[i] = i;
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    function uni(a, b) { a = find(a); b = find(b); if (a !== b) parent[a] = b; }
    for (i = 0; i < m.f.length; i++) {
      var inds = m.f[i].i;
      for (j = 1; j < inds.length; j++) uni(inds[0], inds[j]);
    }
    var cc = {};
    for (i = 0; i < n; i++) {
      var rt = find(i);
      if (!cc[rt]) cc[rt] = [0, 0, 0, 0];
      var p = m.v[i];
      cc[rt][0] += p[0]; cc[rt][1] += p[1]; cc[rt][2] += p[2]; cc[rt][3]++;
    }
    var keys = Object.keys(cc);
    for (i = 0; i < keys.length; i++) {
      var c0 = cc[keys[i]];
      c0[0] /= c0[3]; c0[1] /= c0[3]; c0[2] /= c0[3];
    }
    for (i = 0; i < m.f.length; i++) {
      var f = m.f[i], a = m.v[f.i[0]], b = m.v[f.i[1]], c = m.v[f.i[2]];
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      var mx = 0, my = 0, mz = 0;
      for (j = 0; j < f.i.length; j++) { mx += m.v[f.i[j]][0]; my += m.v[f.i[j]][1]; mz += m.v[f.i[j]][2]; }
      mx /= f.i.length; my /= f.i.length; mz /= f.i.length;
      var ctr = cc[find(f.i[0])];
      if ((mx - ctr[0]) * nx + (my - ctr[1]) * ny + (mz - ctr[2]) * nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      var l = Math.hypot(nx, ny, nz) || 1;
      f.fn = [nx / l, ny / l, nz / l];
      f.comp = find(f.i[0]);
    }
  }

  // ---- build ship ----
  function buildShip() {
    var m = makeMesh();
    var white = [234, 238, 245];
    var red = [212, 42, 52];
    var redDark = [176, 28, 40];
    var canopy = [150, 212, 240];
    var engine = [40, 44, 58];

    addBox(m, 0, 0.05, 0, 0.5, 0.4, 2.0, white);

    var nz = -1.0, nx = 0.25, ny = 0.2;
    var base = [];
    base.push(addV(m, -nx, 0.05 - ny, nz));
    base.push(addV(m, nx, 0.05 - ny, nz));
    base.push(addV(m, nx, 0.05 + ny, nz));
    base.push(addV(m, -nx, 0.05 + ny, nz));
    var tip = addV(m, 0, 0.08, -2.15);
    addPyramid(m, base, tip, red);

    addWing(m, -1, red);
    addWing(m, 1, red);

    addBox(m, 0, 0.60, 0.72, 0.09, 0.70, 0.80, redDark);
    addBox(m, 0, 0.40, -0.30, 0.34, 0.28, 0.78, canopy, true);
    addBox(m, -0.38, 0.0, 1.25, 0.26, 0.24, 0.7, engine);
    addBox(m, 0.38, 0.0, 1.25, 0.26, 0.24, 0.7, engine);

    finalizeNormals(m);
    return m;
  }

  var shipMesh = buildShip();
  shipMesh.convex = true;
  shipMesh.zbuf = true;

  // ---- build asteroid (rock) ----
  function buildRock() {
    var t = (1 + Math.sqrt(5)) / 2;
    var v = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
    ];
    var f = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];

    var cache = Object.create(null);
    function mid(a, b) {
      var key = a < b ? a + '_' + b : b + '_' + a;
      if (cache[key] === undefined) {
        cache[key] = v.length;
        v.push([(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2]);
      }
      return cache[key];
    }

    var nf = [];
    var k;
    for (k = 0; k < f.length; k++) {
      var a = f[k][0], b = f[k][1], c = f[k][2];
      var ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }

    var mesh = makeMesh();
    var rockCol = [118, 110, 100];
    for (k = 0; k < v.length; k++) {
      var p = v[k];
      var l = Math.hypot(p[0], p[1], p[2]) || 1;
      var r = rand(0.78, 1.3);
      mesh.v.push([p[0] / l * r, p[1] / l * r, p[2] / l * r]);
    }
    for (k = 0; k < nf.length; k++) mesh.f.push({ i: nf[k], c: rockCol });
    finalizeNormals(mesh);
    return mesh;
  }

  var rockMesh = buildRock();

  // ---- build crystal ----
  function buildCrystal() {
    var m = makeMesh();
    var col = [98, 224, 255];
    var col2 = [150, 245, 255];
    var v0 = addV(m, 0, 1, 0), v1 = addV(m, 0, -1, 0);
    var v2 = addV(m, 0.8, 0, 0), v3 = addV(m, -0.8, 0, 0);
    var v4 = addV(m, 0, 0, 0.55), v5 = addV(m, 0, 0, -0.55);
    addFace(m, [v0, v2, v4], col);
    addFace(m, [v0, v4, v3], col);
    addFace(m, [v0, v3, v5], col);
    addFace(m, [v0, v5, v2], col);
    addFace(m, [v1, v4, v2], col2);
    addFace(m, [v1, v3, v4], col2);
    addFace(m, [v1, v5, v3], col2);
    addFace(m, [v1, v2, v5], col2);
    finalizeNormals(m);
    return m;
  }

  var crystalMesh = buildCrystal();
  crystalMesh.convex = true;

  // ---- stars ----
  var STAR_COLORS = [[220, 228, 255], [255, 250, 235], [188, 216, 255], [245, 190, 150], [215, 215, 255]];

  function makeStar() {
    return { x: rand(-12, 12), y: rand(-6, 6), z: rand(-205, -60), px: -1, py: 0, tint: STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0] };
  }

  var i;
  for (i = 0; i < 200; i++) stars.push(makeStar());

  // ---- nebula ----
  function makeNebula() {
    nebula = document.createElement('canvas');
    nebula.width = Math.max(1, Math.round(vw * dpr));
    nebula.height = Math.max(1, Math.round(vh * dpr));
    var nc = nebula.getContext('2d');
    nc.setTransform(dpr, 0, 0, dpr, 0, 0);

    var bg = nc.createLinearGradient(0, 0, 0, vh);
    bg.addColorStop(0, '#0a1024');
    bg.addColorStop(0.5, '#070b18');
    bg.addColorStop(1, '#0d0a1e');
    nc.fillStyle = bg;
    nc.fillRect(0, 0, vw, vh);

    var blobs = [[0.72, 0.30, '#312e81'], [0.18, 0.62, '#1e3a8a'], [0.50, 0.85, '#4c1d95'], [0.85, 0.55, '#0e7490'], [0.30, 0.20, '#5b21b6']];
    var j;
    for (j = 0; j < blobs.length; j++) {
      var bx = blobs[j][0] * vw, by = blobs[j][1] * vh;
      var br = Math.max(vw, vh) * (0.35 + Math.random() * 0.2);
      var g = nc.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, blobs[j][2]);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      nc.globalAlpha = 0.15;
      nc.fillStyle = g;
      nc.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    nc.globalAlpha = 1;
  }

  // ---- view ----
  function updateView() {
    var ex = shipX * 0.45, ey = 2.5 + shipY * 0.12, ez = 7;
    var lx = shipX * 0.85, ly = 0.25 + shipY * 0.2, lz = -5.5;
    var fx = lx - ex, fy = ly - ey, fz = lz - ez;
    var fl = Math.hypot(fx, fy, fz) || 1;
    fwd[0] = fx / fl; fwd[1] = fy / fl; fwd[2] = fz / fl;

    right[0] = -fwd[2]; right[1] = 0; right[2] = fwd[0];
    var rl = Math.hypot(right[0], right[2]) || 1;
    right[0] /= rl; right[2] /= rl; right[1] = 0;

    upv[0] = right[1] * fwd[2] - right[2] * fwd[1];
    upv[1] = right[2] * fwd[0] - right[0] * fwd[2];
    upv[2] = right[0] * fwd[1] - right[1] * fwd[0];

    eye[0] = ex; eye[1] = ey; eye[2] = ez;
  }

  function projectPoint(x, y, z) {
    var dx = x - eye[0], dy = y - eye[1], dz = z - eye[2];
    var zv = dx * fwd[0] + dy * fwd[1] + dz * fwd[2];
    if (zv < 0.35) return null;
    var inv = FL / zv;
    return [
      cx + (dx * right[0] + dy * right[1] + dz * right[2]) * inv,
      cy - (dx * upv[0] + dy * upv[1] + dz * upv[2]) * inv,
      zv, inv
    ];
  }

  // ---- draw mesh ----
  var wv = [];
  var faceBuf = [];

  // software z-buffer for the ship: guarantees exact per-pixel visibility
  var zCanvas = null, zCtx = null, zImg = null, zDepth = null, zW = 0, zH = 0;
  var ZSS = 2;
  var _sx = null, _sy = null, _sz = null, _sb = null;

  function rasterMesh(mesh, wv) {
    var e0 = eye[0], e1 = eye[1], e2 = eye[2];
    var n = mesh.v.length, i, j;
    if (!_sx || _sx.length < n) {
      _sx = new Float64Array(n); _sy = new Float64Array(n);
      _sz = new Float64Array(n); _sb = new Uint8Array(n);
    }
    var sx = _sx, sy = _sy, sz = _sz, sb = _sb;
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, any = false;
    for (i = 0; i < n; i++) {
      var p = wv[i];
      var dx = p[0] - e0, dy = p[1] - e1, dz = p[2] - e2;
      var z = dx * fwd[0] + dy * fwd[1] + dz * fwd[2];
      sz[i] = z;
      if (z < 0.35) { sb[i] = 1; continue; }
      sb[i] = 0;
      var inv = FL / z;
      var X = cx + (dx * right[0] + dy * right[1] + dz * right[2]) * inv;
      var Y = cy - (dx * upv[0] + dy * upv[1] + dz * upv[2]) * inv;
      sx[i] = X; sy[i] = Y; any = true;
      if (X < minX) minX = X; if (X > maxX) maxX = X;
      if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
    }
    if (!any) return;
    var x0 = Math.max(0, Math.floor(minX)), y0 = Math.max(0, Math.floor(minY));
    var x1 = Math.min(vw, Math.ceil(maxX) + 1), y1 = Math.min(vh, Math.ceil(maxY) + 1);
    if (x1 <= x0 || y1 <= y0) return;
    var w = x1 - x0, h = y1 - y0, W = w * ZSS, H = h * ZSS;
    if (!zCanvas) { zCanvas = document.createElement('canvas'); zCtx = zCanvas.getContext('2d'); }
    if (zW !== W || zH !== H) {
      zCanvas.width = W; zCanvas.height = H;
      zImg = zCtx.createImageData(W, H);
      zDepth = new Float32Array(W * H);
      zW = W; zH = H;
    }
    var data = zImg.data;
    data.fill(0);
    zDepth.fill(Infinity);

    function shade(face) {
      var inds = face.i;
      for (var k = 0; k < inds.length; k++) if (sb[inds[k]]) return -1;
      var fn = face.fn;
      var wnx = m00 * fn[0] + m01 * fn[1] + m02 * fn[2];
      var wny = m10 * fn[0] + m11 * fn[1] + m12 * fn[2];
      var wnz = m20 * fn[0] + m21 * fn[1] + m22 * fn[2];
      if (face.glass || mesh.convex) {
        var gx = 0, gy = 0, gz = 0;
        for (var m = 0; m < inds.length; m++) {
          var q = wv[inds[m]]; gx += q[0]; gy += q[1]; gz += q[2];
        }
        gx /= inds.length; gy /= inds.length; gz /= inds.length;
        if ((e0 - gx) * wnx + (e1 - gy) * wny + (e2 - gz) * wnz <= 0) return -1;
      }
      var nb = wnx * LIGHT[0] + wny * LIGHT[1] + wnz * LIGHT[2];
      if (nb < 0) nb = 0;
      var depth = 0;
      for (var d = 0; d < inds.length; d++) depth += sz[inds[d]];
      depth /= inds.length;
      return (0.34 + 0.66 * nb) * (1 - Math.min(0.6, depth / 460));
    }

    function tri(ai, bi, ci, r, g, b, alpha) {
      var Ax = (sx[ai] - x0) * ZSS, Ay = (sy[ai] - y0) * ZSS;
      var Bx = (sx[bi] - x0) * ZSS, By = (sy[bi] - y0) * ZSS;
      var Cx = (sx[ci] - x0) * ZSS, Cy = (sy[ci] - y0) * ZSS;
      var area = (Bx - Ax) * (Cy - Ay) - (By - Ay) * (Cx - Ax);
      if (area > -1e-9 && area < 1e-9) return;
      var minx = Math.max(0, Math.floor(Math.min(Ax, Bx, Cx)));
      var maxx = Math.min(W - 1, Math.ceil(Math.max(Ax, Bx, Cx)));
      var miny = Math.max(0, Math.floor(Math.min(Ay, By, Cy)));
      var maxy = Math.min(H - 1, Math.ceil(Math.max(Ay, By, Cy)));
      if (maxx < minx || maxy < miny) return;
      var iza = 1 / sz[ai], izb = 1 / sz[bi], izc = 1 / sz[ci];
      var neg = area < 0;
      if (neg) area = -area;
      var glass = alpha < 255, a = alpha / 255;
      for (var y = miny; y <= maxy; y++) {
        var pyc = y + 0.5;
        for (var x = minx; x <= maxx; x++) {
          var pxc = x + 0.5;
          var w0 = (Cx - Bx) * (pyc - By) - (Cy - By) * (pxc - Bx);
          var w1 = (Ax - Cx) * (pyc - Cy) - (Ay - Cy) * (pxc - Cx);
          var w2 = (Bx - Ax) * (pyc - Ay) - (By - Ay) * (pxc - Ax);
          if (neg) { w0 = -w0; w1 = -w1; w2 = -w2; }
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          var z = 1 / ((w0 * iza + w1 * izb + w2 * izc) / area);
          var idx = y * W + x;
          if (z >= zDepth[idx]) continue;
          var o = idx * 4;
          if (glass) {
            if (zDepth[idx] === Infinity) {
              data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = alpha;
            } else {
              data[o] = data[o] * (1 - a) + r * a;
              data[o + 1] = data[o + 1] * (1 - a) + g * a;
              data[o + 2] = data[o + 2] * (1 - a) + b * a;
              data[o + 3] = 255;
            }
          } else {
            data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
            zDepth[idx] = z;
          }
        }
      }
    }

    for (i = 0; i < mesh.f.length; i++) {
      var face = mesh.f[i];
      if (face.glass) continue;
      var nb = shade(face);
      if (nb < 0) continue;
      var c = face.c;
      var r = (c[0] * nb) | 0, g = (c[1] * nb) | 0, b = (c[2] * nb) | 0;
      for (j = 1; j + 1 < face.i.length; j++) tri(face.i[0], face.i[j], face.i[j + 1], r, g, b, 255);
    }
    for (i = 0; i < mesh.f.length; i++) {
      var gf = mesh.f[i];
      if (!gf.glass) continue;
      var gnb = shade(gf);
      if (gnb < 0) continue;
      var gc = gf.c;
      var gr = (gc[0] * gnb) | 0, gg = (gc[1] * gnb) | 0, gb = (gc[2] * gnb) | 0;
      for (j = 1; j + 1 < gf.i.length; j++) tri(gf.i[0], gf.i[j], gf.i[j + 1], gr, gg, gb, 140);
    }

    zCtx.putImageData(zImg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(zCanvas, 0, 0, W, H, x0, y0, w, h);
  }

  function drawMesh(mesh, rx, ry, rz, sc, px, py, pz, zCut) {
    setRot(rx, ry, rz);
    if (wv.length < mesh.v.length) wv.length = mesh.v.length;
    var i;
    for (i = 0; i < mesh.v.length; i++) {
      var v = mesh.v[i];
      var x = v[0] * sc, y = v[1] * sc, z = v[2] * sc;
      wv[i] = [
        m00 * x + m01 * y + m02 * z + px,
        m10 * x + m11 * y + m12 * z + py,
        m20 * x + m21 * y + m22 * z + pz
      ];
    }

    if (mesh.zbuf) { rasterMesh(mesh, wv); return; }

    faceBuf.length = 0;
    var e0 = eye[0], e1 = eye[1], e2 = eye[2];
    var cull = !!mesh.convex;
    for (i = 0; i < mesh.f.length; i++) {
      var face = mesh.f[i];
      var inds = face.i;
      var ok = true, depth = 0;
      var pts = [];
      var j;
      for (j = 0; j < inds.length; j++) {
        var p = wv[inds[j]];
        var dx = p[0] - e0, dy = p[1] - e1, dz = p[2] - e2;
        var zv = dx * fwd[0] + dy * fwd[1] + dz * fwd[2];
        if (zv < 0.35) { ok = false; break; }
        var inv = FL / zv;
        pts.push(
          cx + (dx * right[0] + dy * right[1] + dz * right[2]) * inv,
          cy - (dx * upv[0] + dy * upv[1] + dz * upv[2]) * inv
        );
        depth += zv;
      }
      if (!ok) continue;
      depth /= inds.length;
      if (depth > zCut) continue;

      var fn = face.fn;
      var wnx = m00 * fn[0] + m01 * fn[1] + m02 * fn[2];
      var wny = m10 * fn[0] + m11 * fn[1] + m12 * fn[2];
      var wnz = m20 * fn[0] + m21 * fn[1] + m22 * fn[2];

      // backface culling keeps convex parts watertight (glass always culled)
      var isGlass = face.glass;
      if (cull || isGlass) {
        var gx = 0, gy = 0, gz = 0;
        for (j = 0; j < inds.length; j++) {
          gx += wv[inds[j]][0]; gy += wv[inds[j]][1]; gz += wv[inds[j]][2];
        }
        gx /= inds.length; gy /= inds.length; gz /= inds.length;
        if ((e0 - gx) * wnx + (e1 - gy) * wny + (e2 - gz) * wnz <= 0) continue;
      }

      var nb = wnx * LIGHT[0] + wny * LIGHT[1] + wnz * LIGHT[2];
      if (nb < 0) nb = 0;
      nb = 0.34 + 0.66 * nb;
      nb *= 1 - Math.min(0.6, depth / 460);

      var c = face.c;
      faceBuf.push({
        z: depth,
        r: (c[0] * nb) | 0, g: (c[1] * nb) | 0, bl: (c[2] * nb) | 0,
        pts: pts,
        glass: isGlass ? 1 : 0
      });
    }

    if (!faceBuf.length) return;
    faceBuf.sort(function (a, b) { return b.z - a.z; });
    for (i = 0; i < faceBuf.length; i++) {
      var q = faceBuf[i], pp = q.pts;
      if (q.glass) ctx.globalAlpha = 0.55;
      ctx.fillStyle = 'rgb(' + q.r + ',' + q.g + ',' + q.bl + ')';
      ctx.beginPath();
      ctx.moveTo(pp[0], pp[1]);
      for (var jj = 2; jj < pp.length; jj += 2) ctx.lineTo(pp[jj], pp[jj + 1]);
      ctx.closePath();
      ctx.fill();
      if (q.glass) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(200,240,255,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (q.z < 75) {
        ctx.strokeStyle = 'rgba(5,8,16,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- spawn ----
  function spawnAsteroid() {
    if (asteroids.length >= 24) return;
    var r = rand(0.7, 1.35) * (1 + Math.min(0.3, time * 0.004));
    var z = rand(-190, -150);
    var x;
    var roll = Math.random();
    if (roll < 0.35) x = rand(shipX - 2.2, shipX + 2.2);
    else if (roll < 0.8) x = (Math.random() < 0.5 ? 1 : -1) * rand(2.6, 10.5);
    else x = rand(-10.5, 10.5);
    var y = rand(SHIP_Y_MIN - 0.7, SHIP_Y_MAX + 0.4);
    if (Math.random() < 0.45) y = clamp(shipY + rand(-2.2, 2.2), SHIP_Y_MIN - 0.7, SHIP_Y_MAX + 0.4);
    asteroids.push({
      x: x, y: y, z: z, r: r,
      axv: rand(-1.1, 1.1),
      ayv: rand(-0.5, 0.5),
      rx: rand(0, TAU), rxv: rand(-1.1, 1.1),
      ry: rand(0, TAU), ryv: rand(-1.3, 1.3),
      rz: rand(0, TAU), rzv: rand(-0.8, 0.8)
    });
  }

  function spawnCrystals() {
    if (crystals.length >= 12) return;
    var count = 1 + (Math.random() < 0.55 ? 1 : 0);
    var bx = rand(-2.4, 2.4), by = rand(-1.7, 1.7);
    for (var ii = 0; ii < count; ii++) {
      crystals.push({
        x: bx + (ii - (count - 1) / 2) * 1.3,
        y: by, z: rand(-150, -135), phase: rand(0, TAU), age: 0
      });
    }
  }

  // ---- particles ----
  function emitTrail() {
    setRot(shipPitch, shipYaw, shipRoll);
    var el = [-0.38, 0.0, 1.62];
    var s;
    for (s = -1; s <= 1; s += 2) {
      var ex = el[0] * s, ey = el[1], ez = el[2];
      var wx = m00 * ex + m01 * ey + m02 * ez;
      var wy = m10 * ex + m11 * ey + m12 * ez;
      var wz = m20 * ex + m21 * ey + m22 * ez;
      particles.push({
        x: shipX + wx, y: shipY + wy, z: SHIP_Z + wz,
        vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), vz: rand(6, 12),
        life: rand(0.28, 0.5), max: 0.5,
        size: rand(0.06, 0.13),
        r: 255, g: 150, b: 70, add: true, engine: true
      });
    }
  }

  function explode(x, y, z) {
    var colors = [[255, 150, 60], [255, 80, 60], [150, 190, 255], [255, 210, 120], [240, 240, 250]];
    for (var ii = 0; ii < 80; ii++) {
      var c = colors[(Math.random() * colors.length) | 0];
      particles.push({
        x: x, y: y, z: z,
        vx: rand(-9, 9), vy: rand(-7, 7), vz: rand(0, 14),
        life: rand(0.5, 1.5), max: 1.5,
        size: rand(0.06, 0.2),
        r: c[0], g: c[1], b: c[2], add: true
      });
    }
  }

  function sparkle(x, y, z) {
    for (var ii = 0; ii < 16; ii++) {
      particles.push({
        x: x, y: y, z: z,
        vx: rand(-3, 3), vy: rand(-3, 3), vz: rand(-1, 2),
        life: rand(0.35, 0.6), max: 0.6,
        size: rand(0.05, 0.1),
        r: 120, g: 230, b: 255, add: true
      });
    }
  }

  function muzzleFlash(x, y) {
    for (var ii = 0; ii < 10; ii++) {
      particles.push({
        x: x, y: y, z: SHIP_Z - 0.5,
        vx: rand(-2.2, 2.2), vy: rand(-1.6, 1.6), vz: rand(-12, -4),
        life: rand(0.07, 0.18), max: 0.18,
        size: rand(0.05, 0.12),
        r: 150, g: 220, b: 255, add: true
      });
    }
  }

  function aimDirFromEye() {
    if (FL <= 0) return [0, 0, -1];
    var rdx = (pointerX * vw - cx) / FL;
    var rdy = (cy - pointerY * vh) / FL;
    var rl = Math.sqrt(rdx * rdx + rdy * rdy + 1) || 1;
    return [rdx / rl, rdy / rl, -1 / rl];
  }

  // Where the cursor ray lands: nearest asteroid surface, or a very far point.
  function aimEndpoint() {
    var ray = aimDirFromEye();
    var e0 = eye[0], e1 = eye[1], e2 = eye[2];
    var best = AIM_FAR, hit = null;
    for (var i = 0; i < asteroids.length; i++) {
      var a = asteroids[i];
      var rr = a.r + 0.08;
      var ox = e0 - a.x, oy = e1 - a.y, oz = e2 - a.z;
      var b = ox * ray[0] + oy * ray[1] + oz * ray[2];
      var c = ox * ox + oy * oy + oz * oz - rr * rr;
      var disc = b * b - c;
      if (disc < 0) continue;
      var sq = Math.sqrt(disc);
      var t = -b - sq;
      if (t < 0.5) t = -b + sq;
      if (t < 0.5 || t >= best) continue;
      best = t; hit = a;
    }
    return {
      x: e0 + ray[0] * best,
      y: e1 + ray[1] * best,
      z: e2 + ray[2] * best,
      hit: hit
    };
  }

  function shootBolt(sx, sy) {
    var aim = aimEndpoint();
    var sz = SHIP_Z - 0.5;
    var dx = aim.x - sx, dy = aim.y - sy, dz = aim.z - sz;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    shots.push({
      x: sx, y: sy, z: sz,
      vx: dx / len * SHOT_SPEED,
      vy: dy / len * SHOT_SPEED,
      vz: dz / len * SHOT_SPEED,
      pvx: sx, pvy: sy, pvz: sz, dist: 0, alpha: 1
    });
  }

  function fire() {
    if (state !== 'playing' || currentAmmo <= 0) return;
    currentAmmo--;
    updateAmmoHud();
    var off = 0.3;
    shootBolt(shipX - off, shipY + 0.05);
    shootBolt(shipX + off, shipY + 0.05);
    muzzleFlash(shipX - off, shipY + 0.05);
    muzzleFlash(shipX + off, shipY + 0.05);
  }

  function updateAmmoHud() {
    if (fireBtn) fireBtn.disabled = currentAmmo <= 0;
    if (!hudAmmoValue) return;
    hudAmmoValue.textContent = `${currentAmmo}/${AMMO_MAX}`;
    if (hudAmmoBlock) hudAmmoBlock.classList.toggle('is-empty', currentAmmo <= 0);
  }

  window.portfolioGame = {
    isClaimed: function (k) { return ammoClaimed().indexOf(k) !== -1; },
    claimAmmo: function (k) {
      if (!k) return false;
      var list = ammoClaimed();
      if (list.indexOf(k) !== -1) return false;
      list.push(k);
      try { localStorage.setItem(AMMO_KEY, JSON.stringify(list)); } catch (e) {}
      if (state === 'playing') currentAmmo = Math.min(ammoCapacity(), currentAmmo + 1);
      updateAmmoHud();
      if (state === 'playing' && hudAmmoBlock) {
        hudAmmoBlock.classList.add('pop');
        window.setTimeout(function () { hudAmmoBlock.classList.remove('pop'); }, 500);
      }
      return true;
    }
  };

  // ---- update ----
  function update(dt) {
    time += dt;
    var sp = state === 'playing' ? speed : 26;
    var i;

    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.z += sp * dt;
      if (s.z > -3.5) {
        s.z = rand(-205, -150);
        s.x = rand(-12, 12);
        s.y = rand(-6, 6);
        s.px = -1;
      }
    }

    for (i = particles.length - 1; i >= 0; i--) {
      var pp = particles[i];
      pp.x += pp.vx * dt;
      pp.y += pp.vy * dt;
      pp.z += pp.vz * dt;
      pp.life -= dt;
      if (pp.life <= 0) particles.splice(i, 1);
    }

    for (i = popups.length - 1; i >= 0; i--) {
      var pu = popups[i];
      pu.life -= dt;
      pu.wz += sp * dt;
      if (pu.life <= 0) popups.splice(i, 1);
    }

    if (state === 'playing') {
      speed = Math.min(MAX_SPEED, BASE_SPEED + time * 0.55);
      dist += speed * dt;
      score = Math.floor(dist * 0.3) + bonus;
      if (score !== dispScore) {
        dispScore = score;
        hudScoreValue.textContent = String(score);
      }

      spawnTimer -= dt;
      if (spawnTimer <= 0) { spawnAsteroid(); spawnTimer = Math.max(0.42, 1.3 - time * 0.014); }
      crystalTimer -= dt;
      if (crystalTimer <= 0) { spawnCrystals(); crystalTimer = rand(3.0, 6.0); }

      for (i = asteroids.length - 1; i >= 0; i--) {
        var a = asteroids[i];
        a.z += speed * dt;
        a.x += a.axv * dt;
        a.y += a.ayv * dt;
        a.rx += a.rxv * dt;
        a.ry += a.ryv * dt;
        a.rz += a.rzv * dt;
        if (a.z > 8) { asteroids.splice(i, 1); continue; }
        var dx = a.x - shipX, dy = a.y - shipY, dz = a.z - SHIP_Z;
        var rr = a.r + SHIP_R;
        if (dx * dx + dy * dy + dz * dz < rr * rr) { crash(); return; }
      }

      for (i = shots.length - 1; i >= 0; i--) {
        var sh = shots[i];
        sh.pvx = sh.x; sh.pvy = sh.y; sh.pvz = sh.z;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        sh.z += sh.vz * dt;
        sh.dist += SHOT_SPEED * dt;
        sh.alpha = clamp(sh.dist / BOLT_FADE_IN, 0, 1) * clamp((SHOT_RANGE - sh.dist) / BOLT_FADE_OUT, 0, 1);
        if (sh.dist > SHOT_RANGE || sh.z < -900) { shots.splice(i, 1); continue; }
        var hitIdx = -1, hitT = 2;
        if (sh.z !== sh.pvz) {
          for (var js = 0; js < asteroids.length; js++) {
            var as = asteroids[js];
            if (as.z < Math.min(sh.pvz, sh.z) || as.z > Math.max(sh.pvz, sh.z)) continue;
            var tt = (as.z - sh.pvz) / (sh.z - sh.pvz);
            if (tt < 0 || tt > 1) continue;
            var ix = sh.pvx + (sh.x - sh.pvx) * tt;
            var iy = sh.pvy + (sh.y - sh.pvy) * tt;
            var sdx = as.x - ix, sdy = as.y - iy;
            var rr = as.r + 0.12;
            if (sdx * sdx + sdy * sdy < rr * rr && tt < hitT) { hitT = tt; hitIdx = js; }
          }
        }
        if (hitIdx !== -1) {
          var rock = asteroids[hitIdx];
          explode(rock.x, rock.y, rock.z);
          bonus += 15;
          score = Math.floor(dist * 0.3) + bonus;
          dispScore = score;
          hudScoreValue.textContent = String(score);
          popups.push({ wx: rock.x, wy: rock.y, wz: rock.z, life: 1.0, max: 1.0, text: '+15' });
          asteroids.splice(hitIdx, 1);
          shots.splice(i, 1);
        }
      }

      for (i = crystals.length - 1; i >= 0; i--) {
        var c0 = crystals[i];
        c0.z += speed * dt;
        c0.phase += dt * 3.2;
        c0.age += dt;
        if (c0.z > 8) { crystals.splice(i, 1); continue; }
        var off = 0.22 * Math.sin(c0.phase);
        var cdx = c0.x - shipX, cdy = c0.y + off - shipY, cdz = c0.z - SHIP_Z;
        if (cdx * cdx + cdy * cdy + cdz * cdz < 1.15) {
          bonus += 25;
          score = Math.floor(dist * 0.3) + bonus;
          dispScore = score;
          hudScoreValue.textContent = String(score);
          sparkle(c0.x, c0.y, c0.z);
          popups.push({ wx: c0.x, wy: c0.y, wz: c0.z, life: 1.1, max: 1.1, text: '+25' });
          crystals.splice(i, 1);
        }
      }

      var k = 1 - Math.exp(-dt * 6.5);
      var px = shipX, py = shipY;
      shipX += (targetX - shipX) * k;
      shipY += (targetY - shipY) * k;
      playerVx = (shipX - px) / Math.max(dt, 0.001);
      playerVy = (shipY - py) / Math.max(dt, 0.001);
      var mdx = pointerX - prevPointerX;
      var mdy = pointerY - prevPointerY;
      prevPointerX = pointerX;
      prevPointerY = pointerY;
      var ivx = mdx / Math.max(dt, 0.002);
      var ivy = mdy / Math.max(dt, 0.002);
      var vK = 1 - Math.exp(-dt * 14);
      smVx += (ivx - smVx) * vK;
      smVy += (ivy - smVy) * vK;
      targetYaw   = clamp(smVx * 0.30, -0.5, 0.5) + Math.cos(time * 0.62) * 0.004;
      targetPitch = clamp(-smVy * 0.30, -0.4, 0.4) + Math.sin(time * 1.1) * 0.012;
      targetRoll  = clamp(-smVx * 0.34, -0.5, 0.5) + clamp(-playerVx * 0.15, -0.18, 0.18) + Math.sin(time * 0.8) * 0.010;
      var rotK = 1 - Math.exp(-dt * 4.8);
      shipYaw   += (targetYaw   - shipYaw)   * rotK;
      shipPitch += (targetPitch - shipPitch) * rotK;
      shipRoll  += (targetRoll  - shipRoll)  * rotK;
      emitTrail();

    } else if (state === 'idle') {
      shipX = Math.sin(time * 0.5) * 0.55;
      shipY = SHIP_Y0 + Math.sin(time * 0.85) * 0.2;
      shipPitch = Math.sin(time * 1.15) * 0.05;
      shipRoll = Math.sin(time * 0.7) * 0.05;
      shipYaw = Math.cos(time * 0.62) * 0.05;
      if (Math.random() < 0.5) emitTrail();
    }
  }

  function crash() {
    state = 'gameover';
    explode(shipX, shipY, SHIP_Z);
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
    hudEl.classList.add('hidden');
    hudEl.setAttribute('aria-hidden', 'true');
    controlHint.classList.add('hidden');
    overScoreEl.textContent = t('game.overScore') + ': ' + score;
    overBestEl.textContent = t('game.overBest') + ': ' + best;
    overOverlay.classList.remove('hidden');
    overOverlay.setAttribute('aria-hidden', 'false');
    updateTouchMode();
    restartBtn.focus();
  }

  function startGame() {
    time = 0; speed = BASE_SPEED; dist = 0; bonus = 0; score = 0; dispScore = -1;
    shipX = 0; shipY = SHIP_Y0; targetX = 0; targetY = SHIP_Y0;
    playerVx = 0; playerVy = 0;
    shipPitch = 0; shipYaw = 0; shipRoll = 0;
    targetPitch = 0; targetYaw = 0; targetRoll = 0;
    pointerX = 0.5; pointerY = 0.5;
    prevPointerX = 0.5; prevPointerY = 0.5;
    touchId = null;
    smVx = 0; smVy = 0;
    spawnTimer = 1.1; crystalTimer = rand(2.0, 3.2);
    asteroids.length = 0;
    crystals.length = 0;
    particles.length = 0;
    popups.length = 0;
    shots.length = 0;
    state = 'playing';
    startOverlay.classList.add('hidden');
    startOverlay.setAttribute('aria-hidden', 'true');
    overOverlay.classList.add('hidden');
    overOverlay.setAttribute('aria-hidden', 'true');
    hudEl.classList.remove('hidden');
    hudEl.setAttribute('aria-hidden', 'false');
    hudScoreValue.textContent = '0';
    hudBestValue.textContent = String(best);
    currentAmmo = ammoCapacity();
    updateAmmoHud();
    updateTouchMode();
    updateHintText();
    controlHint.classList.remove('hidden');
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(function () { controlHint.classList.add('hidden'); }, 3600);
  }

  // ---- render ----
  function drawBolt(sh) {
    var head = projectPoint(sh.x, sh.y, sh.z);
    if (!head) return;
    var tail = projectPoint(sh.x - sh.vx * 0.006, sh.y - sh.vy * 0.006, sh.z - sh.vz * 0.006);
    if (!tail) return;
    var a = sh.alpha === undefined ? 1 : sh.alpha;
    if (a <= 0.01) return;
    var hx = head[0], hy = head[1];
    var glow = 12 * a;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(150,80,255,' + (0.45 * a) + ')';
    ctx.lineWidth = 2.4 * a;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tail[0], tail[1]);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.lineCap = 'butt';
    var gr = ctx.createRadialGradient(hx, hy, 0, hx, hy, glow);
    gr.addColorStop(0, 'rgba(225,180,255,' + (0.95 * a) + ')');
    gr.addColorStop(0.45, 'rgba(170,90,255,' + (0.55 * a) + ')');
    gr.addColorStop(1, 'rgba(110,30,210,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(hx, hy, glow, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(245,225,255,' + (0.95 * a) + ')';
    ctx.beginPath();
    ctx.arc(hx, hy, 2.2 * a, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawParticles(enginePass) {
    if (!particles.length) return;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < particles.length; i++) {
      var pp = particles[i];
      if (!!pp.engine !== enginePass) continue;
      var ppr = projectPoint(pp.x, pp.y, pp.z);
      if (!ppr) continue;
      var pa = clamp(pp.life / pp.max, 0, 1);
      var sr = clamp(pp.size * ppr[3] * 0.8, 1, 14);
      ctx.fillStyle = 'rgba(' + pp.r + ',' + pp.g + ',' + pp.b + ',' + (pa * 0.55) + ')';
      ctx.beginPath();
      ctx.arc(ppr[0], ppr[1], sr * 1.8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(' + pp.r + ',' + pp.g + ',' + pp.b + ',' + pa + ')';
      ctx.beginPath();
      ctx.arc(ppr[0], ppr[1], sr * 0.7, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function render() {
    ctx.drawImage(nebula, 0, 0, vw, vh);
    updateView();

    var i;

    // stars
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      var pr = projectPoint(s.x, s.y, s.z);
      if (!pr) continue;
      var depth = pr[2];
      var tNear = clamp(1 - (depth - 16) / 170, 0, 1);
      var r = 0.5 + tNear * 2.4;
      var alpha = 0.22 + tNear * 0.75;
      if (s.px >= 0) {
        ctx.strokeStyle = 'rgba(' + s.tint[0] + ',' + s.tint[1] + ',' + s.tint[2] + ',' + (alpha * 0.55) + ')';
        ctx.lineWidth = r * 0.45;
        ctx.beginPath();
        ctx.moveTo(s.px, s.py);
        ctx.lineTo(pr[0], pr[1]);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(' + s.tint[0] + ',' + s.tint[1] + ',' + s.tint[2] + ',' + alpha + ')';
      ctx.beginPath();
      ctx.arc(pr[0], pr[1], r, 0, TAU);
      ctx.fill();
      s.px = pr[0]; s.py = pr[1];
    }
    ctx.globalCompositeOperation = 'source-over';

    var drawList = [];
    for (i = 0; i < asteroids.length; i++) {
      drawList.push({ z: asteroids[i].z, obj: asteroids[i], kind: 'ast' });
    }
    for (i = 0; i < crystals.length; i++) {
      drawList.push({ z: crystals[i].z, obj: crystals[i], kind: 'cr' });
    }
    for (i = 0; i < shots.length; i++) {
      drawList.push({ z: shots[i].z, obj: shots[i], kind: 'shot' });
    }
    drawList.sort(function (a, b) { return a.z - b.z; });

    for (i = 0; i < drawList.length; i++) {
      var d = drawList[i];
      if (d.kind === 'ast') {
        var a = d.obj;
        drawMesh(rockMesh, a.rx, a.ry, a.rz, a.r, a.x, a.y, a.z, 260);
      } else if (d.kind === 'shot') {
        drawBolt(d.obj);
      } else {
        var cr = d.obj;
        var bob = 0.22 * Math.sin(cr.phase);
        var crFade = clamp(cr.age / CRYSTAL_FADE_IN, 0, 1);
        ctx.globalAlpha = crFade;
        drawMesh(crystalMesh, 0.35, cr.phase, 0.2, 0.5, cr.x, cr.y + bob, cr.z, 260);
        ctx.globalAlpha = crFade;
        var cpr = projectPoint(cr.x, cr.y + bob, cr.z);
        if (cpr) {
          var glowR = clamp(46 - cpr[2] * 0.15, 6, 40);
          var cg = ctx.createRadialGradient(cpr[0], cpr[1], 0, cpr[0], cpr[1], glowR);
          cg.addColorStop(0, 'rgba(150,240,255,0.7)');
          cg.addColorStop(1, 'rgba(120,220,255,0)');
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(cpr[0], cpr[1], glowR, 0, TAU);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = 1;
      }
    }

    // particles (trail & sparks) — exhaust drawn after the ship below
    drawParticles(false);

    // aim guide — reticle marks where the shot lands (asteroid surface or far point)
    if (state === 'playing' && currentAmmo > 0 && FL > 0) {
      var aim = aimEndpoint();
      var npr = projectPoint(shipX, shipY + 0.05, SHIP_Z - 0.5);
      var apr = projectPoint(aim.x, aim.y, aim.z);
      if (npr && apr) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(150,225,255,0.22)';
        ctx.lineWidth = 1.1;
        if (ctx.setLineDash) ctx.setLineDash([5, 10]);
        ctx.beginPath();
        ctx.moveTo(npr[0], npr[1]);
        ctx.lineTo(apr[0], apr[1]);
        ctx.stroke();
        if (ctx.setLineDash) ctx.setLineDash([]);
        var ar = 7, atick = 3.5, arm2 = 12;
        ctx.strokeStyle = aim.hit ? 'rgba(255,150,150,0.95)' : 'rgba(185,240,255,0.8)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(apr[0], apr[1], ar, 0, TAU);
        ctx.moveTo(apr[0] - arm2, apr[1]); ctx.lineTo(apr[0] - atick, apr[1]);
        ctx.moveTo(apr[0] + atick, apr[1]); ctx.lineTo(apr[0] + arm2, apr[1]);
        ctx.moveTo(apr[0], apr[1] - arm2); ctx.lineTo(apr[0], apr[1] - atick);
        ctx.moveTo(apr[0], apr[1] + atick); ctx.lineTo(apr[0], apr[1] + arm2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(200,245,255,0.9)';
        ctx.beginPath();
        ctx.arc(apr[0], apr[1], 1.6, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // ship
    if (state !== 'gameover') {
      drawMesh(shipMesh, shipPitch, shipYaw, shipRoll, SHIP_SCALE, shipX, shipY, SHIP_Z, 40);
      drawParticles(true);
    }

    // popups
    if (popups.length) {
      ctx.textAlign = 'center';
      ctx.font = '700 15px ui-monospace, Menlo, Consolas, monospace';
      for (i = 0; i < popups.length; i++) {
        var pu = popups[i];
        var pur = projectPoint(pu.wx, pu.wy, pu.wz);
        if (!pur) continue;
        var pa2 = clamp(pu.life / pu.max, 0, 1);
        var rise = (1 - pa2) * 26;
        ctx.fillStyle = 'rgba(150,235,255,' + pa2.toFixed(3) + ')';
        ctx.fillText(pu.text, pur[0], pur[1] - rise);
      }
      ctx.textAlign = 'left';
    }
  }

  // ---- resize ----
  function resize() {
    vw = shell.clientWidth || canvas.clientWidth || 800;
    vh = canvas.clientHeight || Math.min(shell.clientHeight, 600) || 480;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(vw * dpr));
    canvas.height = Math.max(1, Math.round(vh * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = vw / 2;
    cy = vh * 0.56;
    FL = (vh / 2) / Math.tan(FOV / 2);
    makeNebula();
  }

  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(shell);
  resize();

  // ---- loop ----
  var last = 0;
  var running = false;
  function frame(now) {
    requestAnimationFrame(frame);
    if (last) {
      var dt = (now - last) / 1000;
      if (dt > 0.05) dt = 0.05;
      update(dt);
      render();
    }
    last = now;
  }

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      var vis = entries[0] && entries[0].isIntersecting;
      if (vis && !running) {
        running = true;
        last = 0;
        requestAnimationFrame(frame);
      } else if (!vis && running) {
        running = false;
      }
    }).observe(shell);
  } else {
    running = true;
    requestAnimationFrame(frame);
  }

  // ---- controls ----
  function setTarget(e) {
    if (state !== 'playing') return;
    if (touchControls && e.target && touchControls.contains(e.target)) return;
    var r = canvas.getBoundingClientRect();

    if (e.pointerType === 'touch') {
      if (touchId === null) {
        touchId = e.pointerId;
        touchLastX = e.clientX;
        touchLastY = e.clientY;
        return;
      }
      if (e.pointerId !== touchId) return;
      var tdx = e.clientX - touchLastX;
      var tdy = e.clientY - touchLastY;
      touchLastX = e.clientX;
      touchLastY = e.clientY;
      pointerX = clamp(pointerX + tdx / r.width, 0, 1);
      pointerY = clamp(pointerY + tdy / r.height, 0, 1);
      targetX = clamp(targetX + tdx * (6.4 / r.width), -3.9, 3.9);
      targetY = clamp(targetY - tdy * ((SHIP_Y_MAX - SHIP_Y_MIN) / r.height), SHIP_Y_MIN, SHIP_Y_MAX);
      return;
    }

    pointerX = (e.clientX - r.left) / r.width;
    pointerY = (e.clientY - r.top) / r.height;
    targetX = clamp((pointerX - 0.5) * 6.4, -3.9, 3.9);
    targetY = SHIP_Y0 + (0.5 - pointerY) * (pointerY < 0.5 ? SHIP_Y_RANGE_UP : SHIP_Y_RANGE_DOWN);
    targetY = clamp(targetY, SHIP_Y_MIN, SHIP_Y_MAX);
  }

  if (fireBtn) {
    fireBtn.addEventListener('pointerdown', function (e) {
      if (state !== 'playing') return;
      e.preventDefault();
      fire();
    });
  }

  window.addEventListener('pointermove', setTarget);

  window.addEventListener('pointerdown', function (e) {
    if (state !== 'playing') return;
    if (e.target === canvas) {
      if (e.pointerType === 'touch') {
        touchId = e.pointerId;
        touchLastX = e.clientX;
        touchLastY = e.clientY;
        if (canvas.setPointerCapture) {
          try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        }
      } else {
        setTarget(e);
        fire();
        if (canvas.setPointerCapture) {
          try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        }
      }
    }
  });

  function endTouchDrag(e) {
    if (e.pointerId === touchId) touchId = null;
  }

  window.addEventListener('pointerup', endTouchDrag);
  window.addEventListener('pointercancel', endTouchDrag);

  canvas.addEventListener('touchmove', function (e) {
    if (state === 'playing') e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('click', function () {
    if (state === 'idle' || state === 'gameover') startGame();
  });

  startBtn.addEventListener('click', function (e) { e.stopPropagation(); startGame(); });
  restartBtn.addEventListener('click', function (e) { e.stopPropagation(); startGame(); });

  document.addEventListener('langchange', function () {
    if (state === 'gameover') {
      overScoreEl.textContent = t('game.overScore') + ': ' + score;
      overBestEl.textContent = t('game.overBest') + ': ' + best;
    }
    updateHintText();
  });

  updateHintText();
  updateTouchMode();
})();
