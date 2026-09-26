/* 3D 賞月 · 中秋特企 — app */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ---------- i18n ---------- */
const T = {
  zh: {
    "brand": "3D 賞月", "brand.sub": "中秋 · 真實月相",
    "full": "◉ 滿月視角", "loading": "月亮升空中…",
    "info.phase": "月相", "info.age": "月齡", "info.full": "滿月", "info.rise": "月出", "info.set": "月落",
    "info.az": "方位（仰角）", "info.hint": "拖曳旋轉 · 滾輪縮放 · 指住月面睇地名",
    "tip.phase": "光照",
    "cal.title": "📅 月曆", "cal.today": "今日", "cal.phases": "本月光相",
    "cal.hint": "撳任何一日，3D 月亮即刻切去嗰日嘅月相",
    "cal.new": "新月", "cal.full": "滿月", "cal.fq": "上弦月", "cal.tq": "下弦月",
    "cal.wd": ["一", "二", "三", "四", "五", "六", "日"],
    "cal.moon": "月亮",
  },
  en: {
    "brand": "3D Moon", "brand.sub": "Mid-Autumn · real phase",
    "full": "◉ Full-moon view", "loading": "Moon is rising…",
    "info.phase": "Phase", "info.age": "Age", "info.full": "Full moon", "info.rise": "Moonrise", "info.set": "Moonset",
    "info.az": "Azimuth (alt)", "info.hint": "Drag to rotate · scroll to zoom · hover for names",
    "tip.phase": "Illumination",
    "cal.title": "📅 Moon Calendar", "cal.today": "Today", "cal.phases": "Phases this month",
    "cal.hint": "Tap any day — the 3D moon switches to that day's phase",
    "cal.new": "New moon", "cal.full": "Full moon", "cal.fq": "First quarter", "cal.tq": "Last quarter",
    "cal.wd": ["M", "T", "W", "T", "F", "S", "S"],
    "cal.moon": "moon",
  },
};
let lang = localStorage.getItem("moon-lang") || (navigator.language && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en");
const t = (k) => (T[lang] && T[lang][k]) || k;
function renderI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => { const k = el.dataset.i18n; if (T[lang][k]) el.textContent = T[lang][k]; });
  document.querySelector("#lang-btn").textContent = lang === "zh" ? "EN" : "繁中";
}
document.querySelector("#lang-btn").addEventListener("click", () => {
  lang = lang === "zh" ? "en" : "zh";
  localStorage.setItem("moon-lang", lang);
  renderI18n();
  updateInfo();
  renderCalendar();
});
renderI18n();

/* ---------- scene ---------- */
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0.35, 3.4);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.5;
controls.maxDistance = 12;
controls.autoRotate = false;

/* sun light (moon phase) */
const sun = new THREE.DirectionalLight(0xfff6e8, 3.0);
scene.add(sun);

/* ambient earthshine (dim so the terminator side is dark, photo-like) */
scene.add(new THREE.AmbientLight(0x334466, 0.16));

/* ---------- stars ---------- */
function stars(count, size, spread) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(spread);
    pos.set([v.x, v.y, v.z], i * 3);
    const w = 0.6 + Math.random() * 0.4;
    c.setHSL(0.1 + Math.random() * 0.05, 0.1, w);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 1 });
  return new THREE.Points(g, m);
}
scene.add(stars(2600, 0.05, 60));
scene.add(stars(900, 0.09, 45));

/* ---------- moon ---------- */
const MOON_RADIUS = 1.0;
const HEIGHT_SCALE = 0.012;
let moonMesh = null, normalTex = null;

