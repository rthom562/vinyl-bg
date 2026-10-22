// Vinyl BG: a turntable view for Spotify, with synced lyrics and a needle-drop scratch.
// Opens from the record button in the top-left of the Spotify window.
// https://github.com/rthom562/vinyl-bg
(function VinylDeck() {
    if (!Spicetify?.Player?.addEventListener || !Spicetify?.Topbar?.Button || !document.body) {
        setTimeout(VinylDeck, 300);
        return;
    }

    const COLOR_KEY = "vinyldeck_colors";
    const SETTINGS_KEY = "vinyldeck_settings";
    const DEFAULT_COLORS = {
        deck: "#232326", platter: "#2e2e31", record: "#111111", arm: "#d9d9d9",
        accent: "#ffffff", text: "#ffffff", led: "#ff4d3a",
    };
    const COLOR_FIELDS = [
        ["deck", "Turntable body"],
        ["platter", "Platter"],
        ["record", "Record"],
        ["arm", "Tonearm"],
        ["accent", "Accent"],
        ["text", "Text & icons"],
        ["led", "Power light"],
    ];
    const PRESETS = {
        Classic: DEFAULT_COLORS,
        Walnut: { deck: "#5b3a24", platter: "#2a2a2a", record: "#111111", arm: "#e0c48a", accent: "#f0c674", text: "#ffffff", led: "#ffb347" },
        Arctic: { deck: "#e4e5e8", platter: "#c9cad0", record: "#1a1a1a", arm: "#8d949b", accent: "#7fc8ff", text: "#ffffff", led: "#2ecc71" },
        Neon: { deck: "#1a1030", platter: "#241640", record: "#140a24", arm: "#ff4fd8", accent: "#ff4fd8", text: "#ffffff", led: "#00f0ff" },
        Ruby: { deck: "#1f1f22", platter: "#2b2b2e", record: "#7a0f1a", arm: "#d9d9d9", accent: "#ff5a6e", text: "#ffffff", led: "#ff5a6e" },
    };

    // Tonearm angles in degrees: resting off the record, outermost groove, and the edge of the label.
    const ARM_REST = 8;
    const ARM_START = 31;
    const ARM_END = 52;
    const ARM_SWING_MS = 200;

    const ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 1.6a8.4 8.4 0 1 1 0 16.8 8.4 8.4 0 0 1 0-16.8zm0 3.4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 3.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z"/></svg>`;

    const CSS = `
#vd-root { position:fixed; inset:0; z-index:10000; display:none; overflow:hidden;
  font-family: var(--font-family, CircularSp, Helvetica, Arial, sans-serif); color:var(--vd-text);
  background:#111; user-select:none; }
#vd-root.open { display:block; }
#vd-bg { position:absolute; inset:-80px; background-size:cover; background-position:center;
  filter: blur(70px) saturate(1.4) brightness(.55); transform: scale(1.15); }
#vd-shade { position:absolute; inset:0; background: radial-gradient(ellipse at center, rgba(0,0,0,.1), rgba(0,0,0,.65)); }
#vd-stage { position:absolute; top:0; bottom:0; left:0; right:0; display:flex; flex-direction:column; align-items:center;
  justify-content:center; gap:3.5vh; transition: right .35s ease; }
#vd-root.lyrics-open #vd-stage { right: min(440px, 36vw); }

/* Plinth */
#vd-deck { --s: min(58vh, 70vw); position:relative; width:calc(var(--s) * 1.32); height:var(--s); border-radius:22px;
  background-color: var(--vd-deck); background-image: linear-gradient(145deg, rgba(255,255,255,.07), rgba(0,0,0,.35));
  box-shadow: 0 40px 90px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08); }
#vd-root.lyrics-open #vd-deck { --s: min(58vh, calc((64vw - 40px) / 1.32)); }
#vd-platter { position:absolute; left:calc(var(--s) * .06); top:calc(var(--s) * .06);
  width:calc(var(--s) * .88); height:calc(var(--s) * .88); border-radius:50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--vd-platter), #fff 8%) 0 60%, var(--vd-platter) 61% 100%);
  box-shadow: 0 8px 30px rgba(0,0,0,.6); }
#vd-platter.land { animation: vd-jolt .28s ease-out; }
@keyframes vd-jolt { 20% { transform: translate(1.5px, -1px); } 40% { transform: translate(-1.5px, 1px); }
  60% { transform: translate(1px, .5px); } 80% { transform: translate(-.5px, -.5px); } }

/* Record */
#vd-record { position:absolute; inset:2%; border-radius:50%; cursor:pointer;
  background:
    radial-gradient(circle, transparent 0 33%, rgba(255,255,255,.035) 33.5%, transparent 34%),
    repeating-radial-gradient(circle, var(--vd-record) 0 1px, color-mix(in srgb, var(--vd-record), #fff 5%) 1px 3px),
    var(--vd-record);
  box-shadow: 0 0 0 2px #050505, 0 6px 20px rgba(0,0,0,.7);
  animation: vd-spin 1.8s linear infinite; animation-play-state: paused; }
#vd-record.playing { animation-play-state: running; }
/* Light reflection sits above the record but outside it, so it stays still while the record spins. */
#vd-sheen { position:absolute; inset:2%; border-radius:50%; pointer-events:none; z-index:1;
  background: conic-gradient(from 30deg, transparent 0 8%, rgba(255,255,255,.12) 12%, transparent 18% 50%, rgba(255,255,255,.08) 62%, transparent 68%); }
@keyframes vd-spin { to { transform: rotate(360deg); } }
#vd-label { position:absolute; inset:33%; border-radius:50%; background:#333 center/cover;
  box-shadow: 0 0 0 3px rgba(0,0,0,.6); }
#vd-label::after { content:""; position:absolute; left:50%; top:50%; width:7%; height:7%; transform:translate(-50%,-50%);
  border-radius:50%; background:#ccc; box-shadow: inset 0 1px 2px rgba(0,0,0,.6); }
#vd-record.swap { animation: vd-swap .7s ease; }
@keyframes vd-swap { 0% { transform: translateX(0) rotate(0); opacity:1 } 45% { transform: translateX(-120%) rotate(-200deg); opacity:0 }
  55% { transform: translateX(120%) rotate(200deg); opacity:0 } 100% { transform: translateX(0) rotate(0); opacity:1 } }

/* Tonearm */
#vd-arm { position:absolute; right:calc(var(--s) * .07); top:calc(var(--s) * .07); width:calc(var(--s) * .14);
  height:calc(var(--s) * .14); transform-origin: 50% 50%; transform: rotate(8deg);
  transition: transform .2s cubic-bezier(.4,.1,.2,1); z-index:2; pointer-events:none; }
#vd-arm .base { position:absolute; inset:0; border-radius:50%; background: radial-gradient(circle, #bbb 0 25%, #555 26% 45%, #2a2a2a 46%);
  box-shadow: 0 4px 12px rgba(0,0,0,.6); }
#vd-arm .rod { position:absolute; left:46%; top:50%; width:8%; height:443%; border-radius:4px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--vd-arm), #000 35%), var(--vd-arm), color-mix(in srgb, var(--vd-arm), #000 35%)); }
#vd-arm .head { position:absolute; left:28%; top:calc(50% + 430%); width:44%; height:60%;
  background: linear-gradient(90deg, color-mix(in srgb, var(--vd-arm), #000 60%), color-mix(in srgb, var(--vd-arm), #000 30%), color-mix(in srgb, var(--vd-arm), #000 60%));
  border-radius:4px 4px 8px 8px; box-shadow: 0 4px 10px rgba(0,0,0,.6); }
#vd-arm.land .head { animation: vd-drop .25s ease-out; }
@keyframes vd-drop { 0% { transform: translateY(-6%) scale(1.12); } 60% { transform: translateY(2%) scale(.97); } }

#vd-led { position:absolute; left:calc(var(--s) * .05); bottom:calc(var(--s) * .035); width:8px; height:8px; border-radius:50%;
  background:#333; transition: background .3s, box-shadow .3s; }
#vd-led.on { background:var(--vd-led); box-shadow:0 0 10px var(--vd-led); }

/* Info + controls */
#vd-info { text-align:center; max-width:80%; }
#vd-title { font-size: clamp(20px, 3.2vh, 34px); font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#vd-artist { font-size: clamp(14px, 2vh, 18px); opacity:.75; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#vd-progress { display:flex; align-items:center; gap:12px; width:min(560px, 80%); font-size:12px; opacity:.85; font-variant-numeric: tabular-nums; }
#vd-bar { flex:1; height:5px; border-radius:99px; background:rgba(255,255,255,.2); cursor:pointer; position:relative; }
#vd-fill { position:absolute; left:0; top:0; bottom:0; border-radius:99px; background:var(--vd-accent); width:0; }
#vd-controls { display:flex; align-items:center; gap:28px; }
#vd-controls button, #vd-close { background:none; border:none; color:var(--vd-text); cursor:pointer; opacity:.85; padding:6px; display:flex;
  align-items:center; justify-content:center; }
#vd-controls button:hover, #vd-close:hover { opacity:1; transform: scale(1.06); }
#vd-play { width:58px; height:58px; border-radius:50%; background:var(--vd-accent) !important; color:#000 !important; opacity:1 !important; }
#vd-lyrics-btn.active, #vd-colors-btn.active { color:var(--vd-accent); opacity:1; }
#vd-close { width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,.1); }
#vd-close:hover { background:rgba(255,255,255,.2); }

/* Lyrics */
#vd-lyrics { position:absolute; top:0; right:0; bottom:0; width:min(440px, 36vw); z-index:4;
  background:rgba(0,0,0,.45); backdrop-filter: blur(20px); border-left:1px solid rgba(255,255,255,.08);
  transform: translateX(100%); transition: transform .35s ease; display:flex; flex-direction:column; }
#vd-root.lyrics-open #vd-lyrics { transform: translateX(0); }
#vd-lyrics-head { padding:56px 26px 10px; font-size:13px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; opacity:.6; }
#vd-lyrics-body { flex:1; overflow-y:auto; padding:30vh 26px; scrollbar-width:none;
  mask-image: linear-gradient(transparent, #000 18%, #000 82%, transparent); }
#vd-lyrics-body::-webkit-scrollbar { display:none; }
.vd-line { font-size: clamp(18px, 2.4vh, 26px); font-weight:700; line-height:1.35; margin:0 0 16px; opacity:.35;
  transition: opacity .25s, transform .25s; transform-origin:left center; cursor:pointer; }
.vd-line:hover { opacity:.6; }
.vd-line.active { opacity:1; color:var(--vd-accent); transform: scale(1.04); }
#vd-lyrics.unsynced .vd-line { opacity:.85; cursor:default; }
.vd-msg { opacity:.6; font-size:16px; }

/* Color panel */
#vd-colors { position:absolute; left:24px; bottom:24px; z-index:5; width:270px; padding:16px 18px; border-radius:14px; color:#fff;
  background:rgba(20,20,22,.88); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,.1);
  box-shadow:0 20px 50px rgba(0,0,0,.5); font-size:13px; display:none; }
#vd-root.colors-open #vd-colors { display:block; }
#vd-colors h4 { margin:4px 0 10px; font-size:11px; letter-spacing:.12em; text-transform:uppercase; opacity:.6; }
.vd-presets { display:flex; gap:6px; margin-bottom:14px; }
.vd-preset { flex:1; height:42px; border-radius:8px; border:1px solid rgba(255,255,255,.2); cursor:pointer; color:#fff;
  font:600 9px/1 inherit; display:flex; align-items:flex-end; justify-content:center; padding-bottom:4px; text-shadow:0 1px 3px #000; }
.vd-preset:hover { border-color:#fff; }
.vd-crow { display:flex; align-items:center; justify-content:space-between; margin:7px 0; cursor:pointer; }
.vd-crow input[type=color] { width:40px; height:24px; border:none; padding:0; background:none; cursor:pointer; }
.vd-crow input[type=checkbox] { accent-color:#1ed760; width:16px; height:16px; cursor:pointer; }
#vd-colors-reset { margin-top:12px; width:100%; padding:7px; border-radius:999px; border:1px solid rgba(255,255,255,.2);
  background:rgba(255,255,255,.08); color:#fff; cursor:pointer; font:inherit; }
#vd-colors-reset:hover { background:rgba(255,255,255,.16); }
`;

    const SVG = {
        prev: `<svg viewBox="0 0 16 16" width="22" height="22" fill="currentColor"><path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7h1.6z"/></svg>`,
        next: `<svg viewBox="0 0 16 16" width="22" height="22" fill="currentColor"><path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-1.6z"/></svg>`,
        play: `<svg viewBox="0 0 16 16" width="22" height="22" fill="currentColor"><path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/></svg>`,
        pause: `<svg viewBox="0 0 16 16" width="22" height="22" fill="currentColor"><path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z"/></svg>`,
        lyrics: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h12M4 11h12M4 16h7"/><circle cx="18" cy="17" r="2.5"/><path d="M20.5 17V8"/></svg>`,
        palette: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7.5" r="1.2" fill="currentColor"/></svg>`,
        close: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>`,
    };

    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    const root = document.createElement("div");
    root.id = "vd-root";
    root.innerHTML = `
<div id="vd-bg"></div><div id="vd-shade"></div>
<div id="vd-stage">
  <div id="vd-deck">
    <div id="vd-platter"><div id="vd-record"><div id="vd-label"></div></div><div id="vd-sheen"></div></div>
    <div id="vd-arm"><div class="rod"></div><div class="head"></div><div class="base"></div></div>
    <div id="vd-led"></div>
  </div>
  <div id="vd-info"><div id="vd-title"></div><div id="vd-artist"></div></div>
  <div id="vd-progress"><span id="vd-pos">0:00</span><div id="vd-bar"><div id="vd-fill"></div></div><span id="vd-dur">0:00</span></div>
  <div id="vd-controls">
    <button id="vd-prev" title="Previous">${SVG.prev}</button>
    <button id="vd-play" title="Play/Pause">${SVG.play}</button>
    <button id="vd-next" title="Next">${SVG.next}</button>
    <button id="vd-lyrics-btn" title="Lyrics (L)">${SVG.lyrics}</button>
    <button id="vd-colors-btn" title="Colors (C)">${SVG.palette}</button>
  </div>
  <button id="vd-close" title="Close (Esc)">${SVG.close}</button>
</div>
<div id="vd-lyrics"><div id="vd-lyrics-head">Lyrics</div><div id="vd-lyrics-body"></div></div>
<div id="vd-colors"></div>`;
    document.body.appendChild(root);

    const $ = (id) => root.querySelector("#" + id);
    const el = {
        bg: $("vd-bg"), record: $("vd-record"), label: $("vd-label"), arm: $("vd-arm"), led: $("vd-led"),
        title: $("vd-title"), artist: $("vd-artist"), pos: $("vd-pos"), dur: $("vd-dur"),
        bar: $("vd-bar"), fill: $("vd-fill"), play: $("vd-play"),
        lyrics: $("vd-lyrics"), lyricsBody: $("vd-lyrics-body"), lyricsBtn: $("vd-lyrics-btn"),
        platter: $("vd-platter"), colors: $("vd-colors"), colorsBtn: $("vd-colors-btn"),
    };

    let lastUri = null;
    let raf = null;

    // ---------------- COLORS ----------------
    function loadJson(key) {
        try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
    }

    const loadColors = () => ({ ...DEFAULT_COLORS, ...loadJson(COLOR_KEY) });
    const loadSettings = () => ({ sound: true, ...loadJson(SETTINGS_KEY) });

    function applyColors() {
        for (const [k, v] of Object.entries(loadColors())) root.style.setProperty("--vd-" + k, v);
    }

    function saveColors(c) {
        localStorage.setItem(COLOR_KEY, JSON.stringify(c));
        applyColors();
    }

    function buildColorPanel() {
        const c = loadColors();
        const presets = Object.entries(PRESETS).map(([name, p]) =>
            `<button class="vd-preset" data-preset="${name}" style="background:linear-gradient(135deg, ${p.deck} 50%, ${p.record} 50%); box-shadow: inset 0 -3px 0 ${p.accent};">${name}</button>`
        ).join("");
        const rows = COLOR_FIELDS.map(([key, label]) =>
            `<label class="vd-crow"><span>${label}</span><input type="color" data-key="${key}" value="${c[key]}"></label>`
        ).join("");
        el.colors.innerHTML = `
<h4>Presets</h4><div class="vd-presets">${presets}</div>
<h4>Colors</h4>${rows}
<label class="vd-crow"><span>Needle drop sound</span><input type="checkbox" id="vd-sound" ${loadSettings().sound ? "checked" : ""}></label>
<button id="vd-colors-reset">Reset to default</button>`;

        el.colors.querySelectorAll("input[type=color]").forEach((input) => {
            input.oninput = () => saveColors({ ...loadColors(), [input.dataset.key]: input.value });
        });
        el.colors.querySelectorAll("[data-preset]").forEach((b) => {
            b.onclick = () => { saveColors({ ...PRESETS[b.dataset.preset] }); buildColorPanel(); };
        });
        $("vd-sound").onchange = (e) => localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), sound: e.target.checked }));
        $("vd-colors-reset").onclick = () => { saveColors({ ...DEFAULT_COLORS }); buildColorPanel(); };
    }

    function toggleColors() {
        const opening = !root.classList.contains("colors-open");
        root.classList.toggle("colors-open", opening);
        el.colorsBtn.classList.toggle("active", opening);
        if (opening) buildColorPanel();
    }

    // ---------------- NEEDLE ----------------
    const SCRATCH_MS = 600;
    let audioCtx = null;

    // Chromium only lets a page start audio during a click or key press, so the context is
    // created/resumed from those handlers and reused when the needle lands a moment later.
    function unlockAudio() {
        try {
            audioCtx ??= new AudioContext();
            if (audioCtx.state !== "running") audioCtx.resume();
        } catch {}
    }

    // Synthesized needle drop: a thump, then a back-and-forth "wiki-wiki" scratch with crackle.
    function playScratch() {
        if (!loadSettings().sound || !audioCtx) return;
        try {
            const t = audioCtx.currentTime;
            const rate = audioCtx.sampleRate;
            const dur = SCRATCH_MS / 1000;
            let volume = 1;
            try { volume = Spicetify.Player.getVolume() ?? 1; } catch {}

            const len = Math.floor(rate * dur);
            const buf = audioCtx.createBuffer(1, len, rate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < len; i++) {
                let v = Math.random() * 2 - 1;
                if (Math.random() < 0.003) v *= 4; // crackle pops
                data[i] = v;
            }
            const noise = audioCtx.createBufferSource();
            noise.buffer = buf;

            // Sweeping a resonant band up and down mimics the record being pushed back and forth.
            const band = audioCtx.createBiquadFilter();
            band.type = "bandpass";
            band.Q.value = 3;
            band.frequency.setValueAtTime(600, t);
            band.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
            band.frequency.exponentialRampToValueAtTime(700, t + 0.24);
            band.frequency.exponentialRampToValueAtTime(2800, t + 0.38);
            band.frequency.exponentialRampToValueAtTime(500, t + dur);

            const env = audioCtx.createGain();
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(0.9, t + 0.02);
            env.gain.linearRampToValueAtTime(0.45, t + 0.12);
            env.gain.linearRampToValueAtTime(0.9, t + 0.2);
            env.gain.linearRampToValueAtTime(0.35, t + 0.3);
            env.gain.linearRampToValueAtTime(0.8, t + 0.4);
            env.gain.linearRampToValueAtTime(0, t + dur);

            const master = audioCtx.createGain();
            master.gain.value = 0.9 * volume;
            noise.connect(band).connect(env).connect(master).connect(audioCtx.destination);
            noise.start(t);

            const thump = audioCtx.createOscillator();
            const thumpGain = audioCtx.createGain();
            thump.frequency.setValueAtTime(120, t);
            thump.frequency.exponentialRampToValueAtTime(40, t + 0.12);
            thumpGain.gain.setValueAtTime(0.7 * volume, t);
            thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            thump.connect(thumpGain).connect(audioCtx.destination);
            thump.start(t);
            thump.stop(t + 0.16);
        } catch {}
    }

    function landNeedle() {
        for (const e of [el.arm, el.platter]) {
            e.classList.remove("land");
            void e.offsetWidth;
            e.classList.add("land");
        }
        playScratch();
    }

    let dropping = false; // arm is swinging down ahead of playback starting
    let armWasDown = false;

    // From the vinyl view: the arm drops, the scratch plays, and the song starts halfway through it.
    function togglePlay() {
        if (Spicetify.Player.isPlaying()) return Spicetify.Player.pause();
        unlockAudio();
        dropping = true;
        armWasDown = true; // landing is scheduled here rather than detected in tick()
        setTimeout(landNeedle, ARM_SWING_MS);
        const songDelay = ARM_SWING_MS + (loadSettings().sound ? SCRATCH_MS / 2 : 0);
        setTimeout(() => {
            Spicetify.Player.play();
            setTimeout(() => (dropping = false), 500);
        }, songDelay);
    }

    window.addEventListener("vinyldeck:colors", applyColors);
    applyColors();

    // ---------------- TRACK ----------------
    function imageUrl(meta) {
        const raw = meta?.image_xlarge_url || meta?.image_large_url || meta?.image_url || "";
        return raw.startsWith("spotify:image:") ? "https://i.scdn.co/image/" + raw.slice(14) : raw;
    }

    function fmt(ms) {
        const s = Math.max(0, Math.floor(ms / 1000));
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }

    function updateTrack() {
        const item = Spicetify.Player.data?.item;
        if (!item) return;
        const img = imageUrl(item.metadata);
        el.title.textContent = item.name || item.metadata?.title || "";
        el.artist.textContent = item.artists?.map((a) => a.name).join(", ") || item.metadata?.artist_name || "";
        el.bg.style.backgroundImage = img ? `url("${img}")` : "none";

        if (lastUri && lastUri !== item.uri && root.classList.contains("open")) {
            el.record.classList.remove("swap");
            void el.record.offsetWidth;
            el.record.classList.add("swap");
            setTimeout(() => (el.label.style.backgroundImage = img ? `url("${img}")` : "none"), 330);
        } else {
            el.label.style.backgroundImage = img ? `url("${img}")` : "none";
        }
        if (lastUri !== item.uri && root.classList.contains("lyrics-open")) loadLyrics();
        lastUri = item.uri;
    }

    function updatePlayState() {
        const playing = Spicetify.Player.isPlaying();
        el.record.classList.toggle("playing", playing);
        el.led.classList.toggle("on", playing);
        el.play.innerHTML = playing ? SVG.pause : SVG.play;
    }

    // ---------------- LYRICS ----------------
    const lyricsCache = new Map();
    let lyrics = null; // { synced, lines: [{ t, text }] }
    let activeLine = -1;

    async function fetchSpotifyLyrics(item) {
        if (!Spicetify.CosmosAsync) return null;
        const id = item.uri.split(":")[2];
        const res = await Spicetify.CosmosAsync.get(
            `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`,
            null,
            { "app-platform": "WebPlayer" }
        );
        const lines = res?.lyrics?.lines?.filter((l) => l.words && l.words !== "♪");
        if (!lines?.length) return null;
        return { synced: res.lyrics.syncType === "LINE_SYNCED", lines: lines.map((l) => ({ t: +l.startTimeMs, text: l.words })) };
    }

    async function fetchLrclib(item) {
        const q = new URLSearchParams({
            track_name: item.name || item.metadata?.title || "",
            artist_name: item.artists?.[0]?.name || item.metadata?.artist_name || "",
            album_name: item.album?.name || item.metadata?.album_title || "",
            duration: Math.round(Spicetify.Player.getDuration() / 1000),
        });
        const res = await fetch("https://lrclib.net/api/get?" + q);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.syncedLyrics) {
            const lines = [];
            for (const row of data.syncedLyrics.split("\n")) {
                const m = row.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
                if (m && m[3].trim()) lines.push({ t: (+m[1] * 60 + +m[2]) * 1000, text: m[3] });
            }
            if (lines.length) return { synced: true, lines };
        }
        if (data.plainLyrics) return { synced: false, lines: data.plainLyrics.split("\n").map((text) => ({ t: 0, text })) };
        return null;
    }

    async function loadLyrics() {
        const item = Spicetify.Player.data?.item;
        if (!item) return;
        const uri = item.uri;
        lyrics = null;
        activeLine = -1;
        el.lyricsBody.innerHTML = `<div class="vd-msg">Loading lyrics…</div>`;

        let result = lyricsCache.get(uri);
        if (result === undefined) {
            result = null;
            try { result = await fetchSpotifyLyrics(item); } catch {}
            if (!result) try { result = await fetchLrclib(item); } catch {}
            lyricsCache.set(uri, result);
        }
        if (Spicetify.Player.data?.item?.uri !== uri) return; // song changed while fetching

        lyrics = result;
        el.lyrics.classList.toggle("unsynced", !!result && !result.synced);
        if (!result) {
            el.lyricsBody.innerHTML = `<div class="vd-msg">No lyrics found for this song.</div>`;
            return;
        }
        el.lyricsBody.innerHTML = "";
        result.lines.forEach((line) => {
            const div = document.createElement("div");
            div.className = "vd-line";
            div.textContent = line.text || " ";
            if (result.synced) div.onclick = () => Spicetify.Player.seek(line.t);
            el.lyricsBody.appendChild(div);
        });
        el.lyricsBody.scrollTop = 0;
    }

    function syncLyrics(pos) {
        if (!lyrics?.synced || !root.classList.contains("lyrics-open")) return;
        let idx = -1;
        for (let i = 0; i < lyrics.lines.length && lyrics.lines[i].t <= pos + 150; i++) idx = i;
        if (idx === activeLine) return;
        el.lyricsBody.children[activeLine]?.classList.remove("active");
        activeLine = idx;
        const line = el.lyricsBody.children[idx];
        if (!line) return;
        line.classList.add("active");
        el.lyricsBody.scrollTo({ top: line.offsetTop - el.lyricsBody.clientHeight / 2 + line.offsetHeight / 2, behavior: "smooth" });
    }

    function toggleLyrics() {
        const opening = !root.classList.contains("lyrics-open");
        root.classList.toggle("lyrics-open", opening);
        el.lyricsBtn.classList.toggle("active", opening);
        if (opening) loadLyrics();
    }

    // ---------------- LOOP ----------------
    function tick() {
        raf = requestAnimationFrame(tick);
        if (lastUri !== Spicetify.Player.data?.item?.uri) updateTrack();
        let pos = 0;
        let dur = 1;
        try {
            pos = Spicetify.Player.getProgress();
            dur = Spicetify.Player.getDuration() || 1;
        } catch {
            return; // player not ready yet
        }
        const pct = Math.min(1, pos / dur);
        el.fill.style.width = pct * 100 + "%";
        el.pos.textContent = fmt(pos);
        el.dur.textContent = fmt(dur);
        // Arm rests off the record when paused, and tracks from the outer groove to the label as the song plays.
        const down = dropping || Spicetify.Player.isPlaying();
        el.arm.style.transform = `rotate(${down ? ARM_START + pct * (ARM_END - ARM_START) : ARM_REST}deg)`;
        if (down && !armWasDown) setTimeout(landNeedle, ARM_SWING_MS);
        armWasDown = down;
        syncLyrics(pos);
    }

    function open() {
        root.classList.add("open");
        applyColors();
        updateTrack();
        updatePlayState();
        unlockAudio(); // opening the view is a click, so audio is allowed from here on
        armWasDown = Spicetify.Player.isPlaying(); // no needle drop just for opening the view
        cancelAnimationFrame(raf);
        tick();
    }

    function close() {
        root.classList.remove("open");
        cancelAnimationFrame(raf);
    }

    $("vd-close").onclick = close;
    el.record.onclick = togglePlay;
    el.play.onclick = togglePlay;
    el.lyricsBtn.onclick = toggleLyrics;
    el.colorsBtn.onclick = toggleColors;
    $("vd-prev").onclick = () => Spicetify.Player.back();
    $("vd-next").onclick = () => Spicetify.Player.next();
    el.bar.onclick = (e) => {
        const r = el.bar.getBoundingClientRect();
        Spicetify.Player.seek(Math.floor(((e.clientX - r.left) / r.width) * Spicetify.Player.getDuration()));
    };

    document.addEventListener("keydown", (e) => {
        if (!root.classList.contains("open")) return;
        if (e.key === "Escape") close();
        else if (e.key === " ") togglePlay();
        else if (e.key === "c" || e.key === "C") toggleColors();
        else if (e.key === "ArrowRight") Spicetify.Player.next();
        else if (e.key === "ArrowLeft") Spicetify.Player.back();
        else if (e.key === "l" || e.key === "L") toggleLyrics();
        else return;
        e.preventDefault();
        e.stopPropagation();
    }, true);

    Spicetify.Player.addEventListener("songchange", updateTrack);
    Spicetify.Player.addEventListener("onplaypause", updatePlayState);

    // Topbar buttons are placed on the left (beside back/forward) unless isRight is passed.
    new Spicetify.Topbar.Button("Vinyl", ICON, () => (root.classList.contains("open") ? close() : open()));
})();
