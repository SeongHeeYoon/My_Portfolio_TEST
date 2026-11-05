/* ============================================================================
 *  interview.js — '면접실' 연출
 *  문 → 등장 → 인사 → 착석 → 책상 위 이력서 → 포스트잇 / 태블릿
 *
 *  문구는 data.js 의 intro 에서 바꿉니다.
 *  연출 순서와 시간은 아래 play() 함수 한 곳에 모여 있습니다.
 *  캐릭터는 images/char 의 그림을 프레임처럼 바꿔 가며 움직입니다.
 * ========================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     방 안의 위치 (단위: 가상 좌표. 화면 크기에 맞춰 카메라가 확대·축소합니다)
     --------------------------------------------------------------------- */
  const FLOOR = 700;      /* 바닥 높이 */
  const DOOR_X = 560;     /* 문 가운데 */
  const BESIDE_X = 760;   /* 의자 옆에 서는 자리 */
  const CHAIR_X = 915;    /* 의자 가운데 */

  const $ = function (id) { return document.getElementById(id); };
  const reduced = function () {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  /* ---------------------------------------------------------------------
     캐릭터 프레임
     h 는 방 안에서의 키입니다. 그림을 바꿀 때 이 값으로 크기를 맞춥니다.
     --------------------------------------------------------------------- */
  const FRAMES = {
    stand: 400, smile: 400, bow: 392, sit: 340,
    walk_side1: 400, walk_side2: 400, walk_side3: 400, walk_side4: 400,
    walk_front1: 400, walk_front2: 400
  };
  const WALKS = {
    side: { frames: ["walk_side1", "walk_side2", "walk_side3", "walk_side4"], ms: 135 },
    front: { frames: ["walk_front1", "walk_front2"], ms: 210 }
  };

  const STAND = { x: DOOR_X, y: FLOOR - 42, s: 0.74, op: 0, squash: 1 };
  const pose = Object.assign({}, STAND);
  const walk = { on: false, frames: [], ms: 150, start: 0 };
  let breath = 0, talkUntil = 0, nowMs = 0;
  let frameNow = "";
  const R = {};

  function setFrame(name, fadeMs) {
    if (name === frameNow) { return; }
    const next = R.frames[name];
    const prev = R.frames[frameNow];
    const t = (fadeMs || 0) + "ms";
    next.style.transitionDuration = t;
    next.classList.add("on");
    if (prev) { prev.style.transitionDuration = t; prev.classList.remove("on"); }
    frameNow = name;
  }

  function renderChar() {
    if (walk.on) {
      const i = Math.floor((nowMs - walk.start) / walk.ms) % walk.frames.length;
      setFrame(walk.frames[i], 0);
    }
    const stepPhase = walk.on ? (nowMs - walk.start) / walk.ms : 0;
    const bob = walk.on ? Math.abs(Math.sin(stepPhase * Math.PI)) * 5 : 0;
    const talk = nowMs < talkUntil ? Math.abs(Math.sin(nowMs / 150)) * 2 : 0;
    R.root.style.transform = "translate(" + pose.x + "px," + pose.y + "px) scale(" + pose.s + ")";
    R.root.style.opacity = pose.op;
    R.charBody.style.transform =
      "translateY(" + (-bob - talk) + "px) scale(1," + (pose.squash * (1 + breath * 0.004)) + ")";
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
    /* 숨쉬기 */
    nowMs = now;
    breath = Math.sin(now / 900);

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

  function walkOn(mode) {
    walk.frames = WALKS[mode].frames;
    walk.ms = WALKS[mode].ms;
    walk.start = nowMs;
    walk.on = true;
  }
  function walkOff() {
    walk.on = false;
    setFrame("stand", 90);
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
      return { cx: CHAIR_X, cy: 430, z: z };
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
      return { cx: CHAIR_X, cy: 430 - (vh() * 0.34) / z, z: z };
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
    walk.on = false;
    talkUntil = 0;
    setFrame("stand", 0);
    bustOff();
    R.chair.classList.remove("sat");
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
    R.skip.classList.remove("off");
    hideBubbles();
  }

  function placeDesk() {
    Object.assign(pose, STAND, { x: CHAIR_X, y: FLOOR, s: 1, op: 1 });
    walk.on = false;
    talkUntil = 0;
    setFrame("sit", 0);
    bustOff();
    R.chair.classList.add("sat");
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

  function bustOff() {
    R.bust.classList.remove("on", "contact");
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
      walkOn("front");
      await poseTo({ y: FLOOR, s: 1 }, 1300, "linear");
      walkOff();

      /* 3) 문이 닫히며 사라지고, 앞에 의자가 생깁니다 */
      R.judge.classList.remove("on");
      await tween(460, "inOut", function (t) { setDoorOpen(1 - t); });
      setDoorGone(true);
      await wait(260);
      R.chair.classList.add("on");
      await wait(520);

      /* 4) 옆으로 돌아 의자 옆까지 걸어갑니다 (카메라가 따라가 캐릭터는 늘 가운데) */
      walkOn("side");
      await all(poseTo({ x: BESIDE_X }, 1150, "linear"), camTo({ cx: BESIDE_X }, 1150, "linear"));
      walkOff();
      await wait(240);

      /* 5) 인사 + 말풍선 */
      R.greet.classList.add("on");
      R.greetText.textContent = "";
      const typing = typeText(R.greetText, intro.greeting || "", 1250);
      setFrame("bow", 150);
      await wait(1150);
      setFrame("smile", 170);
      await typing;
      await wait(1500);

      /* 6) 면접관(보는 사람)의 말: 앉으세요 */
      R.greet.classList.remove("on");
      setFrame("stand", 170);
      R.judgeText.textContent = intro.sitDown || "";
      R.judge.classList.add("on");
      await wait(850);

      /* 7) 의자 앞으로 가서 앉습니다 */
      walkOn("side");
      await all(poseTo({ x: CHAIR_X }, 620, "linear"), camTo({ cx: CHAIR_X }, 620, "linear"));
      walkOff();
      await wait(120);
      await poseTo({ squash: 0.95 }, 110);
      setFrame("sit", 240);
      R.chair.classList.add("sat");
      await poseTo({ squash: 1 }, 240);
      await wait(620);
      R.judge.classList.remove("on");
      await wait(240);

      /* 8) 카메라가 아래로 내려가 책상 위 이력서를 비춥니다 */
      R.skip.classList.add("off");   /* 이력서가 놓이는 자리와 겹치지 않게 */
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
    bustOff();
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

      /* 얼굴을 크게 비추고, 시선을 들어 눈을 마주칩니다 */
      camTo("face", 620);
      R.bust.classList.add("on");
      await wait(900);
      R.bust.classList.add("contact");
      await wait(1150);

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
    R.skip = $("iv-skip");
    R.speech = $("iv-speech");
    R.speechNo = $("iv-speechNo");
    R.speechDots = $("iv-speechDots");
    R.speechTitle = $("iv-speechTitle");
    R.speechBody = $("iv-speechBody");
    R.speechHint = $("iv-speechHint");
    R.speechPrev = $("iv-speechPrev");
    R.sceneBtns = $("iv-sceneBtns");
    R.tap = $("iv-tap");

    R.bust = $("iv-bust");
    R.root = $("iv-char");
    R.root.innerHTML = '<div class="char__shadow"></div><div class="char__body" id="iv-charBody"></div>';
    R.charBody = $("iv-charBody");
    R.frames = {};
    Object.keys(FRAMES).forEach(function (name) {
      const img = new Image();
      img.alt = "";
      img.decoding = "sync";
      img.className = "char__f";
      img.style.height = FRAMES[name] + "px";
      img.src = "images/char/" + name + ".webp";
      R.charBody.appendChild(img);
      R.frames[name] = img;
    });

    $("iv-hintText").textContent = intro.doorHint || "문을 클릭하세요!";
    R.door.setAttribute("aria-label", intro.doorHint || "문을 클릭하세요!");
    R.door.addEventListener("click", play);

    R.skip.addEventListener("click", function () { finish("resume"); });
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