function buildMoon(heightImg, colorImg, normalImg) {
  const seg = 256;
  const geo = new THREE.SphereGeometry(MOON_RADIUS, seg, seg);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const hc = document.createElement("canvas");
  hc.width = heightImg.width; hc.height = heightImg.height;
  const hctx = hc.getContext("2d");
  hctx.drawImage(heightImg, 0, 0);
  const hdata = hctx.getImageData(0, 0, hc.width, hc.height).data;
  const hw = hc.width, hh = hc.height;

  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i), vv = uv.getY(i);
    const x = Math.min(hw - 1, Math.floor(u * hw));
    const y = Math.min(hh - 1, Math.floor(vv * hh));   // flipY=false: v=0 (north) = image top
    const h01 = hdata[(y * hw + x) * 4] / 255;
    v.fromBufferAttribute(pos, i).normalize();
    const r = MOON_RADIUS * (1 + (h01 - 0.5) * 2 * HEIGHT_SCALE);
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
  }
  geo.computeVertexNormals();
  geo.attributes.position.needsUpdate = true;

  const tex = new THREE.Texture(colorImg);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.anisotropy = 4;

  normalTex = new THREE.Texture(normalImg);
  normalTex.colorSpace = THREE.NoColorSpace;
  normalTex.flipY = false;

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    normalMap: normalImg ? normalTex : null,
    normalScale: new THREE.Vector2(2.4, 2.4),
    roughness: 0.97,
    metalness: 0,
  });
  moonMesh = new THREE.Mesh(geo, mat);
  scene.add(moonMesh);
  window.__tex = {
    color: [tex.image && tex.image.width, tex.image && tex.image.height],
    normal: normalTex.image && normalTex.image.width,
    colorUrl: tex.image && tex.image.src,
  };
  document.getElementById("loading").hidden = true;
}

/* ---------- astronomy (HK 2026-09-25) ---------- */
const OBS = new Astronomy.Observer(22.3193, 114.1694, 30);

function fmtTime(d) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function diffHm(ms) {
  const m = Math.floor(Math.abs(ms) / 60000);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
}

function hkLocalDate() {
  return new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000);
}

let simNow = null;   // 月相模擬：null = 真實時間

