/* ============================================================================
 *  interview.js — '면접실' 연출
 *  문 → 등장 → 인사 → 착석 → 책상 위 이력서 → 포스트잇 / 태블릿
 *
 *  문구는 data.js 의 intro 에서 바꿉니다.
 *  연출 순서와 시간은 아래 play() 함수 한 곳에 모여 있습니다.
 *  캐릭터는 그림 파일이 아니라 코드로 그린 SVG 입니다. (관절을 움직이기 위해)
 * ========================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     방 안의 위치 (단위: 가상 좌표. 화면 크기에 맞춰 카메라가 확대·축소합니다)
     --------------------------------------------------------------------- */
  const FLOOR = 700;      /* 바닥 높이 */
  const DOOR_X = 560;     /* 문 가운데 */
  const BESIDE_X = 765;   /* 의자 옆에 서는 자리 */
  const CHAIR_X = 915;    /* 의자 가운데 */

  const $ = function (id) { return document.getElementById(id); };
  const reduced = function () {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  /* ---------------------------------------------------------------------
     캐릭터 그림
     사진에서 가져온 특징: 숱 많은 검은 머리 + 일자 앞머리, 투명 뿔테 안경,
     작고 차분한 눈, 또렷한 코와 입술, 살짝 드러난 귀, 짙은 남색 정장
     --------------------------------------------------------------------- */
  const SKIN = "#f4d4bb", SKIN_D = "#e6b89a", HAIR = "#17151b", HAIR_L = "#37333e";
  const SUIT = "#1f2b47", SUIT_D = "#172036", SUIT_L = "#2d3b5e", SHOE = "#231f1f";

  const leg = function (id) {
    return '<g id="c-leg' + id + '">' +
      '<g id="c-thigh' + id + '"><path d="M-18,-6 L18,-6 L15,66 L-15,66 Z" fill="' + SUIT + '"/>' +
        '<path d="M6,-2 L6,64" stroke="' + SUIT_D + '" stroke-width="2" opacity=".55"/></g>' +
      '<g id="c-knee' + id + '">' +
        '<path d="M-15,-3 L15,-3 L13,60 L-13,60 Z" fill="' + SUIT + '"/>' +
        '<path d="M6,0 L5,58" stroke="' + SUIT_D + '" stroke-width="2" opacity=".55"/>' +
        '<g id="c-shoe' + id + '">' +
          '<path d="M-15,58 C-17,70 -17,76 -13,76 L14,76 C18,76 18,70 15,58 Z" fill="' + SHOE + '"/>' +
          '<path d="M-9,64 C-4,61 4,61 9,64" stroke="#57504c" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
        '</g>' +
      '</g>' +
    '</g>';
  };

  const arm = function (id) {
    return '<g id="c-arm' + id + '">' +
      '<path d="M-13,-8 C-13,-14 13,-14 13,-8 L11,50 L-11,50 Z" fill="' + SUIT + '"/>' +
      '<g id="c-elbow' + id + '">' +
        '<path d="M-11,-3 L11,-3 L9,42 L-9,42 Z" fill="' + SUIT + '"/>' +
        '<rect x="-8" y="39" width="16" height="6" rx="2" fill="#fbfaf7"/>' +
        '<ellipse cx="0" cy="52" rx="9.5" ry="11" fill="' + SKIN + '"/>' +
      '</g>' +
    '</g>';
  };

  const characterSVG =
    '<svg class="char__svg" width="1" height="1" aria-hidden="true" focusable="false">' +
      '<ellipse id="c-shadow" cx="0" cy="-2" rx="62" ry="11" fill="rgba(90,74,56,.22)"/>' +
      '<g id="c-pelvis">' +
        leg("R") + leg("L") + arm("R") +
        /* 상체 (골반 기준, 위쪽이 음수) */
        '<g id="c-torso">' +
          '<path d="M-37,16 L-43,-66 C-43,-81 -24,-87 -14,-90 L14,-90 C24,-87 43,-81 43,-66 L37,16 Z" fill="' + SUIT + '"/>' +
          '<g id="c-chest">' +
            '<path d="M-20,-92 L0,-34 L20,-92 Z" fill="#fbfaf7"/>' +
            '<path d="M-5.5,-76 L5.5,-76 L3.5,-66 L8,-42 L0,-33 L-8,-42 L-3.5,-66 Z" fill="#b5553f"/>' +
            '<path d="M-5.5,-76 L5.5,-76 L3.5,-66 L-3.5,-66 Z" fill="#94432f"/>' +
            '<path d="M-19,-90 L-30,-60 L-16,-56 L0,-30 L-9,-60 Z" fill="' + SUIT_L + '"/>' +
            '<path d="M19,-90 L30,-60 L16,-56 L0,-30 L9,-60 Z" fill="' + SUIT_L + '"/>' +
            '<path d="M-20,-92 L-8,-64 L0,-75 L8,-64 L20,-92 L10,-98 L-10,-98 Z" fill="#ffffff" stroke="#dcd8d0" stroke-width="1"/>' +
            '<path d="M0,-30 L0,16" stroke="' + SUIT_D + '" stroke-width="2"/>' +
            '<circle cx="3.5" cy="-17" r="2.6" fill="#0f1729"/><circle cx="3.5" cy="-1" r="2.6" fill="#0f1729"/>' +
            '<path d="M24,-46 L37,-48" stroke="#f3efe7" stroke-width="3.4" stroke-linecap="round"/>' +
          '</g>' +
        '</g>' +
        arm("L") +
        /* 머리 (얼굴 가운데가 0,0) */
        '<g id="c-head">' +
          '<path d="M-15,44 L-15,62 L0,72 L15,62 L15,44 Z" fill="' + SKIN_D + '"/>' +
          '<g id="c-hairBack">' +
            '<path d="M-58,4 C-72,-20 -74,-52 -52,-72 C-30,-92 30,-92 52,-72 C74,-52 72,-20 58,4 C54,-2 50,-8 46,-10 L-46,-10 C-50,-8 -54,-2 -58,4 Z" fill="' + HAIR + '"/>' +
          '</g>' +
          '<g id="c-earL"><ellipse cx="-54" cy="11" rx="10" ry="16" fill="' + SKIN + '"/>' +
            '<path d="M-59,3 C-63,10 -60,18 -55,20" stroke="' + SKIN_D + '" stroke-width="2.4" fill="none"/></g>' +
          '<g id="c-earR"><ellipse cx="54" cy="11" rx="10" ry="16" fill="' + SKIN + '"/>' +
            '<path d="M59,3 C63,10 60,18 55,20" stroke="' + SKIN_D + '" stroke-width="2.4" fill="none"/></g>' +
          '<path d="M-51,-22 C-54,12 -49,38 -30,54 C-15,67 15,67 30,54 C49,38 54,12 51,-22 C49,-54 -49,-54 -51,-22 Z" fill="' + SKIN + '"/>' +
          '<g id="c-features">' +
            '<ellipse cx="-34" cy="30" rx="10" ry="6" fill="#efb7a0" opacity=".2"/>' +
            '<ellipse cx="34" cy="30" rx="10" ry="6" fill="#efb7a0" opacity=".2"/>' +
            /* 눈썹 */
            '<path d="M-40,-10 C-32,-14 -21,-14 -12,-10" stroke="#2a2321" stroke-width="4.6" fill="none" stroke-linecap="round"/>' +
            '<path d="M40,-10 C32,-14 21,-14 12,-10" stroke="#2a2321" stroke-width="4.6" fill="none" stroke-linecap="round"/>' +
            /* 눈 */
            '<g id="c-eyeL" transform="translate(-25,7)">' +
              '<path d="M-11,0 C-6,-6 6,-6 11,1 C6,5 -6,5 -11,0 Z" fill="#fffdf9"/>' +
              '<g id="c-pupilL"><circle cx="0" cy="-.4" r="5.6" fill="#2a1913"/><circle cx="1.9" cy="-2.3" r="1.6" fill="#fff"/></g>' +
              '<path d="M-12,0 C-6,-7 6,-7 12,1" stroke="#231d1c" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
            '</g>' +
            '<g id="c-eyeR" transform="translate(25,7)">' +
              '<path d="M11,0 C6,-6 -6,-6 -11,1 C-6,5 6,5 11,0 Z" fill="#fffdf9"/>' +
              '<g id="c-pupilR"><circle cx="0" cy="-.4" r="5.6" fill="#2a1913"/><circle cx="1.9" cy="-2.3" r="1.6" fill="#fff"/></g>' +
              '<path d="M12,0 C6,-7 -6,-7 -12,1" stroke="#231d1c" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
            '</g>' +
            /* 코 */
            '<path d="M-8,30 C-6,34.5 -3,33.5 0,35 C3,33.5 6,34.5 8,30" stroke="#d3a086" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
            /* 입: 평소 / 웃을 때 */
            '<g id="c-mouthClosed">' +
              '<path d="M-13,44.4 C-7,42.4 -3,42 0,44 C3,42 7,42.4 13,44.4 C7,46.6 -7,46.6 -13,44.4 Z" fill="#c58a80"/>' +
              '<path d="M-13,44.4 C-7,46.6 7,46.6 13,44.4 C8,53 -8,53 -13,44.4 Z" fill="#dda797"/>' +
            '</g>' +
            '<g id="c-mouthSmile" opacity="0">' +
              '<path d="M-18,43 C-8,47 8,47 18,43 C13,57 -13,57 -18,43 Z" fill="#b95f5a"/>' +
              '<path d="M-15,44.6 C-7,47.4 7,47.4 15,44.6 L12,49 C5,50.6 -5,50.6 -12,49 Z" fill="#ffffff"/>' +
            '</g>' +
            /* 투명 뿔테 안경 */
            '<g id="c-glasses">' +
              '<path d="M-48,0 L-59,4 M48,0 L59,4" stroke="#cfa79a" stroke-width="3" stroke-linecap="round"/>' +
              '<rect x="-46" y="-9" width="39" height="31" rx="11" fill="rgba(255,255,255,.15)" stroke="#d3ad9f" stroke-width="2.9"/>' +
              '<rect x="7" y="-9" width="39" height="31" rx="11" fill="rgba(255,255,255,.15)" stroke="#d3ad9f" stroke-width="2.9"/>' +
              '<path d="M-7,-1 C-3,-5 3,-5 7,-1" stroke="#d3ad9f" stroke-width="2.8" fill="none"/>' +
              '<path d="M-40,-5 L-27,-6 M13,-5 L26,-6" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>' +
              '<rect x="-48" y="-8" width="5" height="4" rx="1" fill="#c8ccd2"/><rect x="43" y="-8" width="5" height="4" rx="1" fill="#c8ccd2"/>' +
            '</g>' +
            /* 눈 마주칠 때의 반짝임 */
            '<g id="c-sparkR" opacity="0"><path d="M0,-11 C1,-3 3,-1 11,0 C3,1 1,3 0,11 C-1,3 -3,1 -11,0 C-3,-1 -1,-3 0,-11 Z" fill="#ffffff" stroke="#f0c869" stroke-width="1.2"/></g>' +
            '<g id="c-sparkL" opacity="0"><path d="M0,-8 C.8,-2 2,-.8 8,0 C2,.8 .8,2 0,8 C-.8,2 -2,.8 -8,0 C-2,-.8 -.8,-2 0,-8 Z" fill="#ffffff" stroke="#f0c869" stroke-width="1"/></g>' +
          '</g>' +
          /* 일자 앞머리 */
          '<g id="c-bangs">' +
            '<path d="M-58,2 C-62,-36 -46,-68 -14,-76 C16,-82 48,-66 58,-30 C60,-18 60,-8 58,2 C55,-6 52,-12 48,-17 L43,-20 L36,-17 L29,-22 L22,-18 L15,-22 L8,-18 L1,-22 L-6,-18 L-13,-22 L-20,-18 L-27,-22 L-34,-17 L-41,-20 L-48,-17 C-52,-12 -55,-6 -58,2 Z" fill="' + HAIR + '"/>' +
            '<path d="M-40,-30 C-34,-48 -20,-60 -4,-64" stroke="' + HAIR_L + '" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
            '<path d="M-22,-24 C-18,-38 -8,-50 8,-56" stroke="' + HAIR_L + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
            '<path d="M18,-24 C20,-36 26,-46 34,-50" stroke="' + HAIR_L + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
          '</g>' +
        '</g>' +
      '</g>' +
    '</svg>';

  /* ---------------------------------------------------------------------
     관절 포즈
     --------------------------------------------------------------------- */
  const STAND = {
    x: DOOR_X, y: FLOOR - 42, s: 0.74, op: 0,
    pelvisY: 0, thighS: 1, spread: 17,
    armLA: 5, armRA: -5, elbowLA: -4, elbowRA: 4,
    facing: 0, bow: 0, smile: 0, kneeSplay: 0,
    gazeX: 0, gazeY: 0, eyeOpen: 1, spark: 0
  };
  const pose = Object.assign({}, STAND);
  const walk = { w: 0, phase: 0, mode: "side" };
  let blink = 1, breath = 0;
  let talkUntil = 0, nowMs = 0;   /* 말하는 동안 입을 움직입니다 */
  const R = {};

  function setT(el, value) { if (el) { el.setAttribute("transform", value); } }

  function renderChar() {
    const p = pose, f = p.facing, af = Math.abs(f), b = p.bow;
    R.root.style.transform = "translate(" + p.x + "px," + p.y + "px) scale(" + p.s + ")";
    R.root.style.opacity = p.op;

    const sinP = Math.sin(walk.phase), cosP = Math.cos(walk.phase), w = walk.w;
    const side = walk.mode === "side";
    const bob = side ? (1 - Math.abs(sinP)) * 5 * w : Math.abs(sinP) * 5 * w;
    const sway = side ? 0 : sinP * 3 * w;

    const hip = -138 + p.pelvisY - bob + breath * 0.5;
    setT(R.pelvis, "translate(0," + hip + ") rotate(" + sway * 0.5 + ")");

    /* 다리 */
    const spread = p.spread * (1 - 0.68 * af);
    const lift = function (phase) { return side ? 0 : Math.max(0, Math.sin(phase)) * 0.24 * w; };
    const swing = function (phase) { return side ? -Math.sin(phase) * 27 * w : 0; };
    const bend = function (phase) { return side ? Math.max(0, Math.cos(phase)) * 42 * w : 0; };

    [["L", walk.phase, -1], ["R", walk.phase + Math.PI, 1]].forEach(function (leg) {
      const id = leg[0], ph = leg[1], dir = leg[2];
      const ts = p.thighS - lift(ph);
      setT(R["leg" + id], "translate(" + (dir * spread) + ",6) rotate(" + (swing(ph) + dir * p.kneeSplay) + ")");
      setT(R["thigh" + id], "scale(1," + ts + ")");
      setT(R["knee" + id], "translate(0," + (62 * ts) + ") rotate(" + (bend(ph) - dir * p.kneeSplay) + ")");
      setT(R["shoe" + id], "translate(" + (f * 6) + ",0)");
    });

    /* 상체 */
    const tsy = 1 - 0.13 * b + breath * 0.004;
    const tsx = 1 - 0.14 * af;
    setT(R.torso, "scale(" + tsx + "," + tsy + ")");
    setT(R.chest, "translate(" + (f * 9) + ",0)");

    /* 팔 */
    const shX = 40 * tsx;
    const armSw = side ? Math.sin(walk.phase) * 26 * w : sinP * 7 * w;
    setT(R.armL, "translate(" + (-shX + f * 5) + "," + (-78 * tsy) + ") rotate(" + (p.armLA + armSw) + ")");
    setT(R.armR, "translate(" + (shX + f * 2) + "," + (-78 * tsy) + ") rotate(" + (p.armRA - armSw) + ")");
    setT(R.elbowL, "translate(0,48) rotate(" + (p.elbowLA - (side ? 14 * w : 0)) + ")");
    setT(R.elbowR, "translate(0,48) rotate(" + (p.elbowRA - (side ? 14 * w : 0)) + ")");

    /* 머리 */
    const headY = -90 * tsy - 53 + b * 40;
    const headS = 1 + 0.05 * b;
    setT(R.head, "translate(" + (f * 4) + "," + headY + ") scale(" + headS + ")");
    setT(R.hairBack, "translate(" + (-f * 5) + "," + (b * 1) + ")");
    setT(R.features, "translate(" + (f * 9) + "," + (b * 12) + ") scale(1," + (1 - 0.14 * b) + ")");
    setT(R.bangs, "translate(" + (f * 3) + "," + (b * 9) + ")");
    setT(R.earL, "translate(" + (f > 0 ? f * 9 : f * 3) + ",0)");
    setT(R.earR, "translate(" + (f > 0 ? f * 3 : f * 9) + ",0)");
    R.earR.setAttribute("opacity", f > 0 ? 1 - f : 1);
    R.earL.setAttribute("opacity", f < 0 ? 1 + f : 1);

    /* 표정 */
    const talk = nowMs < talkUntil ? Math.abs(Math.sin(nowMs / 95)) : 0;
    const mouth = nowMs < talkUntil ? talk : p.smile;
    R.mouthClosed.setAttribute("opacity", 1 - mouth);
    R.mouthSmile.setAttribute("opacity", mouth);
    const e = Math.max(0.08, blink * (1 - 0.18 * p.smile) * p.eyeOpen);
    setT(R.pupilL, "translate(" + p.gazeX + "," + p.gazeY + ")");
    setT(R.pupilR, "translate(" + p.gazeX + "," + p.gazeY + ")");
    const sp = 0.4 + 0.6 * p.spark;
    R.sparkR.setAttribute("opacity", p.spark);
    R.sparkL.setAttribute("opacity", p.spark);
    setT(R.sparkR, "translate(49,-13) scale(" + sp + ") rotate(" + (p.spark * 60) + ")");
    setT(R.sparkL, "translate(-49,-15) scale(" + sp + ") rotate(" + (-p.spark * 60) + ")");
    setT(R.eyeL, "translate(-25,7) scale(1," + e + ")");
    setT(R.eyeR, "translate(25,7) scale(1," + e + ")");

    /* 그림자 */
    setT(R.shadow, "scale(" + (1 - 0.12 * (bob / 5)) + ",1)");
  }

  /* ---------------------------------------------------------------------
     시간 관리
     --------------------------------------------------------------------- */
  const EASE = {
    linear: function (t) { return t; },
    inOut: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    in: function (t) { return t * t * t; },
    back: function (t) { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  };

  let runToken = 0;
  const SKIPPED = { skipped: true };
  let active = [];
  let rafOn = false;

  function loop(now) {
    /* 숨쉬기 + 눈 깜빡임 */
    nowMs = now;
    breath = Math.sin(now / 900);
    const cycle = now % 3800;
    blink = cycle < 110 ? Math.abs(cycle - 55) / 55 : 1;
    if (walk.w > 0) { walk.phase += walk.speed / 60; }

    active = active.filter(function (t) {
      if (t.token !== runToken) { t.reject(SKIPPED); return false; }
      if (t.start == null) { t.start = now; }
      const raw = t.dur <= 0 ? 1 : Math.min(1, (now - t.start) / t.dur);
      t.fn(t.ease(raw));
      if (raw >= 1) { t.resolve(); return false; }
      return true;
    });

    renderChar();
    window.requestAnimationFrame(loop);
  }

  function tween(dur, ease, fn) {
    const token = runToken;
    const p = new Promise(function (resolve, reject) {
      active.push({ dur: dur, ease: EASE[ease] || EASE.inOut, fn: fn, resolve: resolve, reject: reject, token: token });
    });
    p.catch(function () {});
    return p;
  }
  const wait = function (ms) { return tween(ms, "linear", function () {}); };
  const all = function () { return Promise.all(Array.prototype.slice.call(arguments)); };

  /* 포즈를 부드럽게 바꾸기 */
  function poseTo(target, dur, ease) {
    const from = {};
    Object.keys(target).forEach(function (k) { from[k] = pose[k]; });
    return tween(dur, ease || "inOut", function (t) {
      Object.keys(target).forEach(function (k) { pose[k] = from[k] + (target[k] - from[k]) * t; });
    });
  }

  function walkOn(mode, speed) {
    walk.mode = mode; walk.speed = speed; walk.phase = 0;
    return tween(180, "out", function (t) { walk.w = t; });
  }
  function walkOff() {
    return tween(200, "inOut", function (t) { walk.w = 1 - t; });
  }

  /* ---------------------------------------------------------------------
     카메라
     --------------------------------------------------------------------- */
  const cam = { cx: DOOR_X, cy: 450, z: 1, tilt: 0, roll: 0 };

  function vw() { return window.innerWidth; }
  function vh() { return window.innerHeight; }

  /* 세로로 긴 화면(휴대폰)에서는 바닥을 화면 아래쪽으로 내려 빈 공간을 줄입니다 */
  function floorCY(z) {
    const ratio = vh() > vw() * 1.2 ? 0.72 : 0;
    return ratio ? FLOOR - (ratio - 0.5) * vh() / z : 440;
  }

  const SHOT = {
    /* 문만 보이는 첫 화면 */
    door: function () {
      const z = Math.min(vh() / 680, vw() / 400, 1.6);
      return { cx: DOOR_X, cy: 425, z: z };
    },
    /* 문에서 나오는 캐릭터를 가운데에 둔 화면 */
    wide: function () {
      const z = Math.min(vh() / 640, vw() / 600, 1.5);
      return { cx: DOOR_X, cy: floorCY(z), z: z };
    },
    /* 의자에 앉은 캐릭터가 가운데 */
    seat: function () {
      const z = Math.min(vh() / 640, vw() / 600, 1.5);
      return { cx: CHAIR_X, cy: floorCY(z), z: z };
    },
    /* 눈을 마주치는 얼굴 클로즈업 */
    face: function () {
      const z = Math.min(vh() / 400, vw() / 300, 2.7);
      return { cx: CHAIR_X, cy: 470, z: z };
    },
    /* 말풍선을 화면 가운데 두고, 캐릭터는 그 옆(휴대폰은 아래)에 흐리게 */
    speech: function () {
      if (vw() >= 900) {
        const z = Math.min(vh() / 640, 1.25);
        const gap = (vw() - Math.min(760, vw() - 300)) / 2;
        const sx = Math.max(gap / 2, 80), sy = vh() * 0.6;
        return { cx: CHAIR_X + (vw() / 2 - sx) / z, cy: 540 - (sy - vh() / 2) / z, z: z };
      }
      const z = Math.min(vh() / 900, vw() / 480, 1);
      return { cx: CHAIR_X, cy: 470 - (vh() * 0.34) / z, z: z };
    },
    /* 이력서 뒤로 흐리게 보이는 화면: 앉아 있는 캐릭터가 왼쪽 빈 공간에 걸리게 */
    final: function () {
      const z = Math.min(vh() / 620, vw() / 720, 1.4);
      const gap = (vw() - Math.min(900, vw() - 180) - 122) / 2;   /* 종이 왼쪽 빈 공간 */
      const screenX = gap > 120 ? gap / 2 : vw() / 2;
      return { cx: CHAIR_X + (vw() / 2 - screenX) / z, cy: floorCY(z), z: z };
    }
  };

  function renderCam() {
    const tx = vw() / 2 - cam.cx * cam.z;
    const ty = vh() / 2 - cam.cy * cam.z - cam.tilt * vh();
    R.room.style.transform =
      "translate(" + tx + "px," + ty + "px) scale(" + cam.z + ")";
  }

  function camTo(shot, dur, ease, extra) {
    const to = Object.assign({}, typeof shot === "string" ? SHOT[shot]() : shot, extra || {});
    const from = {};
    Object.keys(to).forEach(function (k) { from[k] = cam[k]; });
    return tween(dur, ease || "inOut", function (t) {
      Object.keys(to).forEach(function (k) { cam[k] = from[k] + (to[k] - from[k]) * t; });
      renderCam();
    });
  }

  /* 이력서: 0 = 화면 아래, 1 = 책상 위에 누움, 2 = 일어서서 정면 */
  function renderSheet(v) {
    const flat = Math.min(1, v), up = Math.max(0, v - 1);
    const y = (135 - 135 * flat) + (flatRest() * (1 - up));
    const rot = 64 * (1 - up);
    const sc = deskScale() + (1 - deskScale()) * up;
    const skew = -3 * (1 - up);
    R.sheet.style.transform =
      "translateY(" + y + "dvh) rotateX(" + rot + "deg) rotateZ(" + skew + "deg) scale(" + sc + ")";
  }
  function flatRest() { return vw() < 820 ? 20 : 24; }
  function deskScale() { return vw() < 820 ? 0.72 : 0.56; }

  /* 책상: tilt 값(0=숨김, 1=크게 보임, final=조금만 보임) */
  function renderDesk(v) {
    R.desk.style.transform = "translateY(calc(" + (100 - v * 100) + "% + " + (14 * (1 - v)) + "px))";
  }

  /* ---------------------------------------------------------------------
     말풍선
     --------------------------------------------------------------------- */
  function typeText(el, text, dur) {
    el.textContent = "";
    const chars = Array.from(text);
    return tween(dur, "linear", function (t) {
      el.textContent = chars.slice(0, Math.round(chars.length * t)).join("");
    });
  }

  /* ---------------------------------------------------------------------
     상태 맞추기 (건너뛰기 · 바로가기 · 처음으로)
     --------------------------------------------------------------------- */
  let state = "door";   /* door | playing | desk */
  let doc = "resume";
  let swapSeq = 0;
  let opts = {};

  function setState(next) {
    state = next;
    R.scene.setAttribute("data-state", next);
  }

  function setDoorGone(gone) {
    R.door.classList.toggle("gone", gone);
    R.light.style.display = gone ? "none" : "";
  }

  function setDoorOpen(v) {
    R.panel.style.transform = "perspective(1000px) rotateY(" + (-112 * v) + "deg)";
    R.light.style.opacity = v;
    R.hole.style.opacity = v > 0.001 ? 1 : 0;
  }

  function setWorld(blur) {
    R.world.style.filter = blur > 0.01 ? "blur(" + blur + "px)" : "none";
  }

  function hideBubbles() {
    R.greet.classList.remove("on");
    R.judge.classList.remove("on");
    R.speech.classList.remove("on");
    R.sceneBtns.classList.remove("on");
  }

  function placeDoor() {
    Object.assign(pose, STAND);
    walk.w = 0;
    talkUntil = 0;
    setDoorGone(false);
    setDoorOpen(0);
    Object.assign(cam, SHOT.door(), { tilt: 0 });
    renderCam();
    renderDesk(0);
    setWorld(0);
    R.chair.classList.remove("on");
    R.viewer.classList.remove("on");
    R.notes.classList.remove("on");
    R.sheet.style.transform = "";
    R.tablet.style.transform = "";
    R.hint.classList.remove("off");
    hideBubbles();
  }

  function placeDesk() {
    Object.assign(pose, STAND, seatedPose(), { x: CHAIR_X, y: FLOOR, s: 1, op: 1, facing: 0, bow: 0, smile: 0 });
    walk.w = 0;
    talkUntil = 0;
    setDoorOpen(0);
    setDoorGone(true);
    Object.assign(cam, SHOT.final(), { tilt: 0 });
    renderCam();
    renderDesk(0.2);
    setWorld(7);
    R.chair.classList.add("on");
    R.hint.classList.add("off");
    hideBubbles();
    R.viewer.classList.add("on");
    R.notes.classList.add("on");
    R.sheet.style.transform = "";
    R.tablet.style.transform = "";
  }

  function seatedPose() {
    return {
      pelvisY: 46, thighS: 0.2, spread: 22, kneeSplay: 0,
      armLA: 11, armRA: -11, elbowLA: -24, elbowRA: 24
    };
  }

  /* 어떤 문서를 보여줄지 (이력서 / 자기소개서 는 종이, 포트폴리오는 태블릿) */
  function applyDoc(name) {
    doc = name;
    R.viewer.setAttribute("data-doc", name);
    ["resume", "cover"].forEach(function (n) { $("page-" + n).hidden = n !== name; });
    $("page-portfolio").hidden = name !== "portfolio";
    R.sheet.classList.toggle("is-away", name === "portfolio");
    R.tablet.classList.toggle("is-away", name !== "portfolio");
    Array.prototype.forEach.call(R.notes.querySelectorAll(".note"), function (b) {
      const on = b.getAttribute("data-doc") === name;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-current", on ? "true" : "false");
    });
  }

  function scrollTop() {
    R.sheetScroll.scrollTop = 0;
    R.tabletScroll.scrollTop = 0;
  }

  function playAnim(el, frames, dur, ease) {
    if (reduced() || !el.animate) { return Promise.resolve(); }
    return el.animate(frames, { duration: dur, easing: ease || "cubic-bezier(.3,.7,.2,1)", fill: "both" }).finished
      .then(function (anim) { return anim; })
      .catch(function () {});
  }
  function clearAnims(el) {
    if (el.getAnimations) { el.getAnimations().forEach(function (a) { a.cancel(); }); }
  }

  const AWAY = "translateY(115dvh) rotateX(24deg)";

  /* 포스트잇을 눌렀을 때의 전환 */
  async function swapDoc(name) {
    if (name === doc) { return; }
    const seq = ++swapSeq;
    const prev = doc;
    const wasTablet = prev === "portfolio", toTablet = name === "portfolio";

    if (wasTablet !== toTablet) {
      const out = wasTablet ? R.tablet : R.sheet;
      const inn = toTablet ? R.tablet : R.sheet;
      clearAnims(out); clearAnims(inn);
      applyDoc(name);
      scrollTop();
      inn.classList.remove("is-away");
      out.classList.remove("is-away");
      const a = playAnim(out, [{ transform: "none" }, { transform: AWAY }], 460, "cubic-bezier(.5,0,.8,.5)");
      const b = playAnim(inn, [{ transform: AWAY }, { transform: "none" }], 620, "cubic-bezier(.2,.8,.2,1)");
      await all(a, b).catch(function () {});
      if (seq !== swapSeq) { return; }
      clearAnims(out); clearAnims(inn);
      out.classList.add("is-away");
      return;
    }

    /* 종이 → 종이: 윗장을 옆으로 넘기고 새 장을 올립니다 */
    clearAnims(R.sheet);
    await playAnim(R.sheet, [
      { transform: "none", opacity: 1 },
      { transform: "translate(-7%,16px) rotate(-3.5deg)", opacity: 0 }
    ], 190, "ease-in");
    if (seq !== swapSeq) { return; }
    applyDoc(name);
    scrollTop();
    await playAnim(R.sheet, [
      { transform: "translateY(46px) rotate(1.6deg)", opacity: 0 },
      { transform: "none", opacity: 1 }
    ], 300);
    if (seq !== swapSeq) { return; }
    clearAnims(R.sheet);
  }

  /* ---------------------------------------------------------------------
     연출 전체 순서  (시간 단위: 1000 = 1초)
     --------------------------------------------------------------------- */
  async function play() {
    if (state !== "door") { return; }
    if (reduced()) { finish(); return; }
    runToken++;
    setState("playing");
    const intro = opts.intro || {};
    R.hint.classList.add("off");

    try {
      /* 1) 면접관의 말: 들어오세요 → 문이 열립니다 */
      R.judgeText.textContent = intro.comeIn || "들어오세요";
      R.judge.classList.add("on");
      await wait(650);
      await all(
        tween(1000, "inOut", setDoorOpen),
        camTo("wide", 1300)
      );

      /* 2) 캐릭터가 문 안쪽에서 앞으로 걸어 나옵니다 */
      pose.op = 1;
      walkOn("front", 8);
      await all(
        poseTo({ y: FLOOR, s: 1 }, 1300, "linear"),
        wait(0)
      );
      await walkOff();

      /* 3) 문이 닫히며 사라지고, 앞에 의자가 생깁니다 */
      R.judge.classList.remove("on");
      await tween(460, "inOut", function (t) { setDoorOpen(1 - t); });
      setDoorGone(true);
      await wait(260);
      R.chair.classList.add("on");
      await wait(520);

      /* 4) 옆으로 돌아 의자 옆까지 걸어갑니다 (카메라가 따라가 캐릭터는 늘 가운데) */
      await poseTo({ facing: 1 }, 220);
      walkOn("side", 8.4);
      await all(poseTo({ x: BESIDE_X }, 1150, "linear"), camTo({ cx: BESIDE_X }, 1150, "linear"));
      await walkOff();
      await poseTo({ facing: 0 }, 260);
      await wait(180);

      /* 5) 인사 + 말풍선 */
      R.greet.classList.add("on");
      R.greetText.textContent = "";
      await all(
        poseTo({ armLA: 13, armRA: -13, elbowLA: -24, elbowRA: 24 }, 260),
        wait(0)
      );
      const typing = typeText(R.greetText, intro.greeting || "", 1250);
      await poseTo({ bow: 1 }, 520);
      await wait(620);
      await poseTo({ bow: 0, smile: 1, armLA: 5, armRA: -5, elbowLA: -4, elbowRA: 4 }, 560);
      await typing;
      await wait(1500);

      /* 6) 면접관(보는 사람)의 말: 앉으세요 */
      R.greet.classList.remove("on");
      await poseTo({ smile: 0 }, 220);
      R.judgeText.textContent = intro.sitDown || "";
      R.judge.classList.add("on");
      await wait(850);

      /* 7) 의자 앞으로 가서 앉습니다 */
      await poseTo({ facing: 1 }, 180);
      walkOn("side", 8.4);
      await all(poseTo({ x: CHAIR_X }, 620, "linear"), camTo({ cx: CHAIR_X }, 620, "linear"));
      await walkOff();
      await poseTo({ facing: 0 }, 180);
      await poseTo(seatedPose(), 620);
      await wait(500);
      R.judge.classList.remove("on");
      await wait(240);

      /* 8) 카메라가 아래로 내려가 책상 위 이력서를 비춥니다 */
      R.viewer.classList.add("on");
      R.sheet.classList.add("is-flat");
      renderSheet(0);
      await tween(1250, "inOut", function (t) {
        cam.tilt = 0.56 * t;
        renderCam();
        renderDesk(t);
        renderSheet(t);
      });
      await wait(420);

      /* 9) 이력서가 올라오고 카메라도 함께 올라갑니다. 뒤는 흐려집니다 */
      const camFrom = { cx: cam.cx, cy: cam.cy, z: cam.z };
      const camEnd = SHOT.final();
      await tween(1450, "inOut", function (t) {
        cam.tilt = 0.56 * (1 - t);
        cam.cx = camFrom.cx + (camEnd.cx - camFrom.cx) * t;
        cam.cy = camFrom.cy + (camEnd.cy - camFrom.cy) * t;
        cam.z = camFrom.z + (camEnd.z - camFrom.z) * t;
        renderCam();
        renderDesk(1 - 0.8 * t);
        renderSheet(1 + t);
        setWorld(7 * t);
      });
      R.sheet.classList.remove("is-flat");
      R.sheet.style.transform = "";

      /* 10) 포스트잇이 붙습니다 */
      R.notes.classList.add("on");
      setState("desk");
      opts.onReady && opts.onReady();
      R.sheetScroll.focus({ preventScroll: true });
    } catch (err) {
      if (err !== SKIPPED) { throw err; }
    }
  }

  /* ---------------------------------------------------------------------
     자기소개 장면
     면접관의 말 → 눈 마주침 → 말풍선이 화면 가운데로 → 큰 제목은 한 글자씩,
     문단은 한 번에. 누를 때마다 '연출 건너뛰기 → 다음 문단' 순서로 진행합니다.
     --------------------------------------------------------------------- */
  const cv = { data: [], s: 0, p: 0, phase: "", seq: 0, skipIntro: false };
  const SWEEP_MS = 420, TITLE_CHAR_MS = 75;

  function setSceneBlur(from, to) {
    return tween(800, "inOut", function (t) { setWorld(from + (to - from) * t); });
  }

  function paraCountBefore(sec) {
    let n = 0;
    for (let i = 0; i < sec; i++) { n += cv.data[i].paras.length; }
    return n;
  }

  function coverMeta() {
    const sec = cv.data[cv.s];
    const no = function (n) { return (n < 10 ? "0" : "") + n; };
    R.speechNo.textContent = no(cv.s + 1) + " / " + no(cv.data.length);
    R.speechDots.innerHTML = sec.paras.map(function (_, i) {
      return '<i class="' + (i <= cv.p ? "is-on" : "") + '"></i>';
    }).join("");
    R.speechPrev.hidden = cv.s === 0 && cv.p === 0;
    const last = cv.s === cv.data.length - 1 && cv.p === sec.paras.length - 1;
    R.speechHint.textContent = last ? "자기소개가 끝났습니다" : "클릭하면 다음 문단";
    R.speech.classList.toggle("is-last", last);
  }

  function coverReveal(seq, animate) {
    const sec = cv.data[cv.s];
    R.speechBody.innerHTML = '<p>' + sec.paras[cv.p] + '</p>';
    R.speechBody.scrollTop = 0;
    talkUntil = performance.now() + Math.min(2600, 700 + R.speechBody.textContent.length * 9);
    R.speechBody.classList.remove("sweep");
    if (!animate) { cv.phase = "idle"; R.speech.classList.add("is-idle"); return; }
    void R.speechBody.offsetWidth;   /* 애니메이션을 처음부터 다시 재생 */
    R.speechBody.classList.add("sweep");
    cv.phase = "body";
    wait(SWEEP_MS).then(function () {
      if (seq === cv.seq) { cv.phase = "idle"; R.speech.classList.add("is-idle"); }
    }, function () {});
  }

  function coverShow(sec, para, typeTitle) {
    cv.s = sec; cv.p = para;
    const seq = ++cv.seq;
    const title = cv.data[sec].title || "";
    coverMeta();
    R.speech.classList.remove("is-idle");
    R.speechBody.innerHTML = "";
    R.speechTitle.setAttribute("aria-label", title);

    if (!typeTitle || reduced()) {
      R.speechTitle.textContent = title;
      coverReveal(seq, !reduced());
      return;
    }
    cv.phase = "title";
    R.speechTitle.textContent = "";
    const chars = Array.from(title);
    talkUntil = performance.now() + chars.length * TITLE_CHAR_MS + 200;
    tween(chars.length * TITLE_CHAR_MS, "linear", function (t) {
      if (seq === cv.seq) { R.speechTitle.textContent = chars.slice(0, Math.round(chars.length * t)).join(""); }
    }).then(function () {
      if (seq === cv.seq) { coverReveal(seq, true); }
    }, function () {});
  }

  /* 다음 / 이전 문단 */
  function coverStep(dir) {
    let s = cv.s, p = cv.p + dir;
    if (p >= cv.data[s].paras.length) {
      if (s >= cv.data.length - 1) { return; }
      coverShow(s + 1, 0, true);
      return;
    }
    if (p < 0) {
      if (s === 0) { return; }
      s -= 1;
      p = cv.data[s].paras.length - 1;
      coverShow(s, p, false);
      return;
    }
    coverShow(s, p, false);
  }

  /* 화면을 눌렀을 때 */
  function coverTap() {
    if (state !== "cover") { return; }
    if (cv.phase === "intro") {
      cv.skipIntro = true;
      runToken++;
      return;
    }
    if (cv.phase === "title" || cv.phase === "body") {
      /* 연출 건너뛰기: 제목과 문단을 바로 다 보여줍니다 */
      const seq = ++cv.seq;
      R.speechTitle.textContent = cv.data[cv.s].title || "";
      coverReveal(seq, false);
      return;
    }
    coverStep(1);
  }

  /* 말풍선 무대를 세웁니다 */
  function coverStage() {
    R.viewer.classList.remove("on");
    R.judge.classList.remove("on");
    Object.assign(pose, { gazeX: 0, gazeY: 0, eyeOpen: 1, spark: 0, bow: 0, smile: 0 });
    R.speech.classList.add("on");
    R.sceneBtns.classList.add("on");
    if (reduced()) {
      Object.assign(cam, SHOT.speech());
      renderCam();
      setWorld(7);
    } else {
      camTo("speech", 850);
      setSceneBlur(0, 7);
    }
    R.speechTitle.textContent = "";
    R.speechBody.innerHTML = "";
    coverShow(0, 0, true);
  }

  async function coverScene() {
    const data = opts.getCover ? opts.getCover() : [];
    if (!data.length) { swapDoc("cover"); return; }

    runToken++;
    setState("cover");
    cv.data = data; cv.phase = "intro"; cv.skipIntro = false;
    const out = doc === "portfolio" ? R.tablet : R.sheet;
    clearAnims(R.sheet); clearAnims(R.tablet);
    R.notes.classList.remove("on");
    const intro = opts.intro || {};
    R.judgeText.textContent = intro.coverCue || "자기소개 시작하세요";

    if (reduced()) {
      renderDesk(0);
      coverStage();
      return;
    }

    try {
      /* 서류가 내려가고 캐릭터를 비춥니다 */
      playAnim(out, [{ transform: "none" }, { transform: AWAY }], 420, "cubic-bezier(.5,0,.8,.5)");
      Object.assign(pose, { gazeX: -3, gazeY: 2.6, smile: 0 });
      await all(
        camTo("seat", 800),
        setSceneBlur(7, 0),
        tween(800, "inOut", function (t) { renderDesk(0.2 * (1 - t)); })
      );
      R.viewer.classList.remove("on");
      clearAnims(out);

      /* 면접관의 말 */
      R.judge.classList.add("on");
      await wait(800);

      /* 고개를 들어 눈을 마주칩니다 */
      await camTo("face", 700);
      await poseTo({ eyeOpen: 0.1 }, 90);
      Object.assign(pose, { gazeX: 0, gazeY: 0 });
      await poseTo({ eyeOpen: 1.18, spark: 1, smile: 0.35 }, 240, "back");
      await wait(620);
      await poseTo({ spark: 0, eyeOpen: 1, smile: 0 }, 260);
      await poseTo({ bow: 0.3 }, 200);
      await poseTo({ bow: 0 }, 240);

      cv.phase = "stage";
      coverStage();
    } catch (err) {
      if (err !== SKIPPED) { throw err; }
      if (state === "cover" && cv.skipIntro) {
        clearAnims(out);
        renderDesk(0);
        cv.phase = "stage";
        coverStage();
      }
    }
  }

  /* 자기소개 장면에서 다른 문서로 */
  async function leaveCover(name) {
    runToken++;
    cv.seq++;
    setState("moving");
    talkUntil = 0;
    hideBubbles();
    applyDoc(name);
    scrollTop();
    const from = { cx: cam.cx, cy: cam.cy, z: cam.z, blur: 7 };
    const to = SHOT.final();
    const inn = name === "portfolio" ? R.tablet : R.sheet;
    clearAnims(R.sheet); clearAnims(R.tablet);
    R.viewer.classList.add("on");
    playAnim(inn, [{ transform: AWAY }, { transform: "none" }], 700, "cubic-bezier(.2,.8,.2,1)");
    try {
      await tween(reduced() ? 0 : 700, "inOut", function (t) {
        cam.cx = from.cx + (to.cx - from.cx) * t;
        cam.cy = from.cy + (to.cy - from.cy) * t;
        cam.z = from.z + (to.z - from.z) * t;
        renderCam();
        renderDesk(0.2 * t);
        setWorld(7);
      });
    } catch (err) {
      if (err !== SKIPPED) { throw err; }
      return;
    }
    clearAnims(inn);
    Object.assign(pose, { gazeX: 0, gazeY: 0, eyeOpen: 1, spark: 0, bow: 0, smile: 0 });
    R.notes.classList.add("on");
    setState("desk");
    opts.onReady && opts.onReady();
    R.sheetScroll.focus({ preventScroll: true });
  }

  /* 건너뛰기: 곧바로 책상 화면으로 */
  function finish(name) {
    runToken++;
    clearAnims(R.sheet); clearAnims(R.tablet);
    R.sheet.classList.remove("is-flat");
    placeDesk();
    applyDoc(name || doc || "resume");
    setState("desk");
    opts.onReady && opts.onReady();
    R.sheetScroll.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------------
     바깥(index.html)에서 부르는 함수
     --------------------------------------------------------------------- */
  function toDoor() {
    runToken++;
    clearAnims(R.sheet); clearAnims(R.tablet);
    R.sheet.classList.remove("is-flat");
    applyDoc("resume");
    placeDoor();
    setState("door");
    scrollTop();
  }

  function isEditing() { return !!(opts.isEditing && opts.isEditing()); }

  function toDoc(name) {
    const speech = name === "cover" && !isEditing();
    if (state === "cover") {
      if (!speech) { leaveCover(name); }
      return;
    }
    if (state === "desk") {
      if (speech) { coverScene(); } else { swapDoc(name); }
      return;
    }
    /* 문 앞이나 연출 도중에 바로가기로 들어온 경우 */
    finish(speech ? "resume" : name);
    if (speech) { coverScene(); }
  }

  /* 수정 모드: 글 전체를 고칠 수 있도록 자기소개서를 종이로 보여줍니다 */
  function editingChanged() {
    if (isEditing()) {
      if (state === "cover") { leaveCover("cover"); }
    } else if (state === "desk" && doc === "cover") {
      coverScene();
    }
  }

  function init(options) {
    opts = options || {};
    const intro = opts.intro || {};

    ["scene", "world", "room", "desk", "door", "panel", "hole", "light", "chair", "hint", "viewer",
     "sheet", "tablet", "notes", "judge"].forEach(function (k) { R[k] = $("iv-" + k); });
    R.sheetScroll = $("iv-sheetScroll");
    R.tabletScroll = $("iv-tabletScroll");
    R.greet = $("iv-greet");
    R.greetText = $("iv-greetText");
    R.judgeText = $("iv-judgeText");
    R.speech = $("iv-speech");
    R.speechNo = $("iv-speechNo");
    R.speechDots = $("iv-speechDots");
    R.speechTitle = $("iv-speechTitle");
    R.speechBody = $("iv-speechBody");
    R.speechHint = $("iv-speechHint");
    R.speechPrev = $("iv-speechPrev");
    R.sceneBtns = $("iv-sceneBtns");
    R.tap = $("iv-tap");

    R.root = $("iv-char");
    R.root.innerHTML = characterSVG;
    ["pelvis", "torso", "chest", "head", "hairBack", "features", "bangs", "earL", "earR", "mouthClosed",
     "mouthSmile", "eyeL", "eyeR", "shadow", "legL", "legR", "thighL", "thighR", "kneeL", "kneeR",
     "shoeL", "shoeR", "armL", "armR", "elbowL", "elbowR", "pupilL", "pupilR", "sparkL", "sparkR"].forEach(function (k) { R[k] = $("c-" + k); });

    $("iv-hintText").textContent = intro.doorHint || "문을 클릭하세요!";
    R.door.setAttribute("aria-label", intro.doorHint || "문을 클릭하세요!");
    R.door.addEventListener("click", play);

    $("iv-skip").addEventListener("click", function () { finish("resume"); });
    $("iv-again").addEventListener("click", function () { opts.onDoor && opts.onDoor(); });

    Array.prototype.forEach.call(document.querySelectorAll(".note"), function (b) {
      b.addEventListener("click", function () { opts.onDoc && opts.onDoc(b.getAttribute("data-doc")); });
    });

    /* 자기소개 장면: 화면이나 말풍선을 누르면 진행, 이전 버튼으로 되돌아가기 */
    R.tap.addEventListener("click", coverTap);
    R.speech.addEventListener("click", function (e) {
      if (e.target.closest("button, a")) { return; }
      const sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length) { return; }   /* 글자를 드래그해 고르는 중이면 넘기지 않습니다 */
      coverTap();
    });
    R.speechPrev.addEventListener("click", function () {
      if (state !== "cover" || cv.phase === "intro") { return; }
      coverStep(-1);
    });
    document.addEventListener("keydown", function (e) {
      if (state !== "cover" || e.defaultPrevented) { return; }
      if (e.target.closest && e.target.closest("button, a, input")) { return; }
      if (!$("loginModal").hidden) { return; }
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        coverTap();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (cv.phase !== "intro") { coverStep(-1); }
      }
    });

    window.addEventListener("resize", function () {
      if (state === "door") { Object.assign(cam, SHOT.door()); renderCam(); }
      if (state === "desk") { Object.assign(cam, SHOT.final()); renderCam(); }
      if (state === "cover" && cv.phase !== "intro") { Object.assign(cam, SHOT.speech()); renderCam(); }
    });

    window.requestAnimationFrame(loop);
    renderChar();
    toDoor();
  }

  window.Interview = {
    init: init,
    toDoor: toDoor,
    toDoc: toDoc,
    editingChanged: editingChanged,
    state: function () { return state; }
  };
})();
