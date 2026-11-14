(function () {
  "use strict";
  var errbox = document.getElementById("errbox");
  var errShownReal = false;
  function showErr(msg) {
    if (!msg) msg = "unknown";
    if (errShownReal && msg === "Script error.") return;
    if (msg !== "Script error.") errShownReal = true;
    errbox.style.display = "block";
    errbox.textContent = "Error: " + msg;
  }
  window.addEventListener("error", function (e) {
    showErr(e.message || "unknown");
  });
  window.addEventListener("unhandledrejection", function (e) {
    showErr((e.reason && e.reason.message) || "promise rejected");
  });
  function boot() {
    var REDUCED =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var stage = document.getElementById("stage");
    var renderer = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (e1) {
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          powerPreference: "low-power",
        });
      } catch (e2) {
        throw new Error(
          "WebGL tidak tersedia di perangkat ini (" +
            ((e1 && e1.message) || e1) +
            ")",
        );
      }
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    stage.insertBefore(renderer.domElement, stage.firstChild);
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(658189);
    var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    camera.position.set(15, 12, 15);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.2, -0.2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.5;
    controls.maxDistance = 34;
    controls.maxPolarAngle = 1.38;
    controls.enablePan = false;
    try {
      var pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(
        new THREE.RoomEnvironment(),
        0.04,
      ).texture;
    } catch (e) {}
    var hemi = new THREE.HemisphereLight(15398143, 9072461, 0.25);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(16773590, 3.2);
    sun.position.set(-10, 16, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -2e-4;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 1;
    sun.target.position.set(0, 0.4, 0);
    scene.add(sun);
    scene.add(sun.target);
    var sunDay = new THREE.Color(16774112),
      sunLow = new THREE.Color(16749640),
      sunDeep = new THREE.Color(16742958),
      sunNight = new THREE.Color(9416936);
    var fill = new THREE.DirectionalLight(14479103, 0.2);
    fill.position.set(10, 8, 12);
    scene.add(fill);
    var roomLamp = new THREE.PointLight(16767392, 2, 14, 1.8);
    roomLamp.position.set(0, 2.75, 0.8);
    scene.add(roomLamp);
    function mat(color, rough, metal) {
      return new THREE.MeshStandardMaterial({
        color: color,
        roughness: rough === undefined ? 0.75 : rough,
        metalness: metal === undefined ? 0 : metal,
      });
    }
    function rbox(w, h, d, color, rough) {
      var m = new THREE.Mesh(
        new THREE.RoundedBoxGeometry(w, h, d, 3, Math.min(0.045, h * 0.3)),
        mat(color, rough === undefined ? 0.7 : rough),
      );
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    }
    function box(w, h, d, color, rough) {
      var m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        mat(color, rough === undefined ? 0.8 : rough),
      );
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    }
    function cyl(rt, rb, h, color, seg, rough) {
      var m = new THREE.Mesh(
        new THREE.CylinderGeometry(rt, rb, h, seg || 20),
        mat(color, rough === undefined ? 0.7 : rough),
      );
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    }
    function sph(r, color, rough) {
      var m = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 18),
        mat(color, rough === undefined ? 0.65 : rough),
      );
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    }
    function P(parent, obj, x, y, z, ry) {
      obj.position.set(x || 0, y || 0, z || 0);
      if (ry) obj.rotation.y = ry;
      parent.add(obj);
      return obj;
    }
    var lampGlowMats = [];
    var spotGlowMats = [];
    var screenMats = [];
    function glowMat(color, base) {
      var m = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.35,
        emissive: color,
        emissiveIntensity: base,
      });
      m.userData.base = base;
      lampGlowMats.push(m);
      return m;
    }
    function enforceShadows(root) {
      root.traverse(function (o) {
        if (!o.isMesh) return;
        var m = o.material;
        if (m && (m.transparent || m.isMeshBasicMaterial)) return;
        o.castShadow = true;
        o.receiveShadow = true;
      });
    }
    var viewCanvas = document.createElement("canvas");
    viewCanvas.width = 512;
    viewCanvas.height = 288;
    var viewTex = new THREE.CanvasTexture(viewCanvas);
    viewTex.colorSpace = THREE.SRGBColorSpace;
    var starPts = [],
      bldgWins = [];
    (function seedView() {
      var rnd = 7;
      function srnd() {
        rnd = (rnd * 16807) % 2147483647;
        return rnd / 2147483647;
      }
      for (var i = 0; i < 80; i++)
        starPts.push({
          x: srnd() * 512,
          y: srnd() * 150,
          r: 0.6 + srnd() * 1.3,
        });
      for (var b = 0; b < 4; b++) {
        var bx = 330 + b * 46,
          bw = 34,
          by = 120 + (b % 2) * 22,
          bh = 288 - by;
        for (var wy = 0; wy < Math.floor(bh / 17); wy++)
          for (var wx = 0; wx < 3; wx++)
            if (srnd() > 0.45)
              bldgWins.push({ x: bx + 6 + wx * 10, y: by + 8 + wy * 17 });
      }
    })();
    function lerpC(a, b, t) {
      return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
      ];
    }
    function cssC(c) {
      return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
    }
    function drawView(df, elev, gold, sp) {
      var g = viewCanvas.getContext("2d");
      if (elev === undefined) elev = 1;
      if (gold === undefined) gold = 0;
      if (sp === undefined) sp = 0.5;
      var nt = 1 - df;
      var skyNt = elev > 0 ? Math.min(1, Math.max(0, 1 - elev / 0.5)) : nt;
      var dusk = elev > 0 ? gold * Math.min(1, elev / 0.05) : 0;
      var top = lerpC([110, 178, 224], [10, 20, 38], skyNt),
        bot = lerpC([232, 246, 253], [34, 54, 78], skyNt);
      if (dusk > 0) {
        top = lerpC(top, [56, 36, 66], dusk * 0.55);
        bot = lerpC(bot, [255, 120, 44], dusk * 0.85);
      }
      var grad = g.createLinearGradient(0, 0, 0, 288);
      grad.addColorStop(0, cssC(top));
      grad.addColorStop(1, cssC(bot));
      g.fillStyle = grad;
      g.fillRect(0, 0, 512, 288);
      if (elev <= 0 && nt > 0.04) {
        g.globalAlpha = nt;
        g.fillStyle = "#ffffff";
        starPts.forEach(function (s) {
          g.beginPath();
          g.arc(s.x, s.y, s.r, 0, 6.29);
          g.fill();
        });
        g.fillStyle = "#f4ecd8";
        g.beginPath();
        g.arc(452, 52, 17, 0, 6.29);
        g.fill();
        g.fillStyle = cssC(top);
        g.beginPath();
        g.arc(463, 46, 14, 0, 6.29);
        g.fill();
        g.globalAlpha = 1;
      }
      if (elev > 0) {
        var sx = 70 + sp * 150,
          sy = 176 - elev * 138,
          sr = 20 + gold * 9;
        g.globalAlpha = Math.min(1, 0.25 + elev / 0.03);
        g.fillStyle = cssC(lerpC([255, 217, 77], [255, 110, 30], gold));
        g.beginPath();
        g.arc(sx, sy, sr, 0, 6.29);
        g.fill();
        g.fillStyle = cssC(lerpC([255, 233, 138], [255, 170, 80], gold));
        g.beginPath();
        g.arc(sx, sy, sr * 0.68, 0, 6.29);
        g.fill();
        g.globalAlpha = 1;
      }
      var cloudAmt = 1 - skyNt;
      if (cloudAmt > 0.1) {
        g.globalAlpha = 0.85 * cloudAmt;
        g.fillStyle = cssC(lerpC([255, 255, 255], [255, 176, 116], gold * 0.8));
        [
          [150, 52],
          [196, 44],
          [330, 70],
          [368, 62],
          [60, 110],
        ].forEach(function (cl) {
          g.beginPath();
          g.arc(cl[0], cl[1], 13, 0, 6.29);
          g.arc(cl[0] + 16, cl[1] + 3, 10, 0, 6.29);
          g.arc(cl[0] - 16, cl[1] + 4, 9, 0, 6.29);
          g.fill();
        });
        g.globalAlpha = 1;
      }
      var farH = lerpC([127, 176, 105], [16, 36, 54], skyNt);
      if (dusk > 0) farH = lerpC(farH, [58, 36, 38], dusk * 0.55);
      g.fillStyle = cssC(farH);
      g.beginPath();
      g.moveTo(0, 200);
      g.quadraticCurveTo(90, 150, 190, 196);
      g.quadraticCurveTo(280, 232, 380, 192);
      g.quadraticCurveTo(450, 164, 512, 196);
      g.lineTo(512, 288);
      g.lineTo(0, 288);
      g.fill();
      var bld = lerpC([148, 178, 190], [10, 17, 28], skyNt);
      if (dusk > 0) bld = lerpC(bld, [52, 32, 36], dusk * 0.55);
      g.fillStyle = cssC(bld);
      for (var b = 0; b < 4; b++) {
        var bx = 330 + b * 46,
          by = 120 + (b % 2) * 22;
        g.fillRect(bx, by, 34, 288 - by);
      }
      if (skyNt > 0.05) {
        g.globalAlpha = skyNt * 0.95;
        g.fillStyle = "#ffd98a";
        bldgWins.forEach(function (w) {
          g.fillRect(w.x, w.y, 5, 7);
        });
        g.globalAlpha = 1;
      }
      var nearH = lerpC([93, 155, 106], [11, 26, 40], skyNt);
      if (dusk > 0) nearH = lerpC(nearH, [46, 30, 32], dusk * 0.55);
      g.fillStyle = cssC(nearH);
      g.beginPath();
      g.moveTo(0, 244);
      g.quadraticCurveTo(120, 206, 250, 240);
      g.quadraticCurveTo(390, 268, 512, 232);
      g.lineTo(512, 288);
      g.lineTo(0, 288);
      g.fill();
      viewTex.needsUpdate = true;
    }
    drawView(1);
    var office = new THREE.Group();
    scene.add(office);
    var FW = 12.6,
      FD = 9.8;
    var MUSTARD = 12422196;
    function plant(x, z, s) {
      var grp = new THREE.Group();
      var pot = cyl(0.26 * s, 0.2 * s, 0.42 * s, 13201226, 14);
      pot.position.y = 0.21 * s;
      grp.add(pot);
      var trunk = cyl(0.045 * s, 0.06 * s, 0.7 * s, 8016432, 8);
      trunk.position.y = 0.7 * s;
      grp.add(trunk);
      [
        [0, 1.35, 0, 0.5],
        [0.3, 1.15, 0.15, 0.38],
        [-0.3, 1.2, -0.1, 0.4],
        [0.05, 1.55, -0.15, 0.34],
      ].forEach(function (f) {
        var leaf = sph(f[3] * s, 3504458, 0.9);
        leaf.position.set(f[0] * s, f[1] * s, f[2] * s);
        grp.add(leaf);
      });
      grp.position.set(x, 0, z);
      office.add(grp);
      return grp;
    }
    (function buildShell() {
      var c = document.createElement("canvas");
      c.width = c.height = 512;
      var g = c.getContext("2d");
      g.fillStyle = "#d8b285";
      g.fillRect(0, 0, 512, 512);
      for (var y = 0; y < 8; y++) {
        for (var x = 0; x < 2; x++) {
          var off = (y % 2) * 128;
          g.fillStyle = ["#dbb287", "#d2a878", "#e2c096", "#cba06e"][
            (x + y) % 4
          ];
          g.fillRect(x * 256 + off - 128, y * 64, 254, 62);
        }
      }
      g.strokeStyle = "rgba(150,105,55,.32)";
      g.lineWidth = 2;
      for (var i = 0; i <= 8; i++) {
        g.beginPath();
        g.moveTo(0, i * 64);
        g.lineTo(512, i * 64);
        g.stroke();
      }
      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2.1, 1.65);
      tex.colorSpace = THREE.SRGBColorSpace;
      var floor = new THREE.Mesh(
        new THREE.BoxGeometry(FW, 0.5, FD),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
      );
      floor.position.y = -0.25;
      floor.receiveShadow = true;
      office.add(floor);
      var slab = box(FW + 0.8, 0.55, FD + 0.8, 3682602, 0.95);
      slab.position.y = -0.76;
      office.add(slab);
      var shadowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(11, 44),
        new THREE.MeshBasicMaterial({
          color: 0,
          transparent: true,
          opacity: 0.42,
        }),
      );
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.y = -1.08;
      office.add(shadowDisc);
      var wallMat = mat(15920867, 0.95);
      var back = new THREE.Mesh(new THREE.BoxGeometry(FW, 4.4, 0.35), wallMat);
      back.position.set(0, 2.2, -FD / 2 + 0.17);
      back.receiveShadow = true;
      back.castShadow = true;
      office.add(back);
      function leftSeg(h, len, cy, cz) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, len), wallMat);
        m.position.set(-FW / 2 + 0.17, cy, cz);
        m.receiveShadow = true;
        m.castShadow = true;
        office.add(m);
      }
      leftSeg(0.85, 4.2, 0.425, -1.2);
      leftSeg(0.95, 4.2, 3.925, -1.2);
      leftSeg(4.4, 4, 2.2, 2.9);
      leftSeg(4.4, 1.6, 2.2, -4.1);
      var trim = box(FW, 0.26, 0.4, 12159574, 0.8);
      trim.position.set(0, 4.32, -FD / 2 + 0.17);
      office.add(trim);
      var trim2 = box(0.4, 0.26, FD, 12159574, 0.8);
      trim2.position.set(-FW / 2 + 0.17, 4.32, 0);
      office.add(trim2);
      var skirt = box(FW, 0.22, 0.06, 14996398, 0.9);
      skirt.position.set(0, 0.11, -FD / 2 + 0.37);
      office.add(skirt);
      var skirt2 = box(0.06, 0.22, 1.6, 14996398, 0.9);
      skirt2.position.set(-FW / 2 + 0.37, 0.11, -4.1);
      office.add(skirt2);
      var skirt3 = box(0.06, 0.22, 4, 14996398, 0.9);
      skirt3.position.set(-FW / 2 + 0.37, 0.11, 2.9);
      office.add(skirt3);
      var view = new THREE.Mesh(
        new THREE.PlaneGeometry(4.5, 2.75),
        new THREE.MeshBasicMaterial({ map: viewTex }),
      );
      view.rotation.y = Math.PI / 2;
      view.position.set(-FW / 2 - 0.35, 2.15, -1.2);
      office.add(view);
      var wf = mat(16777215, 0.5);
      function wbar(w, h, d, x, y, z) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wf);
        m.position.set(x, y, z);
        m.castShadow = true;
        office.add(m);
      }
      wbar(0.1, 0.12, 4.4, -FW / 2 + 0.36, 3.45, -1.2);
      wbar(0.1, 0.12, 4.4, -FW / 2 + 0.36, 0.85, -1.2);
      wbar(0.1, 2.72, 0.12, -FW / 2 + 0.36, 2.15, -3.3);
      wbar(0.1, 2.72, 0.12, -FW / 2 + 0.36, 2.15, 0.9);
      wbar(0.08, 2.5, 0.07, -FW / 2 + 0.37, 2.15, -1.2);
      wbar(0.08, 0.07, 4.1, -FW / 2 + 0.37, 2.15, -1.2);
      var sill = box(0.34, 0.08, 4.5, 16777215, 0.5);
      sill.position.set(-FW / 2 + 0.42, 0.81, -1.2);
      office.add(sill);
      var pc = document.createElement("canvas");
      pc.width = 1200;
      pc.height = 500;
      var pg = pc.getContext("2d");
      pg.fillStyle = "#000000";
      pg.fillRect(0, 0, 1200, 500);
      pg.fillStyle = "#ffffff";
      var MAP_RINGS =
        "89,85 97,90 85,108 91,118 87,120 94,149 84,146 80,130 61,109 51,107 27,84 18,62 29,59 48,70 77,69 90,85|32,133 35,129 51,141 47,143 33,135|120,242 122,250 112,247 105,235 108,228 113,227 119,241|141,276 141,268 146,272 142,277|153,290 146,275 153,281 153,289|170,247 175,261 168,268 149,224 135,204 120,198 129,190 140,190 138,180 148,185 149,195 162,197 163,212 190,232 180,247 171,247|416,414 399,407 410,398 411,403 418,405 420,415|108,107 141,128 139,139 143,133 145,139 146,134 150,139 149,157 153,162 143,169 146,184 137,181 140,190 129,190 119,197 108,164 111,161 94,149 87,120 91,118 85,108 95,93 94,100 104,101 109,108|87,181 87,188 82,189 66,167 75,165 89,179|279,251 282,244 291,250 288,243 297,245 303,266 317,270 311,278 315,283 294,276 285,254 277,259 273,254|350,285 347,288 343,282 337,287 338,270 354,274 352,285|" +
        "1032,276 1020,291 1047,300 1038,313 1032,306 1040,305 1028,308 1024,303 1022,308 1018,300 1014,303 1011,295 1007,298 1006,287 1011,281 1013,284 1010,278 1006,292 999,289 1004,296 995,296 1000,296 1001,303 995,300 1000,304 988,309 982,297 988,295 985,289 962,275 984,275 995,266 999,269 995,274 1000,275 1000,268 1002,274 1006,269 1006,277 1007,271 1013,273 1010,267 1015,270 1014,256 1005,261 1001,258 1004,261 972,262 965,257 972,250 963,254 967,244 961,248 963,240 959,245 956,237 951,242 953,236 949,243 947,237 945,242 936,240 944,232 944,225 974,213 999,223 1014,222 1022,238 1017,247 1019,264 1027,277 1028,267 1032,271|923,209 920,206 939,204 946,208 944,214 930,206 935,215 930,211 926,215 926,210 918,209 922,210|929,229 939,228 937,239 931,231|917,257 905,252 922,247 925,255 919,257|491,402 502,399 513,404 510,423 516,429 481,417 466,421 444,416 441,419 421,414 432,405 428,390 436,393 442,377 464,379 471,399 488,402|498,380 504,383 489,390 467,385 472,381 488,381|371,189 374,165 389,150 390,162 413,182 430,176 446,178 462,163 475,163 475,168 492,172 506,168 495,189 482,198 487,205 481,217 462,223 455,220 420,246 428,273 415,282 414,277 405,280 402,271 409,263 403,268 402,256 396,251 400,238 387,222 392,219 376,218 377,203 382,204 370,191|381,222 392,226 390,230 381,227 379,221|514,295 510,291 516,276 534,261 537,241 546,237 541,243 548,265 567,266 558,269 558,273 563,270 559,281 555,276 554,282 560,284 554,284 557,287 552,296 519,311 515,295|554,295 560,286 560,304 554,308 553,298|" +
        "579,234 573,237 571,229 572,239 555,250 564,249 559,253 564,252 564,257 557,256 561,258 557,261 567,259 567,266 548,265 541,243 549,233 537,225 534,205 525,209 521,201 530,194 526,185 506,190 497,187 498,177 511,165 530,176 539,176 540,169 551,166 565,140 585,137 600,145 604,141 606,146 594,147 594,151 629,178 613,183 603,178 605,184 598,184 592,193 590,216 583,228|250,177 259,172 259,183 257,177 251,178|261,207 270,212 255,210 257,204 260,206|252,213 259,216 257,220 253,221 251,214|350,108 354,108 346,101 353,95 357,102 355,110 349,109|291,347 288,356 277,344 274,353 260,345 263,356 259,356 234,330 253,329 254,316 270,311 278,300 293,318 291,341|817,298 810,290 812,284 835,284 842,291 841,298 823,301|1023,350 1028,346 1035,355 1023,358 1026,353 1021,349|1031,356 1034,366 1022,361 1030,357|1021,364 1029,373 1020,382 1018,369 1023,374 1017,362|880,277 888,276 890,280 900,275 922,281 934,293 934,303 910,290 900,289 900,293 884,286 873,293 866,283 859,295 857,285 874,277|945,395 956,387 954,400 945,410 941,409 943,399|831,401 821,409 804,409 808,401 830,400|906,411 902,404 909,405 907,410|850,182 846,172 860,147 857,156 861,159 861,170 852,181 858,182 866,168 879,163 879,176 866,183 884,198 863,191 857,196 862,214 872,227 853,211 851,182|852,221 857,225 847,225 843,212 850,212 850,219|860,242 865,247 848,248 846,240 858,240|877,145 867,153 866,145 875,136 879,140|" +
        "784,248 792,252 768,256 768,246 781,248|808,253 795,254 794,249 812,252|608,415 621,417 621,423 623,417 630,417 633,429 623,427 629,430 616,432 614,424 601,434 579,438 571,434 573,423 581,419 593,420 599,428 611,426 596,415 608,413|550,429 559,416 571,418 567,432 553,433 550,428|764,465 744,470 752,462 748,462 750,451 759,444 767,447 770,439 782,434 789,436 783,440 786,447 768,465|743,419 756,416 746,424 738,424 741,420|653,422 666,416 694,425 707,421 714,426 730,416 727,412 732,413 728,424 698,433 652,431 652,421|734,479 742,472 743,478 728,485 727,481 733,479|647,456 630,452 628,449 634,445 654,442 662,452 670,453 677,463 667,469 650,459|785,418 769,421 770,413 786,413 787,418|759,417 766,414 762,423 757,418|" +
        "1187,267 1187,271 1195,271 1195,366 1191,375 1194,381 1195,438 1169,414 1171,407 1167,412 1145,412 1142,417 1139,412 1146,398 1135,389 1154,387 1161,391 1165,386 1156,390 1129,367 1124,355 1132,355 1122,353 1129,349 1124,348 1125,343 1119,345 1125,339 1118,343 1121,337 1119,345 1115,342 1121,335 1111,342 1117,334 1111,339 1114,334 1107,335 1109,329 1105,336 1105,329 1103,335 1104,329 1100,332 1103,328 1099,333 1098,327 1097,332 1096,326 1095,332 1094,327 1091,331 1085,325 1085,329 1068,322 1068,318 1046,318 1038,313 1047,300 1020,291 1032,276 1034,281 1037,278 1037,287 1054,290 1076,261 1099,258 1096,249 1104,251 1101,247 1114,241 1117,246 1121,246 1117,243 1135,250 1163,264 1185,266|1062,231 1059,224 1053,223 1055,226 1050,220 1063,222 1076,231 1061,232|1152,389 1140,388 1132,382 1142,380 1152,388|1071,252 1051,245 1090,250 1072,253|1124,395 1137,393 1146,398 1141,411 1130,418 1109,421 1119,399|1141,419 1132,417 1139,413 1141,417|" +
        "191,227 184,228 163,212 162,197 149,195 143,169 152,165 150,139 158,150 168,145 178,160 197,168 196,175 203,183 216,185 221,192 203,198 227,190 238,198 239,204 230,205 230,213 232,209 239,212 229,217 231,224 219,223 209,233 193,226|178,156 179,151 187,153 186,158 179,159|194,162 205,165 206,172 193,163|204,176 205,180 200,178 198,167 205,173|216,184 204,183 212,177 209,181 213,178 218,186|645,321 646,306 640,286 646,284 642,274 649,273 646,259 655,254 664,257 666,252 673,261 699,269 702,273 689,283 680,276 682,270 660,280 666,288 667,323 662,336 667,348 641,348 642,326|667,368 667,353 670,359 668,371|207,311 168,267 175,262 208,289 218,290 209,301 220,313 230,315 229,320 238,327 229,329 213,316|" +
        "682,241 697,224 705,229 712,224 731,223 725,221 734,218 743,221 741,231 735,225 727,228 717,242 703,247 698,254 689,250 719,285 698,278 699,269 673,261 666,252 664,257 650,256 653,250 640,239 647,222 652,226 650,207 645,204 651,206 649,198 662,179 671,184 678,169 693,170 695,176 711,177 689,182 685,186 690,192 668,191 659,199 658,223 668,229 673,240 680,240|736,238 730,245 730,234 737,233 739,240 747,237 739,246 735,245 737,237|790,165 771,192 744,195 745,187 737,179 757,182 773,173 772,169 783,159 787,162|831,92 830,100 827,100 828,87 831,88|721,346 728,338 729,320 734,316 738,322 730,337 738,340 723,350|696,327 693,322 697,308 678,294 683,275 688,283 698,278 709,280 717,291 712,296 724,304 720,306 724,311 729,310 729,317 724,315 726,320 709,320 707,329 697,327|704,343 703,335 708,336 705,345|723,341 713,341 715,328 724,322 723,339|739,310 735,313 731,308 739,308|532,428 529,431 530,427 516,420 512,412 538,413 545,420 532,428|297,355 314,359 315,367 307,367 306,383 276,379 290,371 295,356|717,190 702,193 690,192 685,186 715,177 728,183 735,180 746,189 741,196 734,190 720,191|314,364 313,360 321,360 319,368 315,366|195,275 181,270 170,247 180,247 192,226 209,233 221,223 231,224 239,231 254,230 257,246 234,251 230,264 224,259 224,263 215,263 208,273 196,274|362,376 368,377 361,391 367,401 358,405 305,392 310,384 306,383 307,367 319,368 321,356 338,364 356,364 361,370|442,377 436,393 428,390 432,405 421,415 418,405 411,403 410,398 399,407 367,401 361,392 368,377 410,383 417,369 438,374|" +
        "546,237 537,241 534,261 516,276 510,293 492,293 492,284 484,288 476,280 464,292 456,289 446,295 442,276 438,281 417,281 428,273 420,246 455,220 462,223 481,217 487,205 482,198 497,187 512,191 524,183 530,194 521,201 525,209 534,205 533,215 547,235|634,293 627,294 623,275 633,267 639,251 637,236 644,226 644,236 640,239 653,251 645,260 649,273 642,274 646,284 640,286 642,293 636,293|268,264 286,265 291,279 297,281 292,311 278,300 270,311 254,316 253,329 242,331 234,320 229,320 230,315 220,313 209,301 218,290 208,289 194,275 208,273 215,263 224,263 224,259 230,264 233,251 255,246 258,249 255,256 265,255 267,260 261,265 267,262 268,266|569,92 585,91 593,96 589,98 600,109 589,109 594,114 586,114 592,119 586,122 594,125 591,128 595,127 594,132 603,141 600,145 585,137 565,140 550,167 540,169 539,176 530,176 516,166 524,154 522,146 533,140 529,131 541,122 541,103 549,91 568,92";
      MAP_RINGS.split("|").forEach(function (ringStr) {
        var pts = ringStr.split(" ");
        if (pts.length < 3) return;
        pg.beginPath();
        for (var ri = 0; ri < pts.length; ri++) {
          var xy = pts[ri].split(",");
          var rx = parseFloat(xy[0]),
            ry = parseFloat(xy[1]);
          if (ri === 0) pg.moveTo(rx, ry);
          else pg.lineTo(rx, ry);
        }
        pg.closePath();
        pg.fill();
      });
      var washC = document.createElement("canvas");
      washC.width = 128;
      washC.height = 160;
      var wg = washC.getContext("2d");
      var wimg = wg.createImageData(128, 160);
      for (var wy = 0; wy < 160; wy++) {
        var wt = wy / 159;
        var halfW = 3 + wt * 59;
        var vFall = Math.pow(1 - wt, 0.6);
        var hot = Math.exp(-wt * 5.5);
        for (var wx = 0; wx < 128; wx++) {
          var wu = Math.abs(wx - 63.5) / halfW;
          var side = wu >= 1 ? 0 : 1 - wu * wu * (3 - 2 * wu);
          var inten = side * (vFall * 0.82 + hot * 0.45);
          if (inten > 1) inten = 1;
          var wi = (wy * 128 + wx) * 4;
          wimg.data[wi] = 255;
          wimg.data[wi + 1] = 216;
          wimg.data[wi + 2] = 150;
          wimg.data[wi + 3] = Math.round(inten * 255);
        }
      }
      wg.putImageData(wimg, 0, 0);
      var washTex = new THREE.CanvasTexture(washC);
      washTex.colorSpace = THREE.SRGBColorSpace;
      function washMat(dayOp, nightOp) {
        var m = new THREE.MeshBasicMaterial({
          map: washTex,
          transparent: true,
          opacity: dayOp,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        m.userData.dayOp = dayOp;
        m.userData.nightOp = nightOp;
        spotGlowMats.push(m);
        return m;
      }
      function makeSpotLamp() {
        var grp = new THREE.Group();
        var base = cyl(0.095, 0.095, 0.05, 14672870, 20, 0.35);
        base.rotation.x = Math.PI / 2;
        base.position.z = 0.025;
        grp.add(base);
        var arm = box(0.04, 0.04, 0.27, 14672870, 0.35);
        arm.position.set(0, 0.03, 0.16);
        grp.add(arm);
        var head = new THREE.Group();
        head.position.set(0, 0.01, 0.31);
        head.rotation.x = 0.85;
        grp.add(head);
        var shade = cyl(0.088, 0.05, 0.075, 14672870, 20, 0.35);
        shade.rotation.x = Math.PI / 2;
        head.add(shade);
        var bulb = new THREE.Mesh(
          new THREE.CircleGeometry(0.055, 16),
          glowMat(16768168, 1.1),
        );
        bulb.position.z = 0.039;
        head.add(bulb);
        return grp;
      }
      var panelW = 0.92,
        panelH = 1.62,
        panelGap = 0.07;
      var panelTotalW = panelW * 4 + panelGap * 3;
      var panelCX = 0.9,
        panelCY = 2.95;
      for (var pn = 0; pn < 4; pn++) {
        var px =
          panelCX - panelTotalW / 2 + panelW / 2 + pn * (panelW + panelGap);
        var pBack = box(panelW + 0.05, panelH + 0.05, 0.06, 1053206, 0.5);
        pBack.position.set(px, panelCY, -FD / 2 + 0.4);
        office.add(pBack);
        var pTex = new THREE.CanvasTexture(pc);
        pTex.colorSpace = THREE.SRGBColorSpace;
        pTex.wrapS = THREE.RepeatWrapping;
        pTex.repeat.set(0.25, 1);
        pTex.offset.set(pn * 0.25, 0);
        var pPanel = new THREE.Mesh(
          new THREE.PlaneGeometry(panelW, panelH),
          new THREE.MeshStandardMaterial({ map: pTex, roughness: 0.55 }),
        );
        pPanel.receiveShadow = true;
        pPanel.position.set(px, panelCY, -FD / 2 + 0.44);
        office.add(pPanel);
        var pWash = new THREE.Mesh(
          new THREE.PlaneGeometry(1.12, 2),
          washMat(0.26, 0.55),
        );
        pWash.position.set(px, panelCY + panelH / 2 + 0.22 - 1, -FD / 2 + 0.46);
        office.add(pWash);
        var pSpot = makeSpotLamp();
        pSpot.position.set(px, panelCY + panelH / 2 + 0.22, -FD / 2 + 0.35);
        office.add(pSpot);
      }
      var corkFrame = box(2.7, 1.6, 0.06, 8213807, 0.6);
      corkFrame.position.set(-3.65, 2.75, -FD / 2 + 0.4);
      office.add(corkFrame);
      var cork = box(2.5, 1.42, 0.03, 13146986, 0.95);
      cork.position.set(-3.65, 2.75, -FD / 2 + 0.44);
      office.add(cork);
      var noteCols = [
        16774054, 16762838, 12575680, 13624575, 16769464, 15129087,
      ];
      for (var n = 0; n < 6; n++) {
        var note = new THREE.Mesh(
          new THREE.PlaneGeometry(0.5, 0.42),
          mat(noteCols[n], 0.9),
        );
        note.position.set(
          -4.7 + (n % 3) * 1.05,
          3.05 - Math.floor(n / 3) * 0.62,
          -FD / 2 + 0.47,
        );
        note.rotation.z = (n % 2 ? -1 : 1) * 0.07;
        office.add(note);
        var pin = sph(0.028, 14238531, 0.4);
        pin.position.set(
          note.position.x,
          note.position.y + 0.17,
          -FD / 2 + 0.48,
        );
        office.add(pin);
      }
      var shelfB = box(1.7, 0.07, 0.34, 8213807, 0.6);
      shelfB.position.set(-5.3, 2.5, -FD / 2 + 0.55);
      office.add(shelfB);
      for (var sb = 0; sb < 3; sb++) {
        var sbook = box(0.16, 0.4, 0.24, [13193039, 3100047, 2062957][sb], 0.7);
        sbook.position.set(-5.9 + sb * 0.22, 2.74, -FD / 2 + 0.55);
        office.add(sbook);
      }
      var spot2 = cyl(0.11, 0.09, 0.2, 13201226, 12);
      spot2.position.set(-4.7, 2.64, -FD / 2 + 0.55);
      office.add(spot2);
      var sleaf = sph(0.17, 3504458, 0.9);
      sleaf.position.set(-4.7, 2.86, -FD / 2 + 0.55);
      office.add(sleaf);
      var shelf = new THREE.Group();
      shelf.position.set(5.25, 0, -4.15);
      office.add(shelf);
      var sback = box(2, 3.1, 0.08, 7293480, 0.7);
      sback.position.set(0, 1.55, -0.3);
      shelf.add(sback);
      [-0.96, 0.96].forEach(function (sx) {
        var side = box(0.08, 3.1, 0.68, 8213807, 0.7);
        side.position.set(sx, 1.55, 0);
        shelf.add(side);
      });
      var bookCols = [13193039, 3100047, 14260774, 2062957, 12734845, 6243478];
      [0.35, 1.15, 1.95, 2.75].forEach(function (sy, lvl) {
        var board = box(1.9, 0.07, 0.64, 8213807, 0.65);
        board.position.set(0, sy, 0);
        shelf.add(board);
        if (lvl < 3) {
          for (var bk = 0; bk < 5; bk++) {
            var bh = 0.42 + ((bk * 7 + lvl * 3) % 4) * 0.07;
            var book = box(0.17, bh, 0.4, bookCols[(bk + lvl * 2) % 6], 0.75);
            book.position.set(-0.72 + bk * 0.34, sy + 0.04 + bh / 2, 0);
            shelf.add(book);
          }
        }
      });
      var topBoard = box(1.9, 0.07, 0.64, 8213807, 0.65);
      topBoard.position.set(0, 3.12, 0);
      shelf.add(topBoard);
      var vpot = cyl(0.14, 0.11, 0.24, 13201226, 12);
      vpot.position.set(-0.6, 3.28, 0);
      shelf.add(vpot);
      for (var v = 0; v < 4; v++) {
        var vx = -0.78 + v * 0.16,
          vlen = 0.5 + (v % 3) * 0.28;
        var vine = cyl(0.016, 0.012, vlen, 2908985, 6, 0.9);
        vine.position.set(vx, 3.16 - vlen / 2, 0.3);
        shelf.add(vine);
        for (var vl = 0; vl < 3; vl++) {
          var vleaf = sph(0.055, 3504458, 0.9);
          vleaf.position.set(
            vx + (vl % 2 ? 0.05 : -0.05),
            3.1 - vl * (vlen / 3),
            0.32,
          );
          shelf.add(vleaf);
        }
      }
      var vpot2 = cyl(0.12, 0.1, 0.2, 5995161, 12);
      vpot2.position.set(0.55, 3.26, 0);
      shelf.add(vpot2);
      var vleaf2 = sph(0.2, 3504458, 0.9);
      vleaf2.position.set(0.55, 3.5, 0);
      shelf.add(vleaf2);
      var cooler = new THREE.Group();
      cooler.position.set(-5.55, 0, 3.35);
      cooler.rotation.y = Math.PI / 2;
      office.add(cooler);
      var cbody = rbox(0.58, 1.02, 0.52, 15922422, 0.45);
      cbody.position.y = 0.51;
      cooler.add(cbody);
      var cband = box(0.59, 0.3, 0.53, 14542316, 0.5);
      cband.position.y = 0.78;
      cooler.add(cband);
      var bottleMat = new THREE.MeshStandardMaterial({
        color: 7320552,
        roughness: 0.15,
        transparent: true,
        opacity: 0.78,
      });
      var bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.23, 0.52, 18),
        bottleMat,
      );
      bottle.position.y = 1.3;
      bottle.castShadow = true;
      cooler.add(bottle);
      var bneck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.12, 0.14, 12),
        bottleMat,
      );
      bneck.position.y = 1.62;
      cooler.add(bneck);
      [-0.11, 0.11].forEach(function (tx, ti) {
        var tap = box(0.09, 0.07, 0.06, ti ? 3831492 : 14238531, 0.4);
        tap.position.set(tx, 0.82, 0.29);
        cooler.add(tap);
      });
      var drip = box(0.34, 0.04, 0.2, 10465988, 0.5);
      drip.position.set(0, 0.62, 0.3);
      cooler.add(drip);
      var cm = new THREE.Group();
      cm.position.set(-5.55, 0, 2.18);
      cm.rotation.y = Math.PI / 2;
      office.add(cm);
      var cmBody = rbox(0.6, 0.92, 0.52, 3752524, 0.4);
      cmBody.position.y = 0.46;
      cm.add(cmBody);
      var cmStripe = box(0.61, 0.1, 0.53, 2304561, 0.45);
      cmStripe.position.y = 0.16;
      cm.add(cmStripe);
      var cmTop = rbox(0.64, 0.06, 0.56, 2304561, 0.4);
      cmTop.position.y = 0.95;
      cm.add(cmTop);
      var hopper = cyl(0.13, 0.15, 0.22, 7031338, 14, 0.5);
      hopper.position.set(-0.13, 1.09, 0);
      cm.add(hopper);
      var hopperLid = cyl(0.14, 0.14, 0.03, 2831164, 14, 0.4);
      hopperLid.position.set(-0.13, 1.21, 0);
      cm.add(hopperLid);
      var tank = cyl(0.1, 0.1, 0.3, 10471144, 12, 0.25);
      tank.position.set(0.16, 1.12, -0.05);
      cm.add(tank);
      var cmFace = box(0.5, 0.3, 0.03, 1909546, 0.4);
      cmFace.position.set(0, 0.72, 0.27);
      cm.add(cmFace);
      var cmLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 10, 8),
        glowMat(16758861, 0.8),
      );
      cmLight.position.set(-0.17, 0.78, 0.29);
      cm.add(cmLight);
      var cmDial = cyl(0.035, 0.035, 0.02, 12174543, 12, 0.35);
      cmDial.rotation.x = Math.PI / 2;
      cmDial.position.set(0.14, 0.78, 0.29);
      cm.add(cmDial);
      var spout = box(0.08, 0.1, 0.08, 12174543, 0.3);
      spout.position.set(0.05, 0.55, 0.28);
      cm.add(spout);
      var pfHandle = box(0.17, 0.035, 0.05, 1316893, 0.4);
      pfHandle.position.set(0.17, 0.5, 0.28);
      pfHandle.rotation.y = 0.25;
      cm.add(pfHandle);
      var cmTray = box(0.44, 0.03, 0.2, 10465988, 0.35);
      cmTray.position.set(0.02, 0.3, 0.3);
      cm.add(cmTray);
      var cmCup = cyl(0.045, 0.038, 0.085, 16777215, 12, 0.4);
      cmCup.position.set(0.05, 0.36, 0.3);
      cm.add(cmCup);
      var cmCupTop = cyl(0.041, 0.041, 0.012, 4860948, 12, 0.6);
      cmCupTop.position.set(0.05, 0.4, 0.3);
      cm.add(cmCupTop);
      var drinkWash = new THREE.Mesh(
        new THREE.PlaneGeometry(2.15, 2.35),
        washMat(0.24, 0.5),
      );
      drinkWash.rotation.y = Math.PI / 2;
      drinkWash.position.set(-FW / 2 + 0.38, 1.48, 2.765);
      office.add(drinkWash);
      var drinkSpot = makeSpotLamp();
      drinkSpot.rotation.y = Math.PI / 2;
      drinkSpot.position.set(-FW / 2 + 0.37, 2.62, 2.765);
      office.add(drinkSpot);
      var rugM = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 2.5, 0.035, 40),
        mat(14338470, 1),
      );
      rugM.position.set(0, 0.02, 0.8);
      rugM.receiveShadow = true;
      office.add(rugM);
      var rugIn = new THREE.Mesh(
        new THREE.CylinderGeometry(1.8, 1.8, 0.04, 40),
        mat(13217151, 1),
      );
      rugIn.position.set(0, 0.025, 0.8);
      rugIn.receiveShadow = true;
      office.add(rugIn);
      var ct = new THREE.Group();
      ct.position.set(0, 0, 0.8);
      office.add(ct);
      var ctop = rbox(1.5, 0.08, 0.85, 9396790, 0.55);
      ctop.position.y = 0.44;
      ct.add(ctop);
      [
        [-0.62, -0.3],
        [0.62, -0.3],
        [-0.62, 0.3],
        [0.62, 0.3],
      ].forEach(function (s) {
        var leg = box(0.08, 0.42, 0.08, 7227946, 0.6);
        leg.position.set(s[0], 0.21, s[1]);
        ct.add(leg);
      });
      var bk1 = box(0.44, 0.05, 0.32, 4415914, 0.7);
      bk1.position.set(-0.3, 0.51, 0.02);
      bk1.rotation.y = 0.3;
      ct.add(bk1);
      var bk2 = box(0.38, 0.04, 0.28, 15691628, 0.7);
      bk2.position.set(-0.28, 0.55, 0.02);
      bk2.rotation.y = 0.12;
      ct.add(bk2);
      var ccup = cyl(0.05, 0.042, 0.1, 15905076, 12, 0.4);
      ccup.position.set(0.42, 0.53, -0.12);
      ct.add(ccup);
      var csaucer = cyl(0.08, 0.08, 0.015, 16777215, 14, 0.4);
      csaucer.position.set(0.42, 0.49, -0.12);
      ct.add(csaucer);
      plant(-5.55, 4.2, 1.25);
      plant(6, 0.4, 0.95);
      plant(3.85, -4.3, 0.85);
      [
        [-2.95, 3.35, 12422196],
        [-1.7, 4.05, 13201226],
      ].forEach(function (cu) {
        var cush = cyl(0.42, 0.46, 0.13, cu[2], 20, 0.95);
        cush.position.set(cu[0], 0.065, cu[1]);
        office.add(cush);
        var cushTop = cyl(0.34, 0.38, 0.05, cu[2], 20, 0.95);
        cushTop.position.set(cu[0], 0.15, cu[1]);
        office.add(cushTop);
      });
    })();
    function screenTexture(hue) {
      var c = document.createElement("canvas");
      c.width = 256;
      c.height = 176;
      var seed = 7;
      for (var hi = 0; hi < hue.length; hi++)
        seed = (seed * 31 + hue.charCodeAt(hi)) % 9973;
      function srnd() {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      }
      var lines = [];
      for (var i = 0; i < 30; i++) {
        var segs = [],
          n = 1 + Math.floor(srnd() * 3),
          x = (srnd() < 0.3 ? 0 : Math.floor(srnd() * 3)) * 12;
        for (var s2 = 0; s2 < n; s2++) {
          var w = 18 + srnd() * 62;
          segs.push({
            x: x,
            w: w,
            col: ["#e8f2ff", "#8fd8ff", "#ffd98f", "#b8f2c9", "#f2a7c3"][
              Math.floor(srnd() * 5)
            ],
          });
          x += w + 8;
        }
        lines.push({ segs: segs, blank: srnd() < 0.14 });
      }
      var t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.userData = { canvas: c, hue: hue, lines: lines, scroll: 0, typeP: 0 };
      drawScreenLive(t.userData, null, 0, 0);
      return t;
    }
    function drawScreenLive(u, a, dt, tt) {
      var g = u.canvas.getContext("2d");
      var typing = !a || !a.cyc || a.cyc.phase === "type";
      if (typing && dt > 0) u.typeP += dt * 0.55;
      if (u.typeP >= 1) {
        u.typeP = 0;
        u.scroll += 1;
      }
      g.fillStyle = "#101c28";
      g.fillRect(0, 0, 256, 176);
      g.fillStyle = u.hue;
      g.fillRect(0, 0, 256, 26);
      g.fillStyle = "rgba(255,255,255,0.8)";
      [12, 26, 40].forEach(function (cx) {
        g.beginPath();
        g.arc(cx, 13, 4, 0, 6.29);
        g.fill();
      });
      var lineH = 13,
        top = 38,
        rows = 10;
      var base = Math.floor(u.scroll);
      for (var r = 0; r < rows; r++) {
        var ln = u.lines[(base + r) % u.lines.length];
        var y = top + r * lineH;
        var isActive = r === rows - 1;
        if (isActive) {
          g.fillStyle = "rgba(140,190,255,0.10)";
          g.fillRect(6, y - 2, 244, lineH);
        }
        var lastSeg = ln.segs[ln.segs.length - 1];
        var span = lastSeg ? lastSeg.x + lastSeg.w : 0;
        var typeX = u.typeP * (span + 26);
        if (!ln.blank) {
          for (var s = 0; s < ln.segs.length; s++) {
            var sg = ln.segs[s],
              dw = sg.w;
            if (isActive) {
              if (typeX <= sg.x) dw = 0;
              else if (typeX < sg.x + sg.w) dw = typeX - sg.x;
            }
            if (dw > 0.5) {
              g.globalAlpha = 0.85;
              g.fillStyle = sg.col;
              g.fillRect(14 + sg.x, y, dw, 6);
            }
          }
          g.globalAlpha = 1;
        }
        if (isActive && (tt * 1.5) % 1 < 0.6) {
          g.fillStyle = "#e8f2ff";
          g.fillRect(Math.min(246, 15 + typeX), y - 1, 6, 9);
        }
      }
    }
    var SLEEP_TEX = (function () {
      var c = document.createElement("canvas");
      c.width = 256;
      c.height = 176;
      var g = c.getContext("2d");
      g.fillStyle = "#04060a";
      g.fillRect(0, 0, 256, 176);
      g.fillStyle = "rgba(255,255,255,0.045)";
      g.fillRect(0, 0, 256, 30);
      var dg = g.createRadialGradient(226, 158, 0, 226, 158, 10);
      dg.addColorStop(0, "rgba(255,157,46,0.85)");
      dg.addColorStop(1, "rgba(255,157,46,0)");
      g.fillStyle = dg;
      g.beginPath();
      g.arc(226, 158, 10, 0, 6.29);
      g.fill();
      g.fillStyle = "#ff9d2e";
      g.beginPath();
      g.arc(226, 158, 3.2, 0, 6.29);
      g.fill();
      var t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    function screenMesh(w, h, hue) {
      var tex = screenTexture(hue);
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({
          map: tex,
          emissive: 16777215,
          emissiveMap: tex,
          emissiveIntensity: 0.55,
          roughness: 0.4,
        }),
      );
      m.material.userData.base = 0.55;
      screenMats.push(m.material);
      m.material.userData.litTex = tex;
      m.material.userData.onAmt = 0;
      return m;
    }
    function makeChair() {
      var grp = new THREE.Group();
      var seat = rbox(0.58, 0.1, 0.55, MUSTARD, 0.6);
      seat.position.y = 0.46;
      grp.add(seat);
      var backr = rbox(0.55, 0.6, 0.1, MUSTARD, 0.6);
      backr.position.set(0, 0.88, 0.27);
      backr.rotation.x = 0.08;
      grp.add(backr);
      var post = cyl(0.04, 0.04, 0.4, 5594986, 10, 0.4);
      post.position.y = 0.22;
      grp.add(post);
      for (var i = 0; i < 5; i++) {
        var a = (i / 5) * Math.PI * 2;
        var leg = box(0.05, 0.05, 0.46, 5594986, 0.4);
        leg.position.set(Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15);
        leg.rotation.y = a;
        grp.add(leg);
        var wheel = sph(0.05, 2831424, 0.5);
        wheel.position.set(Math.sin(a) * 0.36, 0.05, Math.cos(a) * 0.36);
        grp.add(wheel);
      }
      return grp;
    }
    function makeDesk(x, z, hue) {
      var grp = new THREE.Group();
      grp.position.set(x, 0, z);
      var top = rbox(2.25, 0.09, 1, 12093774, 0.55);
      top.position.y = 0.75;
      grp.add(top);
      [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].forEach(function (s) {
        var leg = box(0.09, 0.73, 0.09, 9069112, 0.6);
        leg.position.set(s[0] * 1, 0.36, s[1] * 0.4);
        grp.add(leg);
      });
      var mon = new THREE.Group();
      mon.position.set(0.05, 0.8, -0.22);
      var stand = box(0.09, 0.28, 0.09, 2831424, 0.4);
      stand.position.y = 0.14;
      mon.add(stand);
      var bezel = rbox(1.08, 0.66, 0.05, 1910579, 0.35);
      bezel.position.y = 0.52;
      mon.add(bezel);
      var scr = screenMesh(0.97, 0.55, hue);
      scr.position.set(0, 0.52, 0.03);
      mon.add(scr);
      grp.add(mon);
      var kb = rbox(0.62, 0.035, 0.22, 15262938, 0.5);
      kb.position.set(0.05, 0.82, 0.16);
      grp.add(kb);
      var mpad = rbox(0.27, 0.014, 0.33, 3358798, 0.85);
      mpad.position.set(0.58, 0.802, 0.17);
      grp.add(mpad);
      var mouse = rbox(0.115, 0.05, 0.185, 2831424, 0.35);
      mouse.position.set(0.58, 0.834, 0.17);
      grp.add(mouse);
      var mWheel = box(0.02, 0.012, 0.05, 10465988, 0.4);
      mWheel.position.set(0.58, 0.862, 0.115);
      grp.add(mWheel);
      var mug = cyl(0.05, 0.045, 0.11, 15691628, 14, 0.4);
      mug.position.set(0.85, 0.85, 0.12);
      grp.add(mug);
      var bookA = box(0.34, 0.04, 0.26, 2792847, 0.7);
      bookA.position.set(-0.88, 0.82, -0.05);
      bookA.rotation.y = -0.2;
      grp.add(bookA);
      var lampBase = cyl(0.09, 0.11, 0.04, 2831424, 12, 0.4);
      lampBase.position.set(-0.95, 0.82, -0.3);
      grp.add(lampBase);
      var lampArm = cyl(0.018, 0.018, 0.44, 2831424, 8, 0.4);
      lampArm.position.set(-0.88, 1.02, -0.3);
      lampArm.rotation.z = 0.55;
      grp.add(lampArm);
      var lampHeadMat = glowMat(16767392, 0.35);
      var lampHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 14, 10),
        lampHeadMat,
      );
      lampHead.position.set(-0.76, 1.22, -0.28);
      grp.add(lampHead);
      office.add(grp);
      var chair = makeChair();
      chair.position.set(x, 0, z + 1.02);
      office.add(chair);
      return {
        x: x,
        z: z,
        chairPos: new THREE.Vector3(x, 0, z + 1.02),
        screen: scr,
      };
    }
    var beanbagPos = new THREE.Vector3(4.3, 0, 2.9);
    var beanbagDir = new THREE.Vector3(-0.72, 0, -0.5).normalize();
    var beanbagYaw = Math.atan2(beanbagDir.x, beanbagDir.z);
    var bagFrontPos = beanbagPos.clone().addScaledVector(beanbagDir, 1.08);
    var beanbagScreen = null;
    var bagLap = null,
      bagLapHinge = null;
    (function buildBeanbag() {
      var grp = new THREE.Group();
      grp.position.copy(beanbagPos);
      grp.rotation.y = beanbagYaw;
      office.add(grp);
      var fabricC = document.createElement("canvas");
      fabricC.width = fabricC.height = 512;
      var fg = fabricC.getContext("2d");
      fg.fillStyle = "#bd8c34";
      fg.fillRect(0, 0, 512, 512);
      var frnd = 31;
      function frand() {
        frnd = (frnd * 16807) % 2147483647;
        return frnd / 2147483647;
      }
      for (var fb = 0; fb < 46; fb++) {
        var fbx = frand() * 512,
          fby = frand() * 512,
          fbr = 40 + frand() * 110;
        var fbcol = frand() > 0.5 ? "255,232,160" : "146,102,16";
        [-512, 0, 512].forEach(function (ox) {
          [-512, 0, 512].forEach(function (oy) {
            var fbgrad = fg.createRadialGradient(
              fbx + ox,
              fby + oy,
              0,
              fbx + ox,
              fby + oy,
              fbr,
            );
            fbgrad.addColorStop(0, "rgba(" + fbcol + ",0.13)");
            fbgrad.addColorStop(1, "rgba(" + fbcol + ",0)");
            fg.fillStyle = fbgrad;
            fg.beginPath();
            fg.arc(fbx + ox, fby + oy, fbr, 0, 6.29);
            fg.fill();
          });
        });
      }
      for (var fs = 0; fs < 9e3; fs++) {
        fg.fillStyle =
          frand() > 0.5 ? "rgba(120,82,10,0.13)" : "rgba(255,238,175,0.13)";
        fg.fillRect(Math.floor(frand() * 512), Math.floor(frand() * 512), 2, 2);
      }
      fg.globalAlpha = 0.1;
      fg.strokeStyle = "#8a640e";
      fg.lineWidth = 1;
      for (var fw1 = 0; fw1 <= 512; fw1 += 4) {
        fg.beginPath();
        fg.moveTo(fw1 + 0.5, 0);
        fg.lineTo(fw1 + 0.5, 512);
        fg.stroke();
      }
      fg.globalAlpha = 0.07;
      for (var fw2 = 0; fw2 <= 512; fw2 += 4) {
        fg.beginPath();
        fg.moveTo(0, fw2 + 0.5);
        fg.lineTo(512, fw2 + 0.5);
        fg.stroke();
      }
      fg.globalAlpha = 1;
      [0, 256, 512].forEach(function (sx) {
        fg.fillStyle = "rgba(96,64,6,0.55)";
        fg.fillRect(sx - 2, 0, 4, 512);
        fg.fillStyle = "rgba(255,244,200,0.20)";
        fg.fillRect(sx + 2, 0, 1.5, 512);
        fg.strokeStyle = "rgba(110,74,10,0.85)";
        fg.lineWidth = 2;
        fg.setLineDash([7, 5]);
        [-8, 8].forEach(function (off) {
          fg.beginPath();
          fg.moveTo(sx + off, 0);
          fg.lineTo(sx + off, 512);
          fg.stroke();
        });
        fg.setLineDash([]);
      });
      var fabricTex = new THREE.CanvasTexture(fabricC);
      fabricTex.wrapS = fabricTex.wrapT = THREE.RepeatWrapping;
      fabricTex.repeat.set(3, 2);
      fabricTex.colorSpace = THREE.SRGBColorSpace;
      var bagMat = new THREE.MeshStandardMaterial({
        map: fabricTex,
        bumpMap: fabricTex,
        bumpScale: 0.02,
        roughness: 1,
        metalness: 0,
      });
      var prof = [
        [0, 0.012],
        [0.34, 0.012],
        [0.58, 0.03],
        [0.78, 0.07],
        [0.9, 0.15],
        [0.97, 0.27],
        [0.985, 0.38],
        [0.95, 0.5],
        [0.86, 0.6],
        [0.72, 0.68],
        [0.54, 0.735],
        [0.34, 0.765],
        [0.15, 0.778],
        [0, 0.782],
      ].map(function (p) {
        return new THREE.Vector2(p[0], p[1]);
      });
      var bagGeo = new THREE.LatheGeometry(prof, 44);
      (function sculptBag() {
        var pa = bagGeo.attributes.position;
        function cl01(v) {
          return v < 0 ? 0 : v > 1 ? 1 : v;
        }
        function smooth(v) {
          v = cl01(v);
          return v * v * (3 - 2 * v);
        }
        for (var vi = 0; vi < pa.count; vi++) {
          var vx = pa.getX(vi),
            vy = pa.getY(vi),
            vz = pa.getZ(vi);
          vz = vz > 0 ? vz * 0.62 : vz * 0.8;
          var ty = cl01((vy - 0.3) / 0.45);
          var dzc = vz + 0.06,
            rr = Math.sqrt(vx * vx + dzc * dzc);
          vy -= 0.185 * Math.exp(-(rr * rr) / 0.2) * ty;
          var backF = smooth(-vz / 0.55);
          vy +=
            0.37 * backF * cl01((vy - 0.25) / 0.5) * Math.exp(-(vx * vx) / 1.1);
          var frontF = cl01((vz - 0.05) / 0.5);
          vy -= 0.16 * frontF * ty;
          var phi = Math.atan2(vx, vz);
          var lump =
            0.011 * Math.sin(phi * 9 + vy * 13) +
            0.007 * Math.sin(phi * 17 - vy * 21);
          var rl = Math.sqrt(vx * vx + vz * vz);
          if (rl > 0.05 && vy > 0.08 && vy < 0.62) {
            vx += (vx / rl) * lump;
            vz += (vz / rl) * lump;
          }
          pa.setXYZ(vi, vx, vy, vz);
        }
        bagGeo.computeVertexNormals();
      })();
      var bag = new THREE.Mesh(bagGeo, bagMat);
      bag.castShadow = true;
      bag.receiveShadow = true;
      grp.add(bag);
      var seamMat = mat(11041812, 1);
      function seamTube(pts, rad, closed) {
        var curve = new THREE.CatmullRomCurve3(pts, !!closed);
        var m = new THREE.Mesh(
          new THREE.TubeGeometry(curve, closed ? 64 : 20, rad, 6, !!closed),
          seamMat,
        );
        m.castShadow = true;
        m.receiveShadow = true;
        grp.add(m);
        return m;
      }
      var pipePts = [];
      for (var pA = 0; pA < 28; pA++) {
        var pAng = (pA / 28) * Math.PI * 2,
          pSin = Math.sin(pAng);
        pipePts.push(
          new THREE.Vector3(
            Math.cos(pAng) * 0.972,
            0.335,
            pSin * (pSin > 0 ? 0.598 : 0.772),
          ),
        );
      }
      seamTube(pipePts, 0.013, true);
      var rimPts = [];
      for (var rA = 0; rA < 24; rA++) {
        var rAng = (rA / 24) * Math.PI * 2,
          rSin = Math.sin(rAng);
        rimPts.push(
          new THREE.Vector3(
            Math.cos(rAng) * 0.385,
            0.615 + (rSin < 0 ? 0.2 * rSin * rSin : -0.045 * rSin) + 0.012,
            -0.04 + rSin * 0.315,
          ),
        );
      }
      seamTube(rimPts, 0.009, true);
      [-0.21, 0, 0.21].forEach(function (cx) {
        seamTube(
          [
            new THREE.Vector3(cx * 0.8, 0.615, 0.315),
            new THREE.Vector3(cx, 0.5, 0.475),
            new THREE.Vector3(cx * 1.15, 0.375, 0.565),
          ],
          0.0075,
          false,
        );
      });
      var lap = new THREE.Group();
      lap.position.set(0, 0.775, 0.3);
      lap.rotation.x = 0.08;
      grp.add(lap);
      bagLap = lap;
      var lbase = rbox(0.62, 0.03, 0.38, 12174543, 0.35);
      lap.add(lbase);
      var lkeys = rbox(0.52, 0.012, 0.25, 2831424, 0.5);
      lkeys.position.set(0, 0.02, -0.03);
      lap.add(lkeys);
      var lscr = new THREE.Group();
      lscr.position.set(0, 0.015, 0.19);
      lscr.rotation.x = 0.22;
      lap.add(lscr);
      bagLapHinge = lscr;
      var lbez = rbox(0.62, 0.42, 0.03, 1910579, 0.35);
      lbez.position.y = 0.21;
      lscr.add(lbez);
      beanbagScreen = screenMesh(0.56, 0.36, "#5da85e");
      beanbagScreen.position.set(0, 0.21, -0.02);
      beanbagScreen.rotation.y = Math.PI;
      lscr.add(beanbagScreen);
      var stool = cyl(0.2, 0.17, 0.34, 8213807, 14, 0.6);
      stool.position.set(1.42, 0.17, 0.42);
      grp.add(stool);
      var cup2 = cyl(0.05, 0.042, 0.1, 4415914, 12, 0.4);
      cup2.position.set(1.42, 0.39, 0.42);
      grp.add(cup2);
    })();
    var LAP_POSE = {
      pos: new THREE.Vector3(0, 0.775, 0.3),
      rx: 0.08,
      ry: 0,
      hinge: 0.22,
    };
    var BAG_POSE = {
      pos: new THREE.Vector3(0.03, 0.618, -0.03),
      rx: -0.03,
      ry: 0.22,
      hinge: -1.52,
    };
    var bagLapAmt = 0;
    function updateBagLaptop(dt) {
      if (!bagLap || !bagLapHinge) return;
      var f = null;
      for (var i = 0; i < agents.length; i++)
        if (agents[i].cfg.beanbag) {
          f = agents[i];
          break;
        }
      if (!f) return;
      var seated =
        f.sit > 0.5 &&
        !f.path.length &&
        Math.hypot(
          f.group.position.x - beanbagPos.x,
          f.group.position.z - beanbagPos.z,
        ) < 0.45;
      var target = seated ? 1 : 0;
      bagLapAmt += (target - bagLapAmt) * Math.min(1, dt * 2.4);
      if (Math.abs(target - bagLapAmt) < 0.002) bagLapAmt = target;
      var e = bagLapAmt * bagLapAmt * (3 - 2 * bagLapAmt);
      bagLap.position.lerpVectors(BAG_POSE.pos, LAP_POSE.pos, e);
      bagLap.position.y += Math.sin(e * Math.PI) * 0.05;
      bagLap.rotation.x = BAG_POSE.rx + (LAP_POSE.rx - BAG_POSE.rx) * e;
      bagLap.rotation.y = BAG_POSE.ry + (LAP_POSE.ry - BAG_POSE.ry) * e;
      var h = Math.max(0, Math.min(1, (e - 0.3) / 0.7));
      h = h * h * (3 - 2 * h);
      bagLapHinge.rotation.x =
        BAG_POSE.hinge + (LAP_POSE.hinge - BAG_POSE.hinge) * h;
    }
    var meeting = { seats: [] };
    (function buildMeeting() {
      var centre = new THREE.Vector3(0, 0, 0.8);
      for (var i = 0; i < 5; i++) {
        var ang = -Math.PI / 2 + i * ((Math.PI * 2) / 5);
        var sx = centre.x + Math.sin(ang) * 1.75,
          sz = centre.z + Math.cos(ang) * 1.75;
        var stoolG = new THREE.Group();
        stoolG.position.set(sx, 0, sz);
        office.add(stoolG);
        var cush = cyl(0.31, 0.31, 0.13, MUSTARD, 18, 0.8);
        cush.position.y = 0.36;
        stoolG.add(cush);
        var spost = cyl(0.04, 0.04, 0.3, 7227946, 8);
        spost.position.y = 0.16;
        stoolG.add(spost);
        var sbase = cyl(0.2, 0.22, 0.04, 7227946, 14);
        sbase.position.y = 0.02;
        stoolG.add(sbase);
        meeting.seats.push({
          pos: new THREE.Vector3(sx, 0, sz),
          yaw: Math.atan2(centre.x - sx, centre.z - sz),
          taken: null,
          via: [],
          drop: 0.1,
        });
      }
    })();
    var standSpots = [
      {
        pos: new THREE.Vector3(-5.45, 0, -1.2),
        yaw: -Math.PI / 2,
        taken: null,
        via: [],
      },
      {
        pos: new THREE.Vector3(5.25, 0, -3.1),
        yaw: Math.PI,
        taken: null,
        via: [],
      },
      {
        pos: new THREE.Vector3(-4.8, 0, 3.35),
        yaw: -Math.PI / 2,
        taken: null,
        via: [],
      },
      {
        pos: new THREE.Vector3(0.9, 0, -2.45),
        yaw: Math.PI,
        taken: null,
        via: [],
      },
      { pos: new THREE.Vector3(-2.7, 0, 2.7), yaw: 0.8, taken: null, via: [] },
    ];
    var AGENTS = [
      {
        id: "sinta",
        name: "Sinta",
        role: "Riset & Data",
        shirt: 15691628,
        skin: 16767411,
        hair: 3810325,
        hairStyle: "long",
        deskHue: "#ef6f6c",
      },
      {
        id: "nadia",
        name: "Nadia",
        role: "Operasional",
        shirt: 8215462,
        skin: 16768187,
        hair: 2364945,
        hairStyle: "long",
        deskHue: "#7d5ba6",
      },
      {
        id: "bima",
        name: "Bima",
        role: "Engineering",
        shirt: 10471144,
        skin: 13208927,
        hair: 1315860,
        hairStyle: "short",
        glasses: true,
        deskHue: "#7fb2d9",
      },
      {
        id: "dewi",
        name: "Dewi",
        role: "Desain",
        shirt: 4169103,
        skin: 16240030,
        hair: 5518106,
        hairStyle: "long",
        deskHue: "#3f9d8f",
      },
      {
        id: "fajar",
        name: "Fajar",
        role: "Marketing",
        shirt: 6137950,
        skin: 14723698,
        hair: 2103314,
        hairStyle: "short",
        deskHue: "#5da85e",
        beanbag: true,
      },
    ];
    var deskDefs = [
      { x: -4.85, z: -3.75 },
      { x: -2.45, z: -3.75 },
      { x: -0.05, z: -3.75 },
      { x: 2.35, z: -3.75 },
    ];
    function makeCharacter(cfg) {
      var grp = new THREE.Group();
      var proc = new THREE.Group();
      grp.add(proc);
      var hips = new THREE.Group();
      hips.position.y = 0.31;
      proc.add(hips);
      var headG = new THREE.Group();
      headG.position.y = 0.36;
      hips.add(headG);
      function makeArm(side) {
        var pivot = new THREE.Group();
        pivot.position.set(0.2 * side, 0.27, 0);
        hips.add(pivot);
        return pivot;
      }
      var armL = makeArm(-1),
        armR = makeArm(1);
      function makeLeg(side) {
        var thighP = new THREE.Group();
        thighP.position.set(0.1 * side, 0.31, 0);
        proc.add(thighP);
        var kneeP = new THREE.Group();
        kneeP.position.y = -0.15;
        thighP.add(kneeP);
        return { thigh: thighP, knee: kneeP };
      }
      var legL = makeLeg(-1),
        legR = makeLeg(1);
      var ring = new THREE.Mesh(
        new THREE.RingGeometry(0.52, 0.64, 36),
        new THREE.MeshBasicMaterial({
          color: 16763213,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      grp.add(ring);
      scene.add(grp);
      return {
        cfg: cfg,
        group: grp,
        proc: proc,
        hips: hips,
        head: headG,
        armL: armL,
        armR: armR,
        legL: legL,
        legR: legR,
        ring: ring,
        celebrateT: 0,
        pendingIdle: false,
        celebF: 0,
        startleT: 0,
        bangT: 0,
        startleEnv: 0,
        cyc: {
          phase: "type",
          t: 3 + Math.random() * 4,
          mouseAmt: 0,
          clickT: 0.8 + Math.random(),
          glanceT: 2 + Math.random() * 3,
          seed: Math.random() * 20,
        },
        glanceAmt: 0,
        armAim: 0,
        state: "idle",
        path: [],
        speed: 2.2,
        yaw: 0,
        targetYaw: 0,
        sit: 0,
        sitTarget: 0,
        drop: 0,
        dropTarget: 0,
        phase: Math.random() * 6.28,
        task: null,
        spot: null,
        idleSpot: null,
        statusText: "Santai",
        tag: null,
        seatPos: null,
        homeDrop: 0,
        bagLeaving: false,
        bagSeating: false,
        bagFrom: null,
        scene: null,
        sceneSeat: null,
        sleepAmt: 0,
        readAmt: 0,
        coffeeAmt: 0,
        cupHold: 0,
        sipAmt: 0,
        cupCyc: null,
        cupRest: null,
        cupRestW: null,
        cupFromW: null,
        cupSettleT: 0,
        bookReturn: false,
        afterReturn: null,
        sceneCleared: false,
        bookProp: null,
        cupProp: null,
        zzz: null,
        propK: 1,
      };
    }
    var agents = [];
    AGENTS.forEach(function (cfg, i) {
      var a = makeCharacter(cfg);
      if (cfg.beanbag) {
        a.desk = {
          x: beanbagPos.x,
          z: beanbagPos.z,
          chairPos: beanbagPos.clone(),
          screen: beanbagScreen,
        };
        a.home = { pos: beanbagPos.clone(), yaw: beanbagYaw };
        a.homeDrop = 0.17;
      } else {
        var d = makeDesk(deskDefs[i].x, deskDefs[i].z, cfg.deskHue);
        a.desk = d;
        a.home = { pos: d.chairPos.clone(), yaw: Math.PI };
      }
      agents.push(a);
    });
    var labelWrap = document.getElementById("labels");
    agents.forEach(function (a, ai) {
      a.tagLift = (ai % 2) * 22;
      var el = document.createElement("div");
      el.className = "tag";
      el.innerHTML =
        '<span class="dot" style="background:#8be0a4"></span>' + a.cfg.name;
      labelWrap.appendChild(el);
      a.tag = el;
      a.tagDot = el.querySelector(".dot");
      var bang = document.createElement("div");
      bang.className = "bang";
      bang.style.display = "none";
      bang.innerHTML =
        '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon fill="#f6a821" stroke="#7a3c00" stroke-width="3" stroke-linejoin="round" points="97,50 78,57.5 90.7,73.5 70.5,70.5 73.5,90.7 57.5,78 50,97 42.5,78 26.5,90.7 29.5,70.5 9.3,73.5 22,57.5 3,50 22,42.5 9.3,26.5 29.5,29.5 26.5,9.3 42.5,22 50,3 57.5,22 73.5,9.3 70.5,29.5 90.7,26.5 78,42.5"/></svg><span>!!</span>';
      labelWrap.appendChild(bang);
      a.bang = bang;
      var zzz = document.createElement("div");
      zzz.className = "zzz";
      zzz.style.display = "none";
      zzz.innerHTML =
        '<span class="z1">Z</span><span class="z2">Z</span><span class="z3">Z</span>';
      labelWrap.appendChild(zzz);
      a.zzz = zzz;
      var book = new THREE.Group();
      var cover = box(0.37, 0.025, 0.25, a.cfg.shirt, 0.6);
      book.add(cover);
      var pgL = box(0.165, 0.012, 0.23, 16249310, 0.9);
      pgL.position.set(-0.086, 0.02, 0);
      pgL.rotation.z = 0.16;
      book.add(pgL);
      var pgR = box(0.165, 0.012, 0.23, 16249310, 0.9);
      pgR.position.set(0.086, 0.02, 0);
      pgR.rotation.z = -0.16;
      book.add(pgR);
      book.visible = false;
      a.group.add(book);
      a.bookProp = book;
      a.bookPages = [pgL, pgR];
      var cup = new THREE.Group();
      var cupBody = cyl(0.048, 0.04, 0.095, 16777215, 12, 0.4);
      cup.add(cupBody);
      var coffeeTop = cyl(0.044, 0.044, 0.012, 4860948, 12, 0.6);
      coffeeTop.position.y = 0.045;
      cup.add(coffeeTop);
      var ear = new THREE.Mesh(
        new THREE.TorusGeometry(0.032, 0.009, 8, 14),
        mat(16777215, 0.4),
      );
      ear.position.set(0.056, 0, 0);
      ear.castShadow = true;
      cup.add(ear);
      cup.visible = false;
      a.group.add(cup);
      a.cupProp = cup;
    });
    var VRM_URLS = {
      sinta: "assets/characters/AvatarSample_A.vrm",
      dewi: "assets/characters/AvatarSample_B.vrm",
      nadia: "assets/characters/AvatarSample_C.vrm",
      bima: "assets/characters/AvatarSample_A.vrm",
      fajar: "assets/characters/AvatarSample_B.vrm",
    };
    var VRM_H = 2.28;
    function refreshVisibility(a) {
      if (a.vrmData) a.vrmData.root.visible = true;
      a.tagY = 2.45;
      a.headY0 = 2.04;
      a.headDrop = 0.52;
      a.headSide = 0.37;
      a.propK = 1.5;
      if (a.bookProp) a.bookProp.scale.setScalar(1.35);
      if (a.cupProp) a.cupProp.scale.setScalar(1.35);
      a.bookY = [1.42, 0.95];
      a.bookZ = 0.46;
      a.cupPos = { x: 0.36, y: 1.34, ys: 1, z: 0.4 };
    }
    function normalizeHeight(obj, target) {
      var bb = new THREE.Box3().setFromObject(obj);
      var h = bb.max.y - bb.min.y || 1;
      var s = target / h;
      obj.scale.setScalar(s);
      obj.position.set(
        (-(bb.min.x + bb.max.x) / 2) * s,
        -bb.min.y * s,
        (-(bb.min.z + bb.max.z) / 2) * s,
      );
    }
    function setupVRM(a, gltf) {
      var root = new THREE.Group();
      var model = gltf.scene;
      root.add(model);
      model.rotation.y = Math.PI;
      normalizeHeight(model, VRM_H);
      model.traverse(function (o) {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false;
        }
      });
      if (a.cfg.id === "bima" || a.cfg.id === "fajar") {
        var seen = [];
        model.traverse(function (o) {
          if (
            o.isMesh &&
            o.material &&
            o.material.color &&
            seen.indexOf(o.material) < 0
          ) {
            seen.push(o.material);
            try {
              o.material.color.offsetHSL(
                a.cfg.id === "bima" ? 0.05 : -0.05,
                0.04,
                0,
              );
            } catch (e) {}
          }
        });
      }
      a.group.add(root);
      var vrm = (gltf.userData && gltf.userData.vrm) || null;
      function bone(schemaName, nodeName) {
        if (vrm && vrm.humanoid && window.THREE_VRM && THREE_VRM.VRMSchema) {
          try {
            var bn = vrm.humanoid.getBoneNode(
              THREE_VRM.VRMSchema.HumanoidBoneName[schemaName],
            );
            if (bn) return bn;
          } catch (e) {}
        }
        return model.getObjectByName(nodeName) || null;
      }
      var D = {
        root: root,
        vrm: vrm,
        rest: {},
        joyMorphs: [],
        blinkMorphs: [],
        surpriseMorphs: [],
        _surAll: [],
        _surParts: [],
        nextBlink: 2 + Math.random() * 2,
        blinkT: -1,
        bones: {
          hips: bone("Hips", "J_Bip_C_Hips"),
          spine: bone("Spine", "J_Bip_C_Spine"),
          chest:
            bone("Chest", "J_Bip_C_Chest") ||
            bone("UpperChest", "J_Bip_C_UpperChest"),
          head: bone("Head", "J_Bip_C_Head"),
          upperArmL: bone("LeftUpperArm", "J_Bip_L_UpperArm"),
          lowerArmL: bone("LeftLowerArm", "J_Bip_L_LowerArm"),
          upperArmR: bone("RightUpperArm", "J_Bip_R_UpperArm"),
          lowerArmR: bone("RightLowerArm", "J_Bip_R_LowerArm"),
          handL: bone("LeftHand", "J_Bip_L_Hand"),
          handR: bone("RightHand", "J_Bip_R_Hand"),
          upperLegL: bone("LeftUpperLeg", "J_Bip_L_UpperLeg"),
          lowerLegL: bone("LeftLowerLeg", "J_Bip_L_LowerLeg"),
          upperLegR: bone("RightUpperLeg", "J_Bip_R_UpperLeg"),
          lowerLegR: bone("RightLowerLeg", "J_Bip_R_LowerLeg"),
          footL: bone("LeftFoot", "J_Bip_L_Foot"),
          footR: bone("RightFoot", "J_Bip_R_Foot"),
        },
      };
      Object.keys(D.bones).forEach(function (key) {
        var b = D.bones[key];
        if (b) D.rest[b.uuid] = b.quaternion.clone();
      });
      D.fingers = [];
      ["L", "R"].forEach(function (sd) {
        ["Thumb", "Index", "Middle", "Ring", "Little"].forEach(function (fg) {
          [1, 2].forEach(function (seg) {
            var fb = model.getObjectByName("J_Bip_" + sd + "_" + fg + seg);
            if (fb) {
              D.rest[fb.uuid] = fb.quaternion.clone();
              D.fingers.push({
                b: fb,
                side: sd,
                seg: seg,
                thumb: fg === "Thumb",
              });
            }
          });
        });
      });
      if (D.bones.hips) {
        model.updateMatrixWorld(true);
        var hipWp = new THREE.Vector3();
        D.bones.hips.getWorldPosition(hipWp);
        D.hipsY = hipWp.y;
        if (D.bones.upperLegL && D.bones.lowerLegL && D.bones.footL) {
          var _ul = new THREE.Vector3(),
            _ll = new THREE.Vector3(),
            _ft = new THREE.Vector3();
          D.bones.upperLegL.getWorldPosition(_ul);
          D.bones.lowerLegL.getWorldPosition(_ll);
          D.bones.footL.getWorldPosition(_ft);
          D.thighLen = _ul.y - _ll.y;
          D.shinLen = _ll.y - _ft.y;
          D.ankleH = _ft.y;
        }
      }
      (function measureArms() {
        if (!D.bones.upperArmL || !D.bones.lowerArmL || !D.bones.handL) return;
        a.group.updateMatrixWorld(true);
        var rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
        var rootQ = new THREE.Quaternion();
        root.getWorldQuaternion(rootQ);
        rootQ.invert();
        function jp(b) {
          var v = new THREE.Vector3();
          b.getWorldPosition(v);
          return v.applyMatrix4(rootInv);
        }
        function rq(b) {
          var q = new THREE.Quaternion();
          b.getWorldQuaternion(q);
          return rootQ.clone().multiply(q);
        }
        var sL = jp(D.bones.upperArmL),
          eL = jp(D.bones.lowerArmL),
          wL = jp(D.bones.handL);
        D.jShoulderL = sL;
        D.jElbowL = eL;
        D.jWristL = wL;
        D.upperArmLen = sL.distanceTo(eL);
        D.foreArmLen = eL.distanceTo(wL);
        D.restDirU_L = eL.clone().sub(sL).normalize();
        D.restDirF_L = wL.clone().sub(eL).normalize();
        D.restQU_L = rq(D.bones.upperArmL);
        D.restQF_L = rq(D.bones.lowerArmL);
        if (D.bones.upperArmR && D.bones.lowerArmR && D.bones.handR) {
          var sR = jp(D.bones.upperArmR),
            eR = jp(D.bones.lowerArmR),
            wR = jp(D.bones.handR);
          D.jShoulderR = sR;
          D.jElbowR = eR;
          D.jWristR = wR;
          D.restDirU_R = eR.clone().sub(sR).normalize();
          D.restDirF_R = wR.clone().sub(eR).normalize();
          D.restQU_R = rq(D.bones.upperArmR);
          D.restQF_R = rq(D.bones.lowerArmR);
        }
      })();
      if (!vrm) {
        model.traverse(function (o) {
          if (o.isMesh && o.morphTargetDictionary && o.morphTargetInfluences) {
            Object.keys(o.morphTargetDictionary).forEach(function (mn) {
              var low = mn.toLowerCase();
              if (low.indexOf("joy") >= 0)
                D.joyMorphs.push({ mesh: o, idx: o.morphTargetDictionary[mn] });
              if (low.indexOf("surpris") >= 0 || low.indexOf("odoroki") >= 0) {
                if (low.indexOf("_all_") >= 0)
                  D._surAll.push({ mesh: o, idx: o.morphTargetDictionary[mn] });
                else
                  D._surParts.push({
                    mesh: o,
                    idx: o.morphTargetDictionary[mn],
                  });
              }
              if (
                (low.indexOf("blink") >= 0 &&
                  low.indexOf("_l") < 0 &&
                  low.indexOf("_r") < 0) ||
                low.indexOf("eye_close") >= 0
              )
                D.blinkMorphs.push({
                  mesh: o,
                  idx: o.morphTargetDictionary[mn],
                });
            });
          }
        });
      }
      D.surpriseMorphs = D._surAll.length ? D._surAll : D._surParts;
      a.vrmData = D;
      refreshVisibility(a);
    }
    if (THREE.Cache) THREE.Cache.enabled = true;
    function loadOneVRM(a) {
      return new Promise(function (res) {
        new THREE.GLTFLoader().load(
          VRM_URLS[a.cfg.id],
          function (gltf) {
            setupVRM(a, gltf);
            res(true);
          },
          undefined,
          function () {
            res(false);
          },
        );
      });
    }
    var _qe = new THREE.Euler(),
      _qq = new THREE.Quaternion();
    function poseBone(D, b, x, y, z) {
      if (!b) return;
      var r = D.rest[b.uuid];
      if (!r) return;
      _qq.setFromEuler(_qe.set(x, y, z));
      b.quaternion.copy(r).multiply(_qq);
    }
    function aimArmSide(a, D, side, wristG, amt, hintV) {
      var B = D.bones;
      var up = side === "L" ? B.upperArmL : B.upperArmR;
      var lo = side === "L" ? B.lowerArmL : B.lowerArmR;
      var restDirU = side === "L" ? D.restDirU_L : D.restDirU_R;
      var restDirF = side === "L" ? D.restDirF_L : D.restDirF_R;
      var restQU = side === "L" ? D.restQU_L : D.restQU_R;
      var restQF = side === "L" ? D.restQF_L : D.restQF_R;
      if (!up || !lo || !restDirU || !restQU) return;
      var eU = up.quaternion.clone(),
        eL = lo.quaternion.clone();
      var gq = new THREE.Quaternion();
      a.group.getWorldQuaternion(gq);
      up.updateWorldMatrix(true, false);
      var S = new THREE.Vector3();
      up.getWorldPosition(S);
      var W = a.group.localToWorld(wristG.clone());
      var L1 = D.upperArmLen || 0.42,
        L2 = D.foreArmLen || 0.38;
      var toW = W.clone().sub(S);
      var d = Math.min(toW.length(), (L1 + L2) * 0.985);
      var m = toW.normalize();
      var hint = (
        hintV || new THREE.Vector3(side === "L" ? 0.38 : -0.38, -1, -0.3)
      )
        .clone()
        .applyQuaternion(gq);
      hint.sub(m.clone().multiplyScalar(hint.dot(m)));
      if (hint.lengthSq() < 1e-6) hint.set(0, -1, 0);
      else hint.normalize();
      var cosA = Math.max(
        -1,
        Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)),
      );
      var eDir = m
        .clone()
        .multiplyScalar(cosA)
        .add(hint.multiplyScalar(Math.sin(Math.acos(cosA))))
        .normalize();
      var E = S.clone().add(eDir.clone().multiplyScalar(L1));
      var pq = new THREE.Quaternion();
      up.parent.getWorldQuaternion(pq);
      var qd = new THREE.Quaternion().setFromUnitVectors(
        restDirU.clone().applyQuaternion(gq),
        eDir,
      );
      var wq = qd.multiply(gq.clone().multiply(restQU));
      up.quaternion.copy(pq.invert().multiply(wq));
      lo.updateWorldMatrix(true, false);
      var pq2 = new THREE.Quaternion();
      lo.parent.getWorldQuaternion(pq2);
      var dl = W.clone().sub(E).normalize();
      var qd2 = new THREE.Quaternion().setFromUnitVectors(
        restDirF.clone().applyQuaternion(gq),
        dl,
      );
      var wq2 = qd2.multiply(gq.clone().multiply(restQF));
      lo.quaternion.copy(pq2.invert().multiply(wq2));
      if (amt < 1) {
        up.quaternion.slerp(eU, 1 - amt);
        lo.quaternion.slerp(eL, 1 - amt);
      }
    }
    function aimArmsAll(a, D, t, slpF, rdF, cofF) {
      var wWork = a.armAim,
        wSlp = slpF,
        wRd = rdF,
        wCof = cofF;
      var tot = wWork + wSlp + wRd;
      var totR = tot + wCof;
      if (totR < 0.01 || !D.jShoulderL) return;
      a.group.updateMatrixWorld(true);
      var wL = new THREE.Vector3(),
        wR = new THREE.Vector3();
      var hL = new THREE.Vector3(),
        hR = new THREE.Vector3();
      function blend(w, tgtL, tgtR, hintL, hintR) {
        if (w < 0.001) return;
        if (tgtL) {
          wL.addScaledVector(tgtL, w);
          hL.addScaledVector(hintL, w);
        }
        if (tgtR) {
          wR.addScaledVector(tgtR, w);
          hR.addScaledVector(hintR, w);
        }
      }
      if (wWork > 0.001) {
        var cyc = a.cyc,
          mA = cyc.mouseAmt;
        var tapL = Math.abs(Math.sin(t * 11 + cyc.seed * 7)) * 0.042 * (1 - mA);
        var tapR =
          Math.abs(Math.sin(t * 11 + cyc.seed * 7 + Math.PI)) *
          0.042 *
          (1 - mA);
        var kwL = new THREE.Vector3(0.09, 0.878 + tapL, 0.76);
        var kwR = new THREE.Vector3(-0.17, 0.878 + tapR, 0.76);
        if (mA > 0.001) {
          var clickDip =
            cyc.phase === "mouse" && cyc.clickT < 0.12
              ? Math.sin((cyc.clickT / 0.12) * Math.PI) * 0.026
              : 0;
          var mouseR = new THREE.Vector3(
            -0.52 + Math.sin(t * 1.7 + cyc.seed * 3) * 0.015,
            0.902 - clickDip,
            0.76 + Math.cos(t * 1.3 + cyc.seed * 5) * 0.018,
          );
          kwR.lerp(mouseR, mA);
        }
        blend(
          wWork,
          kwL,
          kwR,
          new THREE.Vector3(0.38, -1, -0.3),
          new THREE.Vector3(-0.38, -1, -0.3),
        );
      }
      if (wSlp > 0.001) {
        blend(
          wSlp,
          new THREE.Vector3(-0.15, 0.85, 0.7),
          new THREE.Vector3(0.15, 0.89, 0.65),
          new THREE.Vector3(0.95, -0.45, 0.3),
          new THREE.Vector3(-0.95, -0.45, 0.3),
        );
      }
      if (wRd > 0.001) {
        var bkY = a.bookY || [1.42, 0.95];
        var yB = bkY[0] + (bkY[1] - bkY[0]) * a.sit;
        var zB = a.bookZ || 0.46;
        blend(
          wRd,
          new THREE.Vector3(0.27, yB - 0.13, zB - 0.16),
          new THREE.Vector3(-0.27, yB - 0.13, zB - 0.16),
          new THREE.Vector3(0.35, -1, -0.05),
          new THREE.Vector3(-0.35, -1, -0.05),
        );
      }
      if (tot > 0.001)
        aimArmSide(a, D, "L", wL.multiplyScalar(1 / tot), Math.min(1, tot), hL);
      if (wCof > 0.001) {
        var lapR = new THREE.Vector3(-0.24, 0.74, 0.34);
        var cupT = lapR;
        var hold = a.cupHold || 0;
        if (hold > 0.001 && a.cupProp) {
          var cp = a.cupProp.position;
          cupT = lapR
            .clone()
            .lerp(
              new THREE.Vector3(cp.x - 0.085, cp.y - 0.015, cp.z - 0.02),
              hold,
            );
          cupT.y += Math.sin(Math.min(1, hold) * Math.PI) * 0.05;
        }
        wR.addScaledVector(cupT, wCof);
        hR.addScaledVector(new THREE.Vector3(-0.42, -1, -0.12), wCof);
      }
      if (totR > 0.001)
        aimArmSide(
          a,
          D,
          "R",
          wR.multiplyScalar(1 / totR),
          Math.min(1, totR),
          hR,
        );
    }
    function updateVRM(a, dt, t) {
      var D = a.vrmData;
      if (!D || !D.root.visible) return;
      var B = D.bones;
      a.celebF += ((a.celebrateT > 0 ? 1 : 0) - a.celebF) * Math.min(1, dt * 7);
      var cf = a.celebF;
      var walking = !!a._moving;
      var sitF = a.sit;
      var sw = walking ? Math.sin(a.phase) : 0;
      var onBag = a.drop > 0.12;
      var typing = a.state === "work" && sitF > 0.7;
      var deskWork = typing && !onBag;
      a.armAim += ((deskWork ? 1 : 0) - a.armAim) * Math.min(1, dt * 4);
      var bagF = Math.max(0, Math.min(1, (a.drop - 0.1) / 0.07));
      var seatY = 0.48 + 0.24 * bagF;
      var thighSitB = 1.45;
      var kneeYB = 0.72 - (D.thighLen || 0.51) * Math.cos(thighSitB);
      var shinPhiB = Math.acos(
        Math.max(
          -1,
          Math.min(1, (kneeYB - (D.ankleH || 0.2)) / (D.shinLen || 0.57)),
        ),
      );
      var tl = D.thighLen || 0.51,
        sl = D.shinLen || 0.57,
        ah = D.ankleH || 0.15;
      var axT = 0.6,
        ayT = ah - 0.48;
      var dRaw = Math.hypot(axT, ayT),
        dMax = (tl + sl) * 0.995;
      if (dRaw > dMax) {
        axT *= dMax / dRaw;
        ayT *= dMax / dRaw;
        dRaw = dMax;
      }
      var phiA = Math.atan2(axT, -ayT);
      var cosB = Math.max(
        -1,
        Math.min(1, (tl * tl + dRaw * dRaw - sl * sl) / (2 * tl * dRaw)),
      );
      var thighD = phiA + Math.acos(cosB);
      var kx = tl * Math.sin(thighD),
        ky = -tl * Math.cos(thighD);
      var shinAbsD = Math.atan2(axT - kx, -(ayT - ky));
      var lowerD = shinAbsD - thighD;
      var thighX = thighD + (thighSitB - thighD) * bagF;
      var lowerX = lowerD + (shinPhiB - thighSitB - lowerD) * bagF;
      var lowerBase = -1.45 * sitF + sitF * sitF * (lowerX + 1.45);
      poseBone(D, B.upperLegL, thighX * sitF + sw * 0.55, 0, 0);
      poseBone(D, B.upperLegR, thighX * sitF - sw * 0.55, 0, 0);
      poseBone(
        D,
        B.lowerLegL,
        lowerBase - (walking ? Math.max(0, sw) * 0.7 : 0),
        0,
        0,
      );
      poseBone(
        D,
        B.lowerLegR,
        lowerBase - (walking ? Math.max(0, -sw) * 0.7 : 0),
        0,
        0,
      );
      var footX = -(thighX * sitF + lowerBase);
      poseBone(D, B.footL, footX, 0, 0);
      poseBone(D, B.footR, footX, 0, 0);
      var br = Math.sin(t * 1.7 + a.phase) * 0.02;
      var lean = a.armAim;
      var slpF = (a.sleepAmt || 0) * sitF;
      var rdF = a.readAmt || 0;
      var cofF = a.coffeeAmt || 0;
      poseBone(
        D,
        B.spine,
        (-0.1 - 0.1 * lean) * sitF + br * 0.5 - 0.5 * slpF - 0.05 * rdF * sitF,
        0,
        0,
      );
      poseBone(
        D,
        B.chest,
        (-0.06 - 0.07 * lean) * sitF + br - 0.32 * slpF - 0.03 * rdF,
        0,
        0,
      );
      var stEnv = a.startleEnv || 0;
      poseBone(
        D,
        B.head,
        -0.1 * sitF +
          Math.sin(t * 0.8 + a.phase) * 0.03 * (1 - slpF) +
          (a.glanceAmt || 0) * lean * 0.26 -
          stEnv * 0.34 +
          0.58 * slpF +
          0.36 * rdF -
          0.07 * (a.sipAmt || 0) +
          Math.sin(t * 1.15 + a.phase) * 0.025 * slpF,
        Math.sin(t * 0.45 + a.phase * 2) *
          0.16 *
          (1 - sitF * 0.5) *
          (1 - 0.85 * slpF - 0.4 * rdF) +
          (stEnv > 0 ? Math.sin(t * 42 + a.phase) * 0.07 * stEnv : 0),
        stEnv * 0.14 + slpF * 0.18,
      );
      var armDown = (1.22 - cf * 2.35) * (1 - 0.38 * rdF) - 0.1 * slpF;
      var armFwd = 0.12 + 0.5 * sitF + 0.62 * slpF + 0.34 * rdF;
      poseBone(
        D,
        B.upperArmL,
        armFwd +
          (walking ? sw * 0.4 : 0) +
          (typing ? Math.sin(t * 10 + a.phase) * 0.05 : 0),
        0,
        armDown,
      );
      poseBone(
        D,
        B.upperArmR,
        armFwd +
          (walking ? -sw * 0.4 : 0) +
          (typing ? Math.cos(t * 11 + a.phase) * 0.05 : 0) +
          0.22 * cofF * (1 - cofF),
        0,
        -armDown,
      );
      poseBone(
        D,
        B.lowerArmL,
        0.25 +
          0.55 * sitF +
          (typing ? Math.sin(t * 12.3 + a.phase) * 0.07 : 0) +
          0.3 * slpF +
          0.95 * rdF,
        0,
        0.08 + cf * 0.6 + 0.55 * slpF + 0.28 * rdF,
      );
      poseBone(
        D,
        B.lowerArmR,
        0.25 +
          0.55 * sitF +
          (typing ? Math.cos(t * 10.7 + a.phase) * 0.07 : 0) +
          0.3 * slpF +
          0.95 * rdF +
          0.6 * cofF * (1 - cofF),
        0,
        -0.08 - cf * 0.6 - 0.55 * slpF - 0.28 * rdF,
      );
      var hop =
        cf > 0.03 && !walking ? Math.abs(Math.sin(t * 9)) * 0.07 * cf : 0;
      var sitDrop = Math.max(0, (D.hipsY || 0.76) - seatY) * sitF;
      D.root.position.y =
        -sitDrop + (walking ? Math.abs(Math.sin(a.phase)) * 0.03 : 0) + hop;
      D.root.position.z = 0.17 * sitF * (1 - bagF);
      aimArmsAll(a, D, t, slpF, rdF, cofF);
      var gripAmt = Math.max(
        a.armAim,
        rdF * 0.85,
        slpF * 0.45,
        (a.cupHold || 0) * 0.9,
      );
      if (D.fingers && gripAmt > 0.01) {
        D.fingers.forEach(function (f) {
          var c = (f.seg === 1 ? 0.5 : 0.65) * gripAmt * (f.thumb ? 0.55 : 1);
          poseBone(D, f.b, 0, 0, (f.side === "L" ? 1 : -1) * c);
        });
      }
      var surprAmt =
        a.bangT > 0 ? Math.sin(Math.min(1, 1 - a.bangT) * Math.PI) : 0;
      if (
        D.vrm &&
        D.vrm.blendShapeProxy &&
        window.THREE_VRM &&
        THREE_VRM.VRMSchema
      ) {
        try {
          D.vrm.blendShapeProxy.setValue(
            THREE_VRM.VRMSchema.BlendShapePresetName.Joy,
            cf,
          );
        } catch (e) {}
        if (D.surpriseOk !== false) {
          try {
            D.vrm.blendShapeProxy.setValue(
              THREE_VRM.VRMSchema.BlendShapePresetName.Surprised,
              surprAmt,
            );
          } catch (e) {
            D.surpriseOk = false;
          }
        }
        try {
          D.vrm.update(dt);
        } catch (e) {}
      } else {
        D.joyMorphs.forEach(function (m) {
          m.mesh.morphTargetInfluences[m.idx] = cf;
        });
        D.surpriseMorphs.forEach(function (m) {
          m.mesh.morphTargetInfluences[m.idx] = surprAmt;
        });
        var bl = 0;
        D.nextBlink -= dt;
        if (D.nextBlink <= 0) {
          D.blinkT = 0;
          D.nextBlink = 2.4 + Math.random() * 2.4;
        }
        if (D.blinkT >= 0) {
          D.blinkT += dt;
          bl = Math.sin(Math.min(1, D.blinkT / 0.14) * Math.PI);
          if (D.blinkT >= 0.14) D.blinkT = -1;
        }
        D.blinkMorphs.forEach(function (m) {
          m.mesh.morphTargetInfluences[m.idx] = bl;
        });
      }
    }
    var TABLE_C = { x: 0, z: 0.8 };
    function detourPoint(from, to) {
      var R = 1.45;
      var dx = to.x - from.x,
        dz = to.z - from.z;
      var L2 = dx * dx + dz * dz;
      if (!L2) return null;
      var t = ((TABLE_C.x - from.x) * dx + (TABLE_C.z - from.z) * dz) / L2;
      t = Math.max(0, Math.min(1, t));
      var px = from.x + dx * t,
        pz = from.z + dz * t;
      if (Math.hypot(px - TABLE_C.x, pz - TABLE_C.z) > R) return null;
      var mx = (from.x + to.x) / 2 - TABLE_C.x,
        mz = (from.z + to.z) / 2 - TABLE_C.z;
      var ml = Math.hypot(mx, mz) || 1;
      return new THREE.Vector3(
        TABLE_C.x + (mx / ml) * 2.05,
        0,
        TABLE_C.z + (mz / ml) * 2.05,
      );
    }
    function tableArc(from, to) {
      if (!detourPoint(from, to)) return [];
      var a0 = Math.atan2(from.x - TABLE_C.x, from.z - TABLE_C.z);
      var a1 = Math.atan2(to.x - TABLE_C.x, to.z - TABLE_C.z);
      var sweep = a1 - a0;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      while (sweep < -Math.PI) sweep += Math.PI * 2;
      var steps = Math.max(1, Math.ceil(Math.abs(sweep) / 0.8));
      var pts = [];
      for (var i = 1; i < steps; i++) {
        var ang = a0 + sweep * (i / steps);
        pts.push(
          new THREE.Vector3(
            TABLE_C.x + Math.sin(ang) * 2.05,
            0,
            TABLE_C.z + Math.cos(ang) * 2.05,
          ),
        );
      }
      if (!pts.length) {
        var dp = detourPoint(from, to);
        if (dp) pts.push(dp);
      }
      return pts;
    }
    function cupArc(restW, mouthW, u) {
      var v = 1 - u;
      var p1y = restW.y + 0.22,
        p2y = mouthW.y + 0.08;
      return new THREE.Vector3(
        v * v * v * restW.x +
          3 * v * v * u * restW.x +
          3 * v * u * u * mouthW.x +
          u * u * u * mouthW.x,
        v * v * v * restW.y +
          3 * v * v * u * p1y +
          3 * v * u * u * p2y +
          u * u * u * mouthW.y,
        v * v * v * restW.z +
          3 * v * v * u * restW.z +
          3 * v * u * u * mouthW.z +
          u * u * u * mouthW.z,
      );
    }
    function sendTo(a, dest, via, finalYaw, onArrive) {
      var pts = [];
      var cur = a.group.position;
      var arrive = onArrive || null;
      var finalDest = dest;
      if (a.cfg.beanbag) {
        var toHome = dest.distanceTo(beanbagPos) < 0.05;
        var distC = Math.hypot(cur.x - beanbagPos.x, cur.z - beanbagPos.z);
        if (toHome) {
          a.bagLeaving = false;
          if (distC > 0.35) {
            finalDest = bagFrontPos;
            var innerArrive = arrive;
            arrive = function () {
              a.bagSeating = true;
              a.bagFrom = bagFrontPos.clone();
              if (innerArrive) innerArrive();
            };
          }
        } else {
          a.bagSeating = false;
          if (a.sit > 0.4 && distC < 1.15) {
            a.bagLeaving = true;
            a.bagFrom = cur.clone();
            pts.push(bagFrontPos.clone());
          } else if (a.sit <= 0.4) a.bagLeaving = false;
        }
      }
      var exitPts = [];
      var fromPt = cur;
      var atSeat = null,
        destIsSeat = false;
      for (var si = 0; si < meeting.seats.length; si++) {
        var ss = meeting.seats[si];
        if (Math.hypot(cur.x - ss.pos.x, cur.z - ss.pos.z) < 0.45) atSeat = ss;
        if (finalDest.distanceTo(ss.pos) < 0.05) destIsSeat = true;
      }
      if (atSeat && !destIsSeat) {
        var awayV = new THREE.Vector3(cur.x - TABLE_C.x, 0, cur.z - TABLE_C.z);
        if (awayV.lengthSq() < 0.01) awayV.set(0, 0, 1);
        awayV.normalize();
        var backPt = cur.clone().addScaledVector(awayV, 0.6);
        exitPts.push(backPt);
        fromPt = backPt;
      }
      var arc = via && via.length ? [] : tableArc(fromPt, finalDest);
      pts = exitPts.concat(pts);
      if (via)
        via.forEach(function (v) {
          pts.push(v.clone());
        });
      arc.forEach(function (v) {
        pts.push(v);
      });
      pts.push(finalDest.clone());
      a.path = pts;
      a.finalYaw = finalYaw;
      a.onArrive = arrive;
      a.sitTarget = 0;
      a.dropTarget = 0;
      if (a.state !== "work") a.state = "walk";
    }
    function freeSpot(a) {
      if (a.idleSpot) {
        a.idleSpot.taken = null;
        a.idleSpot = null;
      }
    }
    var sceneSeq = 0;
    var BREW_POS = new THREE.Vector3(-4.72, 0, 2.18);
    function endScene(a) {
      a.scene = null;
      if (a.bookProp) a.bookProp.visible = false;
      if (a.cupProp) a.cupProp.visible = false;
      a.cupCyc = null;
      a.cupRest = null;
      a.cupRestW = null;
      a.cupFromW = null;
      a.cupSettleT = 0;
      a.cupHold = 0;
      a.sipAmt = 0;
      a.bookReturn = false;
      a.afterReturn = null;
      if (a.cupProp) a.cupProp.rotation.set(0, 0, 0);
      if (a.sceneSeat) {
        a.sceneSeat.taken = null;
        a.sceneSeat = null;
      }
    }
    function leaveScene(a, proceed) {
      var bookOut = !!(
        a.bookProp &&
        a.bookProp.visible &&
        ((a.scene && a.scene.kind === "read") || a.bookReturn)
      );
      endScene(a);
      if (!bookOut) {
        proceed();
        return;
      }
      a.bookProp.visible = true;
      a.afterReturn = proceed;
      if (a.bookReturn) return;
      a.bookReturn = true;
      a.statusText = "Mengembalikan buku";
      var shelf = standSpots[1];
      sendTo(a, shelf.pos, shelf.via, shelf.yaw, function () {
        if (a.bookProp) a.bookProp.visible = false;
        a.bookReturn = false;
        var p = a.afterReturn;
        a.afterReturn = null;
        if (p) p();
      });
    }
    function claimSeat(a) {
      for (var i = 0; i < meeting.seats.length; i++) {
        var s = meeting.seats[i];
        if (!s.taken) {
          s.taken = a;
          a.sceneSeat = s;
          return s;
        }
      }
      return null;
    }
    function sceneAfter(a, ms, fn) {
      var sc = a.scene;
      if (!sc) return;
      var tok = sc.token;
      setTimeout(function () {
        if (a.scene && a.scene.token === tok) fn();
      }, ms);
    }
    function startSleep(a) {
      endScene(a);
      freeSpot(a);
      a.scene = { kind: "sleep", token: ++sceneSeq };
      a.statusText = "Menuju meja";
      sendTo(a, a.home.pos, [], a.home.yaw, function () {
        a.state = "idle";
        a.sitTarget = 1;
        a.dropTarget = a.homeDrop;
        a.statusText = "Tidur di meja";
      });
    }
    function startRead(a, fixedDest) {
      endScene(a);
      var dest =
        fixedDest || ["stand", "desk", "meet"][Math.floor(Math.random() * 3)];
      var sc = (a.scene = {
        kind: "read",
        token: ++sceneSeq,
        phase: "fetch",
        dest: dest,
      });
      var shelf = standSpots[1];
      freeSpot(a);
      if (!shelf.taken) {
        shelf.taken = a;
        a.idleSpot = shelf;
      }
      a.statusText = "Mengambil buku";
      sendTo(a, shelf.pos, shelf.via, shelf.yaw, function () {
        a.state = "idle";
        sceneAfter(a, 1100, function () {
          if (a.bookProp) a.bookProp.visible = true;
          sc.phase = "read";
          goReadDest(a, sc);
        });
      });
    }
    function goReadDest(a, sc) {
      if (sc.dest === "meet") {
        var seat = claimSeat(a);
        if (seat) {
          freeSpot(a);
          a.statusText = "Menuju meja rapat";
          sendTo(a, seat.pos, seat.via, seat.yaw, function () {
            a.state = "idle";
            a.sitTarget = 1;
            a.dropTarget = seat.drop;
            a.statusText = "Membaca buku";
          });
          return;
        }
        sc.dest = a.cfg.beanbag ? "stand" : "desk";
      }
      if (sc.dest === "desk") {
        freeSpot(a);
        a.statusText = "Menuju mejanya";
        sendTo(a, a.home.pos, [], a.home.yaw, function () {
          a.state = "idle";
          a.sitTarget = 1;
          a.dropTarget = a.homeDrop;
          a.statusText = "Membaca buku";
        });
      } else {
        a.state = "idle";
        a.sitTarget = 0;
        a.dropTarget = 0;
        a.statusText = "Membaca buku";
      }
    }
    function startCoffee(a) {
      endScene(a);
      freeSpot(a);
      var seat = claimSeat(a);
      if (!seat) {
        if (a.cfg.beanbag) startRead(a, "meet");
        else startSleep(a);
        return;
      }
      var sc = (a.scene = { kind: "coffee", token: ++sceneSeq, phase: "brew" });
      a.statusText = "Membuat kopi";
      sendTo(a, BREW_POS, [], -Math.PI / 2, function () {
        a.state = "idle";
        sceneAfter(a, 2300, function () {
          if (a.cupProp) a.cupProp.visible = true;
          sc.phase = "drink";
          a.statusText = "Menuju meja rapat";
          sendTo(a, seat.pos, seat.via, seat.yaw, function () {
            a.state = "idle";
            a.sitTarget = 1;
            a.dropTarget = seat.drop;
            a.statusText = "Menikmati kopi";
          });
        });
      });
    }
    function goIdle(a) {
      if (
        a.bookProp &&
        a.bookProp.visible &&
        a.scene &&
        a.scene.kind === "read"
      ) {
        leaveScene(a, function () {
          goIdle(a);
        });
        return;
      }
      endScene(a);
      if (a.cfg.beanbag) {
        if (Math.random() < 0.38) startCoffee(a);
        else startRead(a, "meet");
        return;
      }
      var r = Math.random();
      if (r < 0.36) startSleep(a);
      else if (r < 0.68) startRead(a);
      else startCoffee(a);
    }
    var audioCtx = null,
      soundOn = true,
      audioReady = false;
    function ensureAudio() {
      if (!audioCtx) {
        try {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
          audioCtx = null;
        }
      }
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
      if (audioCtx) {
        audioReady = true;
        document.getElementById("soundHint").style.display = "none";
      }
    }
    window.addEventListener("pointerdown", ensureAudio, { passive: true });
    function bell(freqs, dur, gainPeak, type) {
      if (!soundOn || !audioCtx || audioCtx.state !== "running") return;
      var t = audioCtx.currentTime;
      freqs.forEach(function (f, i) {
        var o = audioCtx.createOscillator(),
          g = audioCtx.createGain();
        o.type = type || "sine";
        o.frequency.value = f;
        var start = t + i * 0.07;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(gainPeak / (i + 1), start + 0.012);
        g.gain.exponentialRampToValueAtTime(1e-4, start + dur);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(start);
        o.stop(start + dur + 0.05);
      });
    }
    function playCling() {
      bell([1567.98, 2093, 2637], 0.55, 0.22);
    }
    function playDone() {
      bell([659.25, 987.77], 0.5, 0.16);
    }
    function playMeet() {
      bell([523.25, 783.99], 0.5, 0.15);
    }
    var logEl = document.getElementById("log");
    function nowTime() {
      var d = new Date();
      return (
        String(d.getHours()).padStart(2, "0") +
        ":" +
        String(d.getMinutes()).padStart(2, "0")
      );
    }
    function log(msg) {
      var li = document.createElement("li");
      li.innerHTML = "<time>" + nowTime() + "</time><span></span>";
      li.querySelector("span").textContent = msg;
      logEl.insertBefore(li, logEl.firstChild);
      while (logEl.children.length > 9) logEl.removeChild(logEl.lastChild);
    }
    var tasks = [],
      taskSeq = 0,
      meetingActive = false;
    var taskListEl = document.getElementById("taskList");
    var SAMPLE_TASKS = [
      "Riset pergerakan harga BBCA minggu ini",
      "Susun draf laporan keuangan Q3",
      "Review pull request #58 di repo pinfold",
      "Desain ulang halaman landing produk",
      "Analisis data penjualan per provinsi",
      "Buat naskah konten Threads minggu ini",
      "Perbaiki bug login di aplikasi absensi",
      "Siapkan materi presentasi untuk klien",
      "Riset kompetitor: fitur HRIS terbaru",
      "Rekap notulen dan tindak lanjut rapat",
      "Uji alur checkout di toko online",
      "Susun jadwal posting media sosial",
    ];
    function hexCss(n) {
      return "#" + n.toString(16).padStart(6, "0");
    }
    function renderTasks() {
      if (!tasks.length) {
        taskListEl.innerHTML =
          '<p class="empty">Belum ada tugas. Kirim tugas pertama lewat formulir di atas.</p>';
        return;
      }
      taskListEl.innerHTML = "";
      tasks
        .slice()
        .reverse()
        .forEach(function (t) {
          var div = document.createElement("div");
          div.className = "task";
          var pillCls =
            t.status === "Dikerjakan"
              ? "run"
              : t.status === "Selesai"
                ? "done"
                : "";
          div.innerHTML =
            '<div class="tt"><span></span><span class="pill ' +
            pillCls +
            '">' +
            t.status +
            "</span></div>" +
            '<div class="meta"><span class="ava" style="background:' +
            hexCss(t.agent.cfg.shirt) +
            '"></span><span></span></div>' +
            '<div class="pbar"><i style="width:' +
            Math.round(t.progress) +
            '%"></i></div>';
          div.querySelector(".tt span").textContent = t.title;
          div.querySelector(".meta span:last-child").textContent =
            t.agent.cfg.name + " · " + t.agent.cfg.role;
          taskListEl.appendChild(div);
        });
    }
    function pickAgent(preferredId) {
      if (preferredId && preferredId !== "auto") {
        var want = agents.find(function (a) {
          return a.cfg.id === preferredId;
        });
        if (want && !want.task && !meetingActive) return want;
        if (want && want.task) return null;
        return want;
      }
      var free = agents.filter(function (a) {
        return !a.task;
      });
      if (!free.length) return null;
      var idleFirst = free.filter(function (a) {
        return a.state === "idle";
      });
      var pool = idleFirst.length ? idleFirst : free;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    function startWork(a, t) {
      t.status = "Dikerjakan";
      a.state = "work";
      a.sitTarget = 1;
      a.dropTarget = a.homeDrop;
      a.statusText = a.cfg.beanbag
        ? "Mengerjakan tugas di beanbag"
        : "Mengerjakan tugas";
      renderTasks();
    }
    function assignTask(title, preferredId, silent) {
      var a = pickAgent(preferredId);
      if (!a) {
        log("Tugas menunggu antrean: " + title);
        return null;
      }
      var t = {
        id: ++taskSeq,
        title: title,
        agent: a,
        progress: 0,
        duration: Math.min(24e3, 1e4 + title.length * 160),
        status: "Menuju meja",
        elapsed: 0,
      };
      tasks.push(t);
      a.task = t;
      a.pendingIdle = false;
      a.celebrateT = 0;
      freeSpot(a);
      if (!silent) {
        playCling();
        a.startleT = 0.7;
        a.bangT = 1;
      }
      log("Tugas baru untuk " + a.cfg.name + ": " + title);
      leaveScene(a, function () {
        a.statusText = a.cfg.beanbag ? "Menuju beanbag" : "Menuju meja";
        sendTo(a, a.home.pos, [], a.home.yaw, function () {
          startWork(a, t);
        });
      });
      renderTasks();
      return t;
    }
    function completeTask(a) {
      var t = a.task;
      if (!t) return;
      t.progress = 100;
      t.status = "Selesai";
      a.task = null;
      playDone();
      log("Selesai: " + t.title + " (" + a.cfg.name + ")");
      renderTasks();
      a.celebrateT = 1.6;
      a.pendingIdle = true;
      a.sitTarget = 0;
      a.dropTarget = 0;
      a.statusText = "Tugas selesai!";
      if (a.cfg.beanbag) {
        a.bagLeaving = true;
        a.bagFrom = a.group.position.clone();
      }
    }
    var waitQueue = [];
    setInterval(function () {
      if (!waitQueue.length || meetingActive) return;
      var a = pickAgent("auto");
      if (a) {
        var title = waitQueue.shift();
        assignTask(title, "auto", false);
      }
    }, 2500);
    function sendToMeeting(a) {
      if (!a.meetSeat || !a.sceneCleared) return;
      a.sceneCleared = false;
      var seat = a.meetSeat;
      a.statusText = "Menuju ruang tengah";
      sendTo(a, seat.pos, seat.via, seat.yaw, function () {
        a.state = "meeting";
        a.sitTarget = 1;
        a.dropTarget = seat.drop;
        a.statusText = "Rapat";
      });
    }
    function startMeeting() {
      if (meetingActive) {
        log("Rapat sedang berjalan — tim masih berkumpul di ruang tengah.");
        return;
      }
      meetingActive = true;
      playMeet();
      log("Rapat dipanggil — semua agen ke ruang tengah.");
      var shuffled = meeting.seats.slice();
      agents.forEach(function (a, i) {
        a.sceneCleared = false;
        leaveScene(a, function () {
          a.sceneCleared = true;
          sendToMeeting(a);
        });
        var seat = shuffled[i % shuffled.length];
        if (seat.taken && seat.taken !== a) {
          seat =
            shuffled.find(function (s) {
              return !s.taken;
            }) || seat;
        }
        seat.taken = a;
        a.meetSeat = seat;
        a.pendingIdle = false;
        a.celebrateT = 0;
        if (a.task) {
          a.task.status = "Jeda — rapat";
        }
        freeSpot(a);
        sendToMeeting(a);
      });
      renderTasks();
      setTimeout(endMeeting, 16e3);
    }
    function endMeeting() {
      meetingActive = false;
      log("Rapat selesai.");
      agents.forEach(function (a) {
        if (a.meetSeat) {
          a.meetSeat.taken = null;
          a.meetSeat = null;
        }
        if (a.task) {
          var t = a.task;
          t.status = "Menuju meja";
          a.statusText = "Kembali bekerja";
          sendTo(a, a.home.pos, [], a.home.yaw, function () {
            startWork(a, t);
          });
        } else {
          goIdle(a);
        }
      });
      renderTasks();
    }
    var rosterEl = document.getElementById("roster");
    var agentSel = document.getElementById("taskAgent");
    agents.forEach(function (a) {
      var opt = document.createElement("option");
      opt.value = a.cfg.id;
      opt.textContent = a.cfg.name + " — " + a.cfg.role;
      agentSel.appendChild(opt);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mate";
      b.innerHTML =
        '<span class="face" style="background:' +
        hexCss(a.cfg.shirt) +
        '">' +
        a.cfg.name.charAt(0) +
        "</span>" +
        '<span><span class="nm">' +
        a.cfg.name +
        '</span><br><span class="rl">' +
        a.cfg.role +
        "</span></span>" +
        '<span class="st"></span>';
      b.addEventListener("click", function () {
        focusAgent(a);
      });
      rosterEl.appendChild(b);
      a.rosterStatus = b.querySelector(".st");
    });
    var camGoal = null;
    function flyTo(pos, tgt) {
      camGoal = { pos: pos.clone(), tgt: tgt.clone() };
    }
    controls.addEventListener("start", function () {
      camGoal = null;
    });
    var CAMS = {
      iso: {
        pos: new THREE.Vector3(10.4, 8.2, 11.7),
        tgt: new THREE.Vector3(0, 0.2, -0.2),
      },
      top: {
        pos: new THREE.Vector3(0.4, 17, 2.6),
        tgt: new THREE.Vector3(0, 0, -0.2),
      },
      meet: {
        pos: new THREE.Vector3(0.2, 2.9, 6.6),
        tgt: new THREE.Vector3(0, 0.5, 0.7),
      },
      lounge: {
        pos: new THREE.Vector3(1, 2.5, 7.6),
        tgt: new THREE.Vector3(4.3, 0.5, 2.8),
      },
    };
    function isoPos() {
      var asp = stage.clientWidth / Math.max(1, stage.clientHeight);
      var f = asp < 0.8 ? 1.75 : asp < 1.15 ? 1.35 : 1;
      return CAMS.iso.pos.clone().multiplyScalar(f);
    }
    document.querySelectorAll("[data-cam]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-cam");
        var c = CAMS[key];
        if (c) flyTo(key === "iso" ? isoPos() : c.pos, c.tgt);
      });
    });
    var focusRingAgent = null;
    function focusAgent(a) {
      agents.forEach(function (x) {
        x.ring.material.opacity = 0;
      });
      focusRingAgent = a;
      var p = a.group.position;
      flyTo(
        new THREE.Vector3(p.x + 3.4, 2.9, p.z + 4.4),
        new THREE.Vector3(p.x, 0.7, p.z),
      );
    }
    document
      .getElementById("taskForm")
      .addEventListener("submit", function (ev) {
        ev.preventDefault();
        ensureAudio();
        var title = document.getElementById("taskTitle").value.trim();
        if (!title)
          title = SAMPLE_TASKS[Math.floor(Math.random() * SAMPLE_TASKS.length)];
        var pref = agentSel.value;
        var t = assignTask(title, pref, false);
        if (!t) {
          waitQueue.push(title);
          if (pref !== "auto") {
            var busy = agents.find(function (x) {
              return x.cfg.id === pref;
            });
            if (busy)
              log(busy.cfg.name + " sedang sibuk — tugas masuk antrean.");
          }
        }
        document.getElementById("taskTitle").value = "";
      });
    document.getElementById("btnRandom").addEventListener("click", function () {
      ensureAudio();
      var title = SAMPLE_TASKS[Math.floor(Math.random() * SAMPLE_TASKS.length)];
      if (!assignTask(title, "auto", false)) waitQueue.push(title);
    });
    document
      .getElementById("btnMeeting")
      .addEventListener("click", function () {
        ensureAudio();
        startMeeting();
      });
    var btnSound = document.getElementById("btnSound");
    btnSound.addEventListener("click", function () {
      soundOn = !soundOn;
      btnSound.setAttribute("aria-pressed", soundOn ? "true" : "false");
      if (soundOn) {
        ensureAudio();
        playCling();
      }
    });
    var demoOn = true,
      demoTimer = 0;
    var btnDemo = document.getElementById("btnDemo");
    btnDemo.addEventListener("click", function () {
      demoOn = !demoOn;
      btnDemo.setAttribute("aria-pressed", demoOn ? "true" : "false");
      log("Demo otomatis " + (demoOn ? "diaktifkan" : "dimatikan") + ".");
    });
    var modelStatus = document.getElementById("modelStatus");
    var btnRetryVrm = document.getElementById("btnRetryVrm");
    var vrmLoading = false;
    function setModelStatus(msg) {
      if (!msg) {
        modelStatus.hidden = true;
        modelStatus.textContent = "";
      } else {
        modelStatus.hidden = false;
        modelStatus.textContent = msg;
      }
    }
    function loadAllVRM() {
      if (vrmLoading) return;
      var missing = agents.filter(function (a) {
        return !a.vrmData;
      });
      if (!missing.length) {
        setModelStatus("");
        btnRetryVrm.hidden = true;
        return;
      }
      vrmLoading = true;
      btnRetryVrm.hidden = true;
      setModelStatus("Memuat model VRoid… (0/" + missing.length + " agen)");
      log("Memuat model VRoid…");
      var chain = Promise.resolve(),
        done = 0,
        failed = [];
      missing.forEach(function (a) {
        chain = chain.then(function () {
          return loadOneVRM(a).then(function (ok) {
            done++;
            if (!ok) failed.push(a.cfg.name);
            setModelStatus(
              "Memuat model VRoid… (" + done + "/" + missing.length + " agen)",
            );
          });
        });
      });
      chain.then(function () {
        vrmLoading = false;
        if (!failed.length) {
          setModelStatus("");
          btnRetryVrm.hidden = true;
          log(
            "Model VRoid aktif: contoh resmi VRoid AvatarSample (A/B/C) dari folder assets/characters.",
          );
        } else {
          setModelStatus(
            "Model VRoid untuk " +
              failed.join(", ") +
              " gagal dimuat dari folder assets/characters — jalankan halaman ini lewat server statis/hosting agar folder assets terbaca (tidak bisa dari file://), lalu coba lagi.",
          );
          btnRetryVrm.hidden = false;
          log("Model VRoid gagal dimuat untuk: " + failed.join(", ") + ".");
        }
      });
    }
    btnRetryVrm.addEventListener("click", function () {
      loadAllVRM();
    });
    window.setTimeout(loadAllVRM, 120);
    var cycle = { p: 0.2, len: 76, df: 1, lastDraw: -1, lastElev: 99 };
    var phaseTxt = document.getElementById("phaseTxt");
    var phaseIcon = document.getElementById("phaseIcon");
    var SUN_SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="#ffd94d" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4" fill="#ffd94d" stroke="none"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    var MOON_SVG =
      '<svg viewBox="0 0 24 24" fill="#cfe0ff"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    function dayFactor(p) {
      if (p < 0.38) return 1;
      if (p < 0.5) return 0.5 + 0.5 * Math.cos(((p - 0.38) / 0.12) * Math.PI);
      if (p < 0.88) return 0;
      return 0.5 - 0.5 * Math.cos(((p - 0.88) / 0.12) * Math.PI);
    }
    function phaseLabel(p, df) {
      if (df > 0.85) return "Siang";
      if (df < 0.15) return "Malam";
      return p >= 0.38 && p < 0.5 ? "Senja" : "Fajar";
    }
    document.getElementById("btnPhase").addEventListener("click", function () {
      cycle.p = ((Math.floor(cycle.p / 0.25 + 0.001) + 1) * 0.25) % 1;
      if (cycle.p === 0) cycle.p = 0.02;
    });
    function updateCycle(dt) {
      if (!REDUCED) cycle.p = (cycle.p + dt / cycle.len) % 1;
      var df = dayFactor(cycle.p);
      cycle.df = df;
      var nt = 1 - df;
      var sp,
        elev,
        gold = 0,
        elevSigned = -1,
        sunSp = 0.5,
        envI,
        expT;
      if (cycle.p >= 0.88 || cycle.p < 0.5) {
        sp = ((cycle.p - 0.88 + 1) % 1) / 0.62;
        elev = Math.sin(Math.PI * sp);
        elevSigned = elev;
        sunSp = sp;
        sun.position.set(
          -16 + 3.2 * elev,
          1.9 + 13.2 * Math.pow(elev, 1.12),
          7.5 - 15 * sp,
        );
        gold = Math.min(1, Math.max(0, (0.42 - elev) / 0.17));
        sun.color.copy(sunLow).lerp(sunDay, Math.pow(elev, 0.85));
        if (gold > 0) sun.color.lerp(sunDeep, gold * 0.5);
        sun.intensity =
          (3.2 + 0.3 * elev) * (0.85 + 0.15 * Math.min(1, elev / 0.04));
        var dayAmb = Math.min(1, elev / 0.6);
        hemi.intensity = 0.1 + 0.05 * dayAmb;
        fill.intensity = 0.06 + 0.04 * dayAmb;
        envI = 0.08 + 0.07 * dayAmb;
        expT = 0.98 + 0.24 * Math.min(1, elev / 0.22);
      } else {
        var np = (cycle.p - 0.5) / 0.38,
          ne = Math.sin(Math.PI * np);
        elevSigned = -ne;
        sun.position.set(-16 + 30 * ne, 1.9 + 10.1 * ne, -7.5 + 15 * np);
        sun.color.copy(sunNight);
        sun.intensity = 0.6 + 1.9 * df;
        hemi.intensity = 0.18 + 0.07 * df;
        fill.intensity = 0.12 + 0.08 * df;
        envI = 0.12 + 0.33 * df;
        expT = 0.9 + 0.35 * df;
      }
      roomLamp.intensity = 2 + 34 * Math.pow(nt, 3);
      renderer.toneMappingExposure = expT;
      if (scene.environmentIntensity !== undefined)
        scene.environmentIntensity = envI;
      lampGlowMats.forEach(function (m) {
        m.emissiveIntensity = m.userData.base + nt * 1.7;
      });
      spotGlowMats.forEach(function (m) {
        m.opacity =
          m.userData.dayOp + nt * (m.userData.nightOp - m.userData.dayOp);
      });
      screenMats.forEach(function (m) {
        m.userData.cur = m.userData.base + nt * 0.65;
      });
      if (
        Math.abs(df - cycle.lastDraw) > 0.015 ||
        Math.abs(elevSigned - cycle.lastElev) > 0.02
      ) {
        drawView(df, elevSigned, gold, sunSp);
        cycle.lastDraw = df;
        cycle.lastElev = elevSigned;
      }
      var hour = cycle.p * 24;
      var hh = Math.floor(hour),
        mm = Math.floor((hour - hh) * 60);
      var lbl = phaseLabel(cycle.p, df);
      var txt =
        lbl +
        " · " +
        String(hh).padStart(2, "0") +
        ":" +
        String(mm).padStart(2, "0");
      if (txt !== cycle.lastTxt) {
        cycle.lastTxt = txt;
        phaseTxt.textContent = txt;
        phaseIcon.innerHTML = df > 0.4 ? SUN_SVG : MOON_SVG;
      }
    }
    (function initAgents() {
      var sinta = agents[0];
      sinta.group.position.copy(sinta.home.pos);
      sinta.yaw = sinta.targetYaw = Math.PI;
      sinta.state = "idle";
      sinta.sitTarget = 1;
      sinta.sit = 1;
      sinta.statusText = "Tidur di meja";
      sinta.scene = { kind: "sleep", token: 0 };
      var bima = agents[2];
      bima.group.position.copy(bima.home.pos);
      bima.yaw = bima.targetYaw = Math.PI;
      bima.state = "idle";
      bima.sitTarget = 1;
      bima.sit = 1;
      bima.statusText = "Tidur di meja";
      bima.scene = { kind: "sleep", token: 0 };
      var dewi = agents[3];
      var wp = standSpots[0];
      wp.taken = dewi;
      dewi.idleSpot = wp;
      dewi.group.position.copy(wp.pos);
      dewi.yaw = dewi.targetYaw = wp.yaw;
      dewi.statusText = "Menikmati pemandangan";
      var fajar = agents[4];
      var fseat = meeting.seats[1];
      fseat.taken = fajar;
      fajar.sceneSeat = fseat;
      fajar.group.position.copy(fseat.pos);
      fajar.yaw = fajar.targetYaw = fseat.yaw;
      fajar.state = "idle";
      fajar.sitTarget = 1;
      fajar.sit = 1;
      fajar.drop = fajar.dropTarget = fseat.drop;
      fajar.scene = { kind: "read", token: 0, phase: "read", dest: "meet" };
      if (fajar.bookProp) fajar.bookProp.visible = true;
      fajar.statusText = "Membaca buku";
      var nadia = agents[1];
      nadia.group.position.copy(nadia.home.pos);
      nadia.yaw = nadia.targetYaw = Math.PI;
      nadia.state = "idle";
      nadia.sitTarget = 1;
      nadia.sit = 1;
      nadia.statusText = "Tidur di meja";
      nadia.scene = { kind: "sleep", token: 0 };
      log("Kantor dibuka — tim mulai berdatangan.");
      setTimeout(function () {
        assignTask("Brief & prioritas kerja hari ini", "sinta", true);
      }, 1500);
      setTimeout(function () {
        if (demoOn)
          assignTask("Riset pergerakan harga BBCA minggu ini", "fajar", true);
      }, 6e3);
    })();
    function updateScreens(dt, t) {
      agents.forEach(function (a, i) {
        var scr = a.desk && a.desk.screen;
        if (!scr) return;
        var m = scr.material,
          u = m.userData;
        var working =
          a.state === "work" && !!a.task && a.sit > 0.7 && !a.path.length;
        if (working) u.hold = 2;
        else if (u.hold > 0) u.hold -= dt;
        var target = working || u.hold > 0 ? 1 : 0;
        u.onAmt += (target - u.onAmt) * Math.min(1, dt * 6);
        if (Math.abs(target - u.onAmt) < 0.01) u.onAmt = target;
        var wantMap = u.onAmt > 0.5 ? u.litTex : SLEEP_TEX;
        if (m.map !== wantMap) {
          m.map = wantMap;
          m.emissiveMap = wantMap;
        }
        if (u.onAmt > 0.5 && u.litTex.userData && u.litTex.userData.canvas) {
          u.animT = (u.animT || 0) + dt;
          if (u.animT > 0.18) {
            drawScreenLive(u.litTex.userData, a, u.animT, t);
            u.litTex.needsUpdate = true;
            u.animT = 0;
          }
        }
        var base = u.cur !== undefined ? u.cur : u.base;
        var flick = working ? Math.sin(t * 7 + i) * 0.1 : 0;
        m.emissiveIntensity = Math.max(0, u.onAmt * (base + flick));
      });
    }
    var clockT = new THREE.Clock();
    var projV = new THREE.Vector3();
    function easeYaw(a, from, to) {
      var d = to - from;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return from + d * Math.min(1, a);
    }
    function animateAgent(a, dt, t, dtW) {
      if (dtW === undefined) dtW = dt;
      var p = a.group.position;
      var moving = false;
      if (a.celebrateT > 0) {
        a.celebrateT -= dt;
        if (a.celebrateT <= 0 && a.pendingIdle) {
          a.pendingIdle = false;
          if (!meetingActive && !a.task) goIdle(a);
        }
      }
      if (a.startleT > 0) a.startleT = Math.max(0, a.startleT - dtW);
      if (a.bangT > 0) a.bangT = Math.max(0, a.bangT - dtW);
      var stProg = a.startleT > 0 ? 1 - a.startleT / 0.7 : 1;
      a.startleEnv = a.startleT > 0 ? Math.sin(stProg * Math.PI) : 0;
      if (a.cfg.beanbag) {
        if (a.bagLeaving) {
          var lvFrom = a.bagFrom || bagFrontPos;
          p.x = bagFrontPos.x + (lvFrom.x - bagFrontPos.x) * a.sit;
          p.z = bagFrontPos.z + (lvFrom.z - bagFrontPos.z) * a.sit;
          if (a.sit < 0.05) {
            a.bagLeaving = false;
            p.x = bagFrontPos.x;
            p.z = bagFrontPos.z;
          }
        } else if (a.bagSeating) {
          var stFrom = a.bagFrom || bagFrontPos;
          p.x = stFrom.x + (beanbagPos.x - stFrom.x) * a.sit;
          p.z = stFrom.z + (beanbagPos.z - stFrom.z) * a.sit;
          if (a.sit > 0.98) {
            a.bagSeating = false;
            p.x = beanbagPos.x;
            p.z = beanbagPos.z;
          }
        }
      }
      if (a.path.length && !a.bagLeaving) {
        var target = a.path[0];
        var dx = target.x - p.x,
          dz = target.z - p.z;
        var dist = Math.hypot(dx, dz);
        var step = a.speed * dt;
        if (dist < 0.08) {
          a.path.shift();
          if (!a.path.length) {
            a.targetYaw =
              a.finalYaw !== undefined && a.finalYaw !== null
                ? a.finalYaw
                : a.targetYaw;
            var cb = a.onArrive;
            a.onArrive = null;
            if (cb) cb();
          }
        } else {
          p.x += (dx / dist) * Math.min(step, dist);
          p.z += (dz / dist) * Math.min(step, dist);
          a.targetYaw = Math.atan2(dx, dz);
          moving = true;
        }
      }
      a._moving = moving;
      p.x = Math.max(-FW / 2 + 0.45, Math.min(FW / 2 - 0.45, p.x));
      p.z = Math.max(-FD / 2 + 0.45, Math.min(FD / 2 - 0.45, p.z));
      if (a.startleT > 0 && !REDUCED) {
        var jp = stProg,
          air;
        if (jp < 0.28) {
          var ju = jp / 0.28;
          air = 1 - (1 - ju) * (1 - ju);
        } else if (jp < 0.45) air = 1 - ((jp - 0.28) / 0.17) * 0.08;
        else if (jp < 0.68) {
          var ju2 = (jp - 0.45) / 0.23;
          air = 0.92 * (1 - ju2 * ju2);
        } else air = 0;
        a.group.position.y = air * 0.32;
        var land =
          jp >= 0.68 ? Math.sin(Math.min(1, (jp - 0.68) / 0.32) * Math.PI) : 0;
        var anti = jp < 0.14 ? Math.sin((jp / 0.14) * Math.PI) : 0;
        a.group.scale.set(
          1 - air * 0.03 + land * 0.09 + anti * 0.04,
          1 + air * 0.05 - land * 0.13 - anti * 0.05,
          1 - air * 0.03 + land * 0.09 + anti * 0.04,
        );
      } else if (a.group.position.y !== 0) {
        a.group.position.y = 0;
        a.group.scale.set(1, 1, 1);
      }
      a.yaw = easeYaw(dt * 8, a.yaw, a.targetYaw);
      a.group.rotation.y = a.yaw;
      a.sit += (a.sitTarget - a.sit) * Math.min(1, dt * 5);
      a.drop += (a.dropTarget - a.drop) * Math.min(1, dt * 5);
      var slpTgt =
        a.scene &&
        a.scene.kind === "sleep" &&
        a.state === "idle" &&
        !a.path.length &&
        a.sit > 0.6
          ? 1
          : 0;
      var slpRate = slpTgt > (a.sleepAmt || 0) ? 1.7 : 5.5;
      a.sleepAmt =
        (a.sleepAmt || 0) +
        (slpTgt - (a.sleepAmt || 0)) * Math.min(1, dtW * slpRate);
      var rdTgt =
        a.scene &&
        a.scene.kind === "read" &&
        a.scene.phase === "read" &&
        !a.path.length
          ? 1
          : 0;
      a.readAmt =
        (a.readAmt || 0) + (rdTgt - (a.readAmt || 0)) * Math.min(1, dtW * 3);
      var cofTgt =
        a.scene &&
        a.scene.kind === "coffee" &&
        a.scene.phase === "drink" &&
        !a.path.length &&
        a.sit > 0.6
          ? 1
          : 0;
      a.coffeeAmt =
        (a.coffeeAmt || 0) +
        (cofTgt - (a.coffeeAmt || 0)) * Math.min(1, dtW * 3);
      if (a.bookProp && a.bookProp.visible) {
        var bkY = a.bookY || [1.42, 0.95];
        var readY = bkY[0] + (bkY[1] - bkY[0]) * a.sit;
        var openA = a.readAmt || 0;
        var swB = a._moving ? Math.sin(a.phase) : 0;
        var carP = new THREE.Vector3(
          -0.33,
          1.04 - a.sit * 0.06,
          0.07 + swB * 0.07,
        );
        if (
          openA < 0.99 &&
          a.vrmData &&
          a.vrmData.bones &&
          a.vrmData.bones.handR
        ) {
          var hwB = new THREE.Vector3();
          a.vrmData.bones.handR.getWorldPosition(hwB);
          a.group.updateWorldMatrix(true, false);
          var hlB = a.group.worldToLocal(hwB);
          carP.set(hlB.x - 0.02, hlB.y - 0.04, hlB.z + 0.03);
        }
        var readP = new THREE.Vector3(0, readY, a.bookZ || 0.46);
        a.bookProp.position.copy(carP.lerp(readP, openA));
        var carRx = -1.18 + swB * 0.16;
        a.bookProp.rotation.set(
          carRx + (-0.52 - carRx) * openA,
          0,
          0.1 * (1 - openA),
        );
        if (a.bookPages) {
          a.bookPages[0].rotation.z = 0.02 + 0.14 * openA;
          a.bookPages[1].rotation.z = -0.02 - 0.14 * openA;
        }
      }
      var cupSettled =
        a.cupProp &&
        a.cupProp.visible &&
        a.scene &&
        a.scene.kind === "coffee" &&
        a.scene.phase === "drink" &&
        !a.path.length &&
        a.sit > 0.6;
      if (a.cupProp && a.cupProp.visible) {
        if (cupSettled) {
          if (!a.cupRestW) {
            var cenW = new THREE.Vector3(TABLE_C.x, 0, TABLE_C.z);
            var seatW = (
              a.sceneSeat ? a.sceneSeat.pos : a.group.position
            ).clone();
            seatW.y = 0;
            var dirS = seatW.clone().sub(cenW);
            if (dirS.lengthSq() < 0.01) dirS.set(0, 0, 1);
            dirS.normalize();
            var restW = cenW.clone().addScaledVector(dirS, 0.52);
            restW.addScaledVector(new THREE.Vector3(-dirS.z, 0, dirS.x), -0.13);
            restW.x = Math.max(
              TABLE_C.x - 0.55,
              Math.min(TABLE_C.x + 0.55, restW.x),
            );
            restW.z = Math.max(
              TABLE_C.z - 0.24,
              Math.min(TABLE_C.z + 0.24, restW.z),
            );
            restW.y = 0.48 + 0.064;
            a.cupRestW = restW;
            a.group.updateMatrixWorld(true);
            a.cupFromW = a.group.localToWorld(a.cupProp.position.clone());
            a.cupSettleT = 0.45;
          }
          var mouthW;
          if (a.vrmData && a.vrmData.bones && a.vrmData.bones.head) {
            var hdW = new THREE.Vector3();
            a.vrmData.bones.head.getWorldPosition(hdW);
            var fwW = new THREE.Vector3(Math.sin(a.yaw), 0, Math.cos(a.yaw));
            mouthW = hdW.clone().addScaledVector(fwW, 0.24);
            mouthW.addScaledVector(new THREE.Vector3(-fwW.z, 0, fwW.x), 0.05);
            mouthW.y = hdW.y + 0.1 - 0.15;
          } else {
            mouthW = a.group.localToWorld(new THREE.Vector3(-0.07, 1.3, 0.28));
          }
          var cyc2 =
            a.cupCyc ||
            (a.cupCyc = { phase: "rest", t: 1.2 + Math.random() * 2.5 });
          cyc2.t -= dtW;
          var cupW = a.cupRestW.clone(),
            holdTgt = 0,
            sipTgt = 0;
          if ((a.cupSettleT || 0) > 0) {
            a.cupSettleT -= dtW;
            var su2 = 1 - Math.max(0, a.cupSettleT) / 0.45;
            su2 = su2 * su2 * (3 - 2 * su2);
            cupW = a.cupFromW.clone().lerp(a.cupRestW, su2);
            cupW.y += Math.sin(su2 * Math.PI) * 0.04;
            cyc2.phase = "rest";
            cyc2.t = Math.max(cyc2.t, 0.6);
          } else if (cyc2.phase === "rest") {
            if (cyc2.t <= 0) {
              cyc2.phase = "reach";
              cyc2.t = 0.5;
            }
          } else if (cyc2.phase === "reach") {
            holdTgt = 1;
            if (cyc2.t <= 0) {
              cyc2.phase = "lift";
              cyc2.t = 0.7;
            }
          } else if (cyc2.phase === "lift") {
            holdTgt = 1;
            var lu2 = 1 - Math.max(0, cyc2.t) / 0.7;
            lu2 = lu2 * lu2 * (3 - 2 * lu2);
            cupW = cupArc(a.cupRestW, mouthW, lu2);
            if (cyc2.t <= 0) {
              cyc2.phase = "sip";
              cyc2.t = 1 + Math.random() * 0.4;
            }
          } else if (cyc2.phase === "sip") {
            holdTgt = 1;
            sipTgt = 1;
            cupW = mouthW.clone();
            if (cyc2.t <= 0) {
              cyc2.phase = "lower";
              cyc2.t = 0.7;
            }
          } else if (cyc2.phase === "lower") {
            holdTgt = 1;
            var uu2 = Math.max(0, cyc2.t) / 0.7;
            uu2 = uu2 * uu2 * (3 - 2 * uu2);
            cupW = cupArc(a.cupRestW, mouthW, uu2);
            if (cyc2.t <= 0) {
              cyc2.phase = "release";
              cyc2.t = 0.45;
            }
          } else {
            if (cyc2.t <= 0) {
              cyc2.phase = "rest";
              cyc2.t = 2.5 + Math.random() * 3.5;
            }
          }
          a.cupHold += (holdTgt - a.cupHold) * Math.min(1, dtW * 6);
          a.sipAmt += (sipTgt - a.sipAmt) * Math.min(1, dtW * 6);
          a.group.updateMatrixWorld(true);
          a.cupProp.position.copy(a.group.worldToLocal(cupW));
          a.cupProp.rotation.set(-0.3 * (a.sipAmt || 0), 0, 0);
        } else {
          var cpP = a.cupPos || { x: 0.24, y: 0.97, ys: 0.82, z: 0.27 };
          a.cupProp.position.set(
            cpP.x,
            cpP.y + (cpP.ys - cpP.y) * a.sit,
            cpP.z,
          );
          a.cupProp.rotation.set(0, 0, 0);
          a.cupHold += (0 - a.cupHold) * Math.min(1, dtW * 7);
          a.sipAmt += (0 - a.sipAmt) * Math.min(1, dtW * 6);
        }
      }
      var sit = a.sit;
      a.hips.position.y = 0.31 - sit * 0.02 - a.drop;
      var bagF = Math.max(0, Math.min(1, (a.drop - 0.1) / 0.07));
      a.proc.position.y = bagF * sit * 0.48;
      var walkSwing = 0;
      if (moving) {
        a.phase += dt * 8.5;
        walkSwing = Math.sin(a.phase);
      } else a.phase += dt * 1.4;
      var swL = moving ? walkSwing * 0.6 : 0,
        swR = moving ? -walkSwing * 0.6 : 0;
      a.legL.thigh.rotation.x = swL - sit * 1.42;
      a.legR.thigh.rotation.x = swR - sit * 1.42;
      a.legL.knee.rotation.x =
        (moving ? Math.max(0, -walkSwing) * 0.7 : 0) + sit * 1.35;
      a.legR.knee.rotation.x =
        (moving ? Math.max(0, walkSwing) * 0.7 : 0) + sit * 1.35;
      var bob = moving
        ? Math.abs(Math.sin(a.phase)) * 0.045
        : Math.sin(t * 1.6 + a.phase) * 0.01;
      a.hips.position.y += bob * (1 - sit);
      if (a.celebrateT > 0 && !moving)
        a.hips.position.y += Math.abs(Math.sin(t * 9)) * 0.055;
      a.hips.rotation.x = moving ? 0.06 : 0;
      var typing = a.state === "work" && sit > 0.7;
      var cyc = a.cyc;
      var deskWorkPose = typing && !a.cfg.beanbag;
      if (deskWorkPose) {
        cyc.t -= dtW;
        if (cyc.t <= 0) {
          cyc.phase = cyc.phase === "type" ? "mouse" : "type";
          cyc.t = 3 + Math.random() * 4;
        }
        cyc.clickT -= dtW;
        if (cyc.clickT <= 0) cyc.clickT = 0.7 + Math.random() * 1.1;
        cyc.glanceT -= dtW;
        if (cyc.glanceT <= -1.1) cyc.glanceT = 3.2 + Math.random() * 3.6;
      }
      cyc.mouseAmt +=
        ((deskWorkPose && cyc.phase === "mouse" ? 1 : 0) - cyc.mouseAmt) *
        Math.min(1, dtW * 2.6);
      a.glanceAmt =
        deskWorkPose && cyc.glanceT < 0
          ? Math.sin(Math.min(1, -cyc.glanceT / 1.1) * Math.PI)
          : 0;
      var clickPulse =
        deskWorkPose && cyc.phase === "mouse" && cyc.clickT < 0.12
          ? Math.sin((cyc.clickT / 0.12) * Math.PI)
          : 0;
      if (moving) {
        a.armL.rotation.x = -walkSwing * 0.55;
        a.armR.rotation.x = walkSwing * 0.55;
        a.armL.rotation.z = 0.12;
        a.armR.rotation.z = -0.12;
      } else if (typing) {
        var mA = cyc.mouseAmt;
        a.armL.rotation.x = -1.05 + Math.sin(t * 11 + a.phase) * 0.08;
        a.armR.rotation.x =
          (-1.05 + Math.cos(t * 12.3 + a.phase) * 0.08) * (1 - mA) +
          (-0.92 + clickPulse * 0.07) * mA;
        a.armL.rotation.z = 0.24;
        a.armR.rotation.z = -0.24 * (1 - mA) + -0.55 * mA;
      } else if (a.state === "meeting" && sit > 0.7) {
        a.armL.rotation.x = -0.85;
        a.armR.rotation.x = -0.85;
        a.armL.rotation.z = 0.3;
        a.armR.rotation.z = -0.3;
      } else if (sit > 0.7) {
        a.armL.rotation.x = -0.22;
        a.armR.rotation.x = -0.22;
        a.armL.rotation.z = 0.16;
        a.armR.rotation.z = -0.16;
      } else {
        a.armL.rotation.x = Math.sin(t * 1.3 + a.phase) * 0.05;
        a.armR.rotation.x = -Math.sin(t * 1.3 + a.phase) * 0.05;
        a.armL.rotation.z = 0.1;
        a.armR.rotation.z = -0.1;
      }
      a.head.rotation.y = moving
        ? 0
        : Math.sin(t * 0.45 + a.phase * 2) * 0.22 * (1 - sit * 0.4);
      a.head.rotation.x = typing
        ? 0.14 + Math.sin(t * 2.2) * 0.03 + a.glanceAmt * 0.17
        : Math.sin(t * 0.8 + a.phase) * 0.04;
      if (focusRingAgent === a)
        a.ring.material.opacity = 0.55 + Math.sin(t * 4) * 0.25;
      projV.set(p.x, a.tagY || 1.8, p.z).project(camera);
      var vis = projV.z < 1;
      a.tag.style.display = vis ? "block" : "none";
      if (vis) {
        var sx = (projV.x * 0.5 + 0.5) * stage.clientWidth;
        var sy = (-projV.y * 0.5 + 0.5) * stage.clientHeight;
        sx = Math.max(66, Math.min(stage.clientWidth - 66, sx));
        sy = Math.max(
          topPad,
          Math.min(stage.clientHeight - 8, sy - (a.tagLift || 0)),
        );
        a.tag.style.transform =
          "translate(" +
          sx.toFixed(1) +
          "px," +
          sy.toFixed(1) +
          "px) translate(-50%,-115%)";
      }
      if (a.bang) {
        if (a.bangT > 0 && vis) {
          var hdDrop = (a.headDrop || 0.45) - (a.drop > 0.12 ? 0.2 : 0);
          var headY = (a.headY0 || 1.9) - a.sit * hdDrop + p.y;
          var camEl = camera.matrixWorld.elements;
          var sideOff = a.headSide || 0.4;
          projV
            .set(p.x + camEl[0] * sideOff, headY, p.z + camEl[2] * sideOff)
            .project(camera);
          var bx = (projV.x * 0.5 + 0.5) * stage.clientWidth;
          var by = (-projV.y * 0.5 + 0.5) * stage.clientHeight;
          bx = Math.max(30, Math.min(stage.clientWidth - 30, bx));
          by = Math.max(34, Math.min(stage.clientHeight - 30, by));
          var bp = 1 - a.bangT / 1;
          var bs =
            bp < 0.18
              ? 0.35 + (bp / 0.18) * 0.65
              : 1 + Math.sin(bp * Math.PI) * 0.07;
          a.bang.style.display = "block";
          a.bang.style.transform =
            "translate(" +
            bx.toFixed(1) +
            "px," +
            by.toFixed(1) +
            "px) translate(-50%,-50%) scale(" +
            bs.toFixed(2) +
            ")";
        } else if (a.bang.style.display !== "none")
          a.bang.style.display = "none";
      }
      if (a.zzz) {
        var showZ =
          vis && a.sleepAmt > 0.45 && a.scene && a.scene.kind === "sleep";
        if (showZ) {
          var hdDropZ = (a.headDrop || 0.45) - (a.drop > 0.12 ? 0.2 : 0);
          var headYZ =
            (a.headY0 || 1.9) - a.sit * hdDropZ - (a.sleepAmt || 0) * 0.3 + p.y;
          var camElZ = camera.matrixWorld.elements;
          var sideZ = (a.headSide || 0.4) + 0.08;
          projV
            .set(
              p.x + camElZ[0] * sideZ,
              headYZ + 0.34,
              p.z + camElZ[2] * sideZ,
            )
            .project(camera);
          var zx = (projV.x * 0.5 + 0.5) * stage.clientWidth;
          var zy = (-projV.y * 0.5 + 0.5) * stage.clientHeight;
          zx = Math.max(34, Math.min(stage.clientWidth - 34, zx));
          zy = Math.max(40, Math.min(stage.clientHeight - 30, zy));
          a.zzz.style.display = "block";
          a.zzz.style.transform =
            "translate(" +
            zx.toFixed(1) +
            "px," +
            zy.toFixed(1) +
            "px) translate(-38%,-88%)";
        } else if (a.zzz.style.display !== "none") a.zzz.style.display = "none";
      }
      var dotColor =
        a.state === "work"
          ? "#57e6b8"
          : a.state === "meeting"
            ? "#7cc4ff"
            : a.path.length
              ? "#ffc94d"
              : "#8be0a4";
      a.tagDot.style.background = dotColor;
      a.rosterStatus.textContent = a.task
        ? "Bekerja · " + Math.round(a.task.progress) + "%"
        : a.statusText;
      if (a.state === "work" && a.task && sit > 0.85) {
        a.task.elapsed += dt * 1e3;
        a.task.progress = Math.min(
          100,
          (a.task.elapsed / a.task.duration) * 100,
        );
        if (a.task.elapsed >= a.task.duration) {
          completeTask(a);
        } else if ((a.task._lastRender || 0) + 0.25 < t) {
          a.task._lastRender = t;
          renderTasks();
        }
      }
    }
    var topPad = 118;
    function resize() {
      var w = stage.clientWidth,
        h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      var tb = document.getElementById("topbar");
      if (tb) topPad = Math.max(96, tb.offsetHeight + 62);
    }
    window.addEventListener("resize", resize);
    resize();
    if (!REDUCED) flyTo(isoPos(), CAMS.iso.tgt);
    else {
      camera.position.copy(isoPos());
    }
    var loopErrs = 0,
      loopDead = false;
    function loop() {
      if (loopDead) return;
      requestAnimationFrame(loop);
      try {
        frame();
        loopErrs = 0;
      } catch (e) {
        loopErrs++;
        if (loopErrs >= 3) {
          loopDead = true;
          showErr("Render 3D berhenti: " + ((e && e.message) || e));
        }
      }
    }
    function frame() {
      var rawDt = clockT.getDelta();
      var dt = Math.min(rawDt, 0.05);
      var dtW = Math.min(rawDt, 0.5);
      var t = clockT.elapsedTime;
      if (camGoal) {
        camera.position.lerp(camGoal.pos, 1 - Math.pow(0.0025, dt));
        controls.target.lerp(camGoal.tgt, 1 - Math.pow(0.0025, dt));
        if (camera.position.distanceTo(camGoal.pos) < 0.06) camGoal = null;
      }
      controls.update();
      updateCycle(dt);
      updateBagLaptop(dt);
      updateScreens(dt, t);
      agents.forEach(function (a, i) {
        animateAgent(a, dt, t, dtW);
        updateVRM(a, dt, t);
      });
      if (demoOn && !meetingActive) {
        demoTimer += dt;
        if (demoTimer > 20) {
          demoTimer = 0;
          var active = tasks.filter(function (x) {
            return x.status !== "Selesai";
          }).length;
          if (active < 3) {
            var title =
              SAMPLE_TASKS[Math.floor(Math.random() * SAMPLE_TASKS.length)];
            if (!assignTask(title, "auto", false)) waitQueue.push(title);
          }
        }
      }
      renderer.render(scene, camera);
    }
    var bm = document.getElementById("bootmsg");
    if (bm) bm.remove();
    enforceShadows(scene);
    loop();
  }
  function bootSafe() {
    if (typeof THREE === "undefined") {
      var tries = (bootSafe._tries || 0) + 1;
      bootSafe._tries = tries;
      if (tries <= 200) {
        setTimeout(bootSafe, 100);
        return;
      }
      var libMsg =
        "Pustaka 3D gagal dimuat dari folder assets (three.min.js). Periksa koneksi lalu coba lagi.";
      showErr(libMsg);
      var bmLib = document.getElementById("bootmsg");
      if (bmLib) {
        bmLib.style.cursor = "pointer";
        bmLib.innerHTML =
          'Kantor 3D gagal dimuat.<br><span style="font-weight:400;font-size:12.5px;opacity:.85">' +
          libMsg +
          "<br>Ketuk untuk mencoba lagi.</span>";
        bmLib.addEventListener("click", function () {
          location.reload();
        });
      }
      return;
    }
    try {
      boot();
    } catch (e) {
      var msg = (e && e.message) || String(e);
      showErr(msg);
      var bm2 = document.getElementById("bootmsg");
      if (bm2) {
        bm2.style.cursor = "pointer";
        bm2.innerHTML =
          'Kantor 3D gagal dimuat.<br><span style="font-weight:400;font-size:12.5px;opacity:.85">' +
          String(msg).replace(/</g, "&lt;") +
          "<br>Ketuk untuk mencoba lagi.</span>";
        bm2.addEventListener("click", function () {
          location.reload();
        });
      }
    }
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", bootSafe);
  else bootSafe();
})();