function updateInfo() {
  const now = simNow || new Date();
  const ill = Astronomy.Illumination("Moon", now);
  const phase = ill.phase_fraction;
  document.getElementById("phase-val").textContent = `${lang === "zh" ? "光照" : "Illuminated"} ${Math.round(phase * 100)}%`;
  // 月齡：astronomy 嘅 phase_angle 喺月球度望太陽-地球夾角——滿月≈0°、新月≈180°
  const age = ((180 - (ill.phase_angle || 0)) / 360) * 29.530588853;
  document.getElementById("age-val").textContent = `${age.toFixed(1)} ${lang === "zh" ? "天" : "days"}`;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let rise = null, set = null;
  try {
    rise = Astronomy.SearchRiseSet("Moon", OBS, +1, today, 1);
    set = Astronomy.SearchRiseSet("Moon", OBS, -1, today, 1);
  } catch (e) { /* not found on edge days */ }
  document.getElementById("rise-val").textContent = rise ? fmtTime(rise.date) : "—";
  document.getElementById("set-val").textContent = set ? fmtTime(set.date) : "—";

  let fm = null, best = -1;
  try {
    for (let d = -15; d <= 15; d += 1 / 24) {
      const t = new Date(now.getTime() + d * 86400000);
      const f = Astronomy.Illumination("Moon", t).phase_fraction;
      if (f > best) { best = f; fm = t; }
    }
    // refine around the found peak (±2h, 5-min steps)
    for (let m = -120; m <= 120; m += 5) {
      const t = new Date(fm.getTime() + m * 60000);
      const f = Astronomy.Illumination("Moon", t).phase_fraction;
      if (f > best) { best = f; fm = t; }
    }
  } catch (e) { fm = null; }
  document.getElementById("full-val").textContent = fm ? fmtTime(fm) : "—";

  // horizontal coords (manual): RA/Dec of date -> local hour angle -> alt/az
  try {
    const eq = Astronomy.Equator("Moon", now, OBS, true, true);
    const jnow = (now.getTime() / 86400000) + 2440587.5;   // JD (UTC)
    const gmst = 4.8949612128230588 + 6.30038809898489 * (jnow - 2451545.0);
    const lst = gmst + OBS.longitude * Math.PI / 180;
    let ha = lst - eq.ra * (Math.PI / 12);   // ra in hours -> radians
    ha = ((ha + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const phi = OBS.latitude * Math.PI / 180, dec = eq.dec * (Math.PI / 180);   // dec in degrees
    const sinAlt = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
    const azDeg = Math.round((((az * 180 / Math.PI) + 180) + 360) % 360);
    const altDeg = Math.round(alt * 180 / Math.PI * 10) / 10;
    document.getElementById("az-val").textContent = fm
    ? (fm > now
        ? `${lang === "zh" ? "距滿月" : "to full moon"} ${diffHm(fm - now)}`
        : `${lang === "zh" ? "滿月已過" : "full moon passed"} ${diffHm(now - fm)}`)
    : "—";
  } catch (e) {
    document.getElementById("az-val").textContent = "—";
  }

  // Light comes from the Earth-side (camera-side) direction, tilted by the real phase angle,
  // so at full moon the terminator sits at the limb (photo-real), not across the face.
  const phaseAngle = Math.acos(Math.max(-1, Math.min(1, 2 * phase - 1)));   // 0..π
  const ca = Math.cos(phaseAngle), sa = Math.sin(phaseAngle);
  sun.position.set(8 * sa, 0.0, 8 * ca);
  return { phaseAngle, illum: phase };
}

/* ---------- lunar features ---------- */
const FEATURES = [
  { n: "Mare Serenitatis", zh: "澄海", lat: 28.0, lon: 17.5 },
  { n: "Mare Tranquillitatis", zh: "靜海", lat: 8.5, lon: 31.4 },
  { n: "Mare Imbrium", zh: "雨海", lat: 32.8, lon: -15.6 },
  { n: "Mare Crisium", zh: "危海", lat: 17.0, lon: 59.1 },
  { n: "Mare Fecunditatis", zh: "豐富海", lat: -7.8, lon: 51.3 },
  { n: "Mare Nubium", zh: "雲海", lat: -21.3, lon: -16.6 },
  { n: "Oceanus Procellarum", zh: "風暴洋", lat: 18.4, lon: -57.4 },
  { n: "Mare Nectaris", zh: "酒海", lat: -15.2, lon: 35.5 },
  { n: "Mare Frigoris", zh: "冷海", lat: 56.0, lon: 1.4 },
  { n: "Mare Vaporum", zh: "汽海", lat: 13.3, lon: 3.6 },
  { n: "Mare Humorum", zh: "濕海", lat: -24.4, lon: -38.6 },
  { n: "Mare Australe", zh: "南海", lat: -38.9, lon: 93.0 },
  { n: "Tycho", zh: "第谷環形山", lat: -43.3, lon: -11.4 },
  { n: "Copernicus", zh: "哥白尼環形山", lat: 9.6, lon: -20.1 },
  { n: "Kepler", zh: "刻卜勒環形山", lat: 8.1, lon: -38.0 },
  { n: "Aristarchus", zh: "阿里斯塔克斯", lat: 23.7, lon: -47.4 },
  { n: "Plato", zh: "柏拉圖環形山", lat: 51.6, lon: -9.3 },
  { n: "Archimedes", zh: "阿基米德環形山", lat: 29.7, lon: -4.0 },
  { n: "Clavius", zh: "克拉維斯環形山", lat: -58.8, lon: -14.1 },
  { n: "Grimaldi", zh: "格里馬爾迪", lat: -5.4, lon: -68.4 },
  { n: "Langrenus", zh: "朗格倫環形山", lat: -8.9, lon: 61.0 },
  { n: "Petavius", zh: "佩塔維斯", lat: -25.1, lon: 60.4 },
  { n: "Theophilus", zh: "狄奧菲勒斯", lat: -11.4, lon: 26.4 },
  { n: "Mare Undarum", zh: "波海", lat: 6.8, lon: 68.4 },
  { n: "Mare Spumans", zh: "沫海", lat: 1.3, lon: 65.3 },
  { n: "Sinus Iridum", zh: "虹灣", lat: 44.1, lon: -31.5 },
  { n: "Mare Cognitum", zh: "知海", lat: -10.5, lon: -22.3 },
  { n: "Mare Marginis", zh: "邊際海", lat: 13.3, lon: 86.1 },
  { n: "Mare Smythii", zh: "史密斯海", lat: -1.3, lon: 87.0 },
  { n: "Rupes Recta", zh: "直壁", lat: -22.5, lon: -7.5 },
];
function latLonOf(point) {
  const u = point.normalize();
  const lat = Math.asin(Math.max(-1, Math.min(1, u.y))) * 180 / Math.PI;
  // three.js SphereGeometry: x=-cosφ·sinθ, z=sinφ·sinθ  →  φ = atan2(z, -x)
  let lon = Math.atan2(u.z, -u.x) * 180 / Math.PI;
  lon = ((lon + 180 + 360) % 360) - 180;
  return { lat, lon };
}
function nearestFeature(u) {
  const p = latLonOf(u);
  let best = null, bestD = 1e9;
  for (const f of FEATURES) {
    const d = Math.hypot(f.lat - p.lat, (f.lon - p.lon + 180 + 360) % 360 - 180);
    if (d < bestD) { bestD = d; best = f; }
  }
  return bestD < 5 ? { f: best, d: bestD } : null;
}

/* ---------- hover ---------- */
const tooltip = document.getElementById("tooltip");
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
canvas.addEventListener("pointermove", (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
});
function hover() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(moonMesh, false);
  window.__hover = { hit: hits.length > 0, n: hits.length, ptr: [pointer.x, pointer.y], cam: [camera.position.x.toFixed(2), camera.position.y.toFixed(2), camera.position.z.toFixed(2)] };
  if (hits.length) {
    const hit = nearestFeature(hits[0].point.clone());
    window.__hover.near = hit ? { n: hit.f.n, d: +hit.d.toFixed(1) } : null;
    window.__hover.pos = latLonOf(hits[0].point);
    if (hit) {
      tooltip.hidden = false;
      tooltip.textContent = `${lang === "zh" ? hit.f.zh : hit.f.n} · ${hit.f.lat.toFixed(1)}°, ${hit.f.lon.toFixed(1)}°`;
      tooltip.style.left = pointer.x > 0 ? "auto" : "16px";
      tooltip.style.right = pointer.x > 0 ? "16px" : "auto";
      tooltip.style.top = "96px";
      return;
    }
  }
  tooltip.hidden = true;
}

/* ---------- full moon view ---------- */
document.getElementById("full-btn").addEventListener("click", () => {
  updateInfo();
  camera.position.set(0, 0.35, 3.4);
  camera.lookAt(0, 0, 0);
  controls.update();
});

/* ---------- moon phase simulator ---------- */
function scanPhase(kind, from, to) {
  // kind: "max" | "min" | "q1"（上弦：f 升穿 0.5）
  let best = null, bestV = kind === "min" ? 1 : -1, prev = null;
  const step = 1 / 24;
  for (let d = -15; d <= 15; d += step) {
    const t = new Date((from.getTime() + d * 86400000));
    const f = Astronomy.Illumination("Moon", t).phase_fraction;
    if (kind === "q1") {
      if (prev !== null && f > prev && prev < 0.5 && f >= 0.5) { best = t; break; }
      prev = f;
    } else if ((kind === "max" && f > bestV) || (kind === "min" && f < bestV)) {
      bestV = f; best = t;
    }
  }
  if (best) {   // refine (±3h, 5-min)
    for (let m = -180; m <= 180; m += 5) {
      const t = new Date(best.getTime() + m * 60000);
      const f = Astronomy.Illumination("Moon", t).phase_fraction;
      if ((kind === "max" && f > bestV) || (kind === "min" && f < bestV)) { bestV = f; best = t; }
    }
  }
  return best;
}

function applySim(d) {
  simNow = d;
  const input = document.getElementById("sim-dt");
  input.value = d ? toLocalInput(d) : "";
  document.querySelectorAll(".sim-presets .pill").forEach((b) => b.classList.toggle("active", b.dataset.sim === "live" && !d));
  updateInfo();
}
function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
document.querySelector(".sim-presets").addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  const k = btn.dataset.sim;
  let d = null;
  if (k === "lastnight") {
    d = new Date(); d.setDate(d.getDate() - 1);
    d.setHours(22, 0, 0, 0);   // 昨晚10點（本地時間）
  } else if (k === "full") {
    d = scanPhase("max", new Date(), new Date());
  } else if (k === "firstq") {
    d = scanPhase("q1", new Date(), new Date());
  } else if (k === "new") {
    d = scanPhase("min", new Date(), new Date());
  }
  document.querySelectorAll(".sim-presets .pill").forEach((b) => b.classList.toggle("active", b.dataset.sim === k));
  simNow = d;
  const input = document.getElementById("sim-dt");
  input.value = d ? toLocalInput(d) : "";
  updateInfo();
});
document.getElementById("sim-dt").addEventListener("input", (e) => {
  const v = e.target.value;
  simNow = v ? new Date(v) : null;
  document.querySelectorAll(".sim-presets .pill").forEach((b) => b.classList.toggle("active", false));
  updateInfo();
});

