/* 3D 賞月 · 中秋特企 — app */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ---------- i18n ---------- */
const T = {
  zh: {
    "brand": "3D 賞月", "brand.sub": "中秋 · 真實月相",
    "full": "◉ 滿月視角", "loading": "月亮升空中…",
    "info.phase": "月相", "info.full": "滿月", "info.rise": "月出", "info.set": "月落",
    "info.az": "方位（仰角）", "info.hint": "拖曳旋轉 · 滾輪縮放 · 指住月面睇地名",
    "tip.phase": "光照",
  },
  en: {
    "brand": "3D Moon", "brand.sub": "Mid-Autumn · real phase",
    "full": "◉ Full-moon view", "loading": "Moon is rising…",
    "info.phase": "Phase", "info.full": "Full moon", "info.rise": "Moonrise", "info.set": "Moonset",
    "info.az": "Azimuth (alt)", "info.hint": "Drag to rotate · scroll to zoom · hover for names",
    "tip.phase": "Illumination",
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
});
renderI18n();

/* ---------- scene ---------- */
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

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
const sun = new THREE.DirectionalLight(0xfff3e0, 2.6);
scene.add(sun);

/* ambient earthshine */
scene.add(new THREE.AmbientLight(0x334466, 0.35));

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

function buildMoon(heightImg, colorImg) {
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

  normalTex = new THREE.TextureLoader().load("./tex/normal_2k.jpg");
  normalTex.colorSpace = THREE.NoColorSpace;
  normalTex.flipY = false;

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughness: 0.96,
    metalness: 0,
  });
  moonMesh = new THREE.Mesh(geo, mat);
  scene.add(moonMesh);
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

function updateInfo() {
  const now = new Date();
  const ill = Astronomy.Illumination("Moon", now);
  const phase = ill.phase_fraction;
  document.getElementById("phase-val").textContent = `${lang === "zh" ? "光照" : "Illuminated"} ${Math.round(phase * 100)}%`;

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

  // sun direction (of-date equatorial) as scene light; moon is illuminated from the sun side
  const sunEq = Astronomy.Equator("Sun", now, OBS, true, true);
  const decRad = sunEq.dec * (Math.PI / 180);       // dec in degrees
  const raRad = sunEq.ra * (Math.PI / 12);          // ra in hours
  sun.position.set(
    Math.cos(decRad) * Math.cos(raRad) * 8,
    Math.sin(decRad) * 8,
    Math.cos(decRad) * Math.sin(raRad) * 8
  );
  const moonDir = sun.position.clone().normalize();
  return { sunny: moonDir, illum: phase };
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
  const { sunny } = updateInfo();
  camera.position.copy(sunny.clone().multiplyScalar(3.2));   // lit side = same side as the sun at full moon
  camera.position.y += 0.2;
  camera.lookAt(0, 0, 0);
  controls.update();
});

/* ---------- load ---------- */
const isSlow = navigator.connection && (navigator.connection.effectiveType === "3g" || navigator.connection.downlink < 1.5);
const colorSize = isSlow ? "_2k" : "_4k";
const imgLoader = new THREE.ImageLoader();
const loadImg = (url) => new Promise((res, rej) => imgLoader.load(url, (img) => res(img), undefined, rej));
Promise.all([
  loadImg("./tex/height_2k.png"),
  loadImg(`./tex/color${colorSize}.jpg`),
]).then(([h, c]) => {
  buildMoon(h, c);
  try {
    const { sunny } = updateInfo();
    camera.position.copy(sunny.clone().multiplyScalar(3.0));   // look at the lit (near) face
    camera.position.y += 0.25;
  } catch (e) {
    camera.position.set(0, 0.35, 3.4);
  }
  camera.lookAt(0, 0, 0);
  controls.update();
}).catch((e) => {
  document.getElementById("load-text").textContent = "Texture load failed: " + e;
});

/* ---------- loop ---------- */
function animate() {
  requestAnimationFrame(animate);
  hover();
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("pointerdown", () => (tooltip.hidden = false));