/* ---------- 月曆（Star Walk homage + 互動升級） ---------- */
const PHASE_ICONS = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
let calBase = new Date(); calBase.setDate(1);   // 顯示中嘅月份（1 號）

function phaseIcon(f, waxing) {
  // f: 照亮度 0..1；waxing 決定 icon 方向（盈 → 🌒🌓🌔，虧 → 🌘🌗🌖）
  // 邊界用 cos 映射（照度空間）：新月<3.8%、弦月帶 31–69%（上/下弦=0.5 啱啱喺中間）、滿月>96.2%
  if (f < 0.038) return "🌑";
  if (f < 0.309) return waxing ? "🌒" : "🌘";
  if (f < 0.691) return waxing ? "🌓" : "🌗";
  if (f < 0.962) return waxing ? "🌔" : "🌖";
  return "🌕";
}

function renderCalendar() {
  const y = calBase.getFullYear(), m = calBase.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;   // 週一開頭
  document.getElementById("cal-month").textContent = `${y} 年 ${m + 1} 月`;
  const wd = t("cal.wd");
  const now = new Date();
  let html = wd.map((d) => `<span class="cal-wd">${d}</span>`).join("");
  for (let i = 0; i < lead; i++) html += `<span class="cal-cell cal-empty"></span>`;
  for (let d = 1; d <= days; d++) {
    const noon = new Date(y, m, d, 12, 0);
    const f = Astronomy.Illumination("Moon", noon).phase_fraction;
    const f2 = Astronomy.Illumination("Moon", new Date(noon.getTime() + 12 * 3600e3)).phase_fraction;
    const waxing = f2 >= f;
    const isToday = d === now.getDate() && m === now.getMonth() && y === now.getFullYear();
    const isNew = f <= 0.03, isFull = f >= 0.97;
    html += `<button type="button" class="cal-cell${isToday ? " today" : ""}" data-day="${d}" title="${d} 日">`
      + `<span class="cal-ico">${phaseIcon(f, waxing)}</span>`
      + `<span class="cal-num">${d}</span>`
      + (isNew || isFull ? `<span class="cal-mark ${isFull ? "full" : ""}">${isFull ? "●" : "○"}</span>` : "")
      + `</button>`;
  }
  document.getElementById("cal-grid").innerHTML = html;
  document.querySelectorAll("#cal-grid .cal-cell[data-day]").forEach((cell) => {
    cell.addEventListener("click", () => {
      applySim(new Date(y, m, Number(cell.dataset.day), 22, 0));
      canvas.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  renderMajorPhases();
}

function fmtCal(d) {
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function renderMajorPhases() {
  const y = calBase.getFullYear(), m = calBase.getMonth();
  const t0 = new Date(y, m, 1).getTime(), t1 = new Date(y, m + 1, 1).getTime();
  let best = { full: null, fullF: -1, new: null, newF: 1, q1: null, q3: null }, prev = null;
  for (let ts = t0; ts < t1; ts += 2 * 3600e3) {
    const f = Astronomy.Illumination("Moon", new Date(ts)).phase_fraction;
    if (f > best.fullF) { best.fullF = f; best.full = ts; }
    if (f < best.newF) { best.newF = f; best.new = ts; }
    if (prev !== null && prev.f < 0.5 && f >= 0.5) best.q1 = ts;   // 上弦（照度升穿 0.5）
    if (prev !== null && prev.f > 0.5 && f <= 0.5) best.q3 = ts;   // 下弦（照度跌穿 0.5）
    prev = { f };
  }
  const refine = (ts, dir) => {
    let t = ts, bestV = dir === "max" ? -1 : 1;
    for (let k = -3 * 3600e3; k <= 3 * 3600e3; k += 15 * 60e3) {
      const f = Astronomy.Illumination("Moon", new Date(ts + k)).phase_fraction;
      if (dir === "half") { if (Math.abs(f - 0.5) < bestV) { bestV = Math.abs(f - 0.5); t = ts + k; } }
      else if ((dir === "max" && f > bestV) || (dir === "min" && f < bestV)) { bestV = f; t = ts + k; }
    }
    return new Date(t);
  };
  const fullD = best.full ? refine(best.full, "max") : null;
  const newD = best.new ? refine(best.new, "min") : null;
  const q1D = best.q1 ? refine(best.q1, "half") : null;   // 上弦 = f 啱啱升穿 0.5
  const q3D = best.q3 ? refine(best.q3, "half") : null;   // 下弦 = f 啱啱跌穿 0.5
  const rows = [
    [t("cal.new"), newD], [t("cal.fq"), q1D], [t("cal.full"), fullD], [t("cal.tq"), q3D],
  ];
  document.getElementById("cal-phases").innerHTML = rows
    .map(([name, d]) => `<div class="cal-phase"><span>${name}</span><b>${d ? fmtCal(d) : "—"}</b></div>`)
    .join("");
}

document.getElementById("cal-prev").addEventListener("click", () => { calBase.setMonth(calBase.getMonth() - 1); renderCalendar(); });
document.getElementById("cal-next").addEventListener("click", () => { calBase.setMonth(calBase.getMonth() + 1); renderCalendar(); });
document.getElementById("cal-today").addEventListener("click", () => {
  const n = new Date(); calBase = new Date(n.getFullYear(), n.getMonth(), 1);
  renderCalendar();
  applySim(null);
});

/* ---------- load ---------- */
// GPU-aware 紋理揀選：查實際 MAX_TEXTURE_SIZE；手機（細屏/觸控）封頂 4K，唔好用 8K（好多手機 GPU 上限 4096，8K upload 唔到 → 月面變黑）
function webglMaxTex() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return 4096;
    const m = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    return m || 4096;
  } catch (e) { return 4096; }
}
const maxTex = webglMaxTex();
const isMobile = ("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0 || window.innerWidth < 700;
// 手機一律 2K：月面喺手機只佔幾百 px，2K 已經 3 倍 oversample；避開細 GPU upload 上限同低記憶體
const texCap = isMobile ? 2048 : Math.min(maxTex, 8192);
const SIZES = [["_8k", 8192], ["_4k", 4096], ["_2k", 2048]];
const colorSize = (SIZES.find(([_, s]) => s <= texCap) || SIZES[2])[0];
const imgLoader = new THREE.ImageLoader();
const loadImg = (url) => new Promise((res, rej) => imgLoader.load(url, (img) => res(img), undefined, rej));
// 下載失敗 → 自動降級細一級，唔會全黑
async function loadColor(idx = SIZES.findIndex(([_, s]) => s <= texCap)) {
  try { return await loadImg(`./tex/color${SIZES[idx][0]}.jpg`); }
  catch (e) { return idx < SIZES.length - 1 ? loadColor(idx + 1) : Promise.reject(e); }
}
async function loadNormal() {
  try { return await loadImg("./tex/normal_4k.jpg"); }
  catch (e) { return null; }   // 法線失敗唔阻載入
}
Promise.all([
  loadImg("./tex/height_2k.png"),
  loadColor(),
  loadNormal(),
]).then(([h, c, n]) => {
  buildMoon(h, c, n);
  updateInfo();
  camera.position.set(0, 0.35, 3.4);   // near side (Earth view), lit face toward camera
  camera.lookAt(0, 0, 0);
  controls.update();
}).catch((e) => {
  document.getElementById("load-text").textContent = "Texture load failed: " + e;
});

/* 月曆初始化（Astronomy 係 global，唔使等紋理；放喺 loop 之前，virtual-time rAF 唔 fire 都唔會阻住） */
renderCalendar();

/* ---------- loop ---------- */
function animate() {
  requestAnimationFrame(animate);
  hover();
  controls.update();
  renderer.render(scene, camera);
}
setTimeout(() => { requestAnimationFrame(animate); }, 0);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* (calendar init moved before loop) */

window.addEventListener("pointerdown", () => (tooltip.hidden = false));

/* WebGL context lost（記憶體/驅動問題）→ 自動重載，唔好成版黑 */
window.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  setTimeout(() => location.reload(), 300);
});