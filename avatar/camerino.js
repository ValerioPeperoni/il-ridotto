// Camerino: scegli e personalizza il tuo personaggio (vale per tutti i giochi).
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { savedProfile, saveProfile } from './avatar.js';
import { loadSportLibrary, makeSportsmate, randomSport, SKINS, HAIR_COLORS, HAIRS, KIT } from './sport.js';
import { setupStage } from './stage.js';

const $ = s => document.querySelector(s);
const MOBILE = matchMedia('(pointer:coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.75 : 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
const stage = setupStage(renderer, scene, { mobile: MOBILE });
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.25, 0.4, 0.95));
composer.addPass(new OutputPass());
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// pedana
const podium = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.16, 64), new THREE.MeshStandardMaterial({ color: 0xffcf4a, roughness: 0.35, metalness: 0.1 }));
podium.position.y = -0.08; podium.receiveShadow = true; podium.castShadow = true; scene.add(podium);
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.025, 12, 80), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.15 }));
ring.rotation.x = Math.PI / 2; ring.position.y = 0.005; scene.add(ring);

let av = null, profile = savedProfile() || { name: '', look: null }, cat = 'body';
// personaggi sportivi: corpo, pelle, capelli, vestiti (vale per tutti i giochi)
const TABS = [['body', 'Corpo'], ['skin', 'Pelle'], ['hair', 'Capelli'], ['hairColor', 'Colore capelli'], ['beard', 'Barba'], ['shirt', 'Maglia'], ['shorts', 'Pantaloncini'], ['shoes', 'Scarpe']];
const ANIMS = [['Idle_Loop', '😐 Fermo'], ['Dance_Loop', '💃 Balla'], ['Yes', '👍 Sì!'], ['Idle_No_Loop', '🙅 No'], ['Jog_Fwd_Loop', '🏃 Corre'], ['OverhandThrow', '🎯 Lancia'], ['Punch_Cross', '🥊 Pugno'], ['Hit_Knockback', '😵 Colpito']];
let look = null;
function options(c) {
  if (c === 'body') return [['M', 'Uomo'], ['F', 'Donna']];
  if (c === 'beard') return [[false, 'No'], [true, 'Sì']];
  if (c === 'hair') return Object.entries(HAIRS);
  return null;
}
function swatches(c) { return c === 'skin' ? SKINS : c === 'hairColor' ? HAIR_COLORS : KIT; }
function rebuild(anim) {
  if (av) av.dispose();
  av = makeSportsmate(look, { height: 1.75 }); av.root.scale.multiplyScalar(1.25); scene.add(av.root);
  if (anim) av.play(anim, { once: true, then: 'Idle_Loop' });
}
loadSportLibrary(p => { $('#bar').style.width = (p * 100) + '%'; }).then(() => {
  look = profile.sport || randomSport();
  rebuild('Yes');
  $('#name').value = profile.name || '';
  $('#load').classList.add('hide'); $('#ui').classList.remove('hide');
  drawTabs(); drawOpts();
  $('#anims').innerHTML = ANIMS.map(([k, t]) => `<button class="an" data-an="${k}">${t}</button>`).join('');
});
function drawTabs() { $('#tabs').innerHTML = TABS.map(([k, t]) => `<button class="tab${k === cat ? ' sel' : ''}" data-cat="${k}">${t}</button>`).join(''); }
function drawOpts() {
  const cur = look[cat], o = options(cat);
  if (o) { $('#opts').innerHTML = o.map(([k, t]) => `<button class="opt${String(k) === String(cur) ? ' sel' : ''}" data-v="${k}">${t}</button>`).join(''); return; }
  const sw = swatches(cat);
  $('#opts').innerHTML = sw.map((c, i) => { const v = (cat === 'skin' || cat === 'hairColor') ? i : c; return `<button class="opt sw${String(v) === String(cur) ? ' sel' : ''}" data-v="${v}" style="background:${c}"></button>`; }).join('');
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !av) return;
  if (b.dataset.cat) { cat = b.dataset.cat; drawTabs(); drawOpts(); focus = ['hair', 'hairColor', 'beard', 'skin'].includes(cat) ? 1 : 0; }
  else if (b.dataset.v != null) {
    let v = b.dataset.v; if (cat === 'skin' || cat === 'hairColor') v = +v; if (cat === 'beard') v = v === 'true';
    look = { ...look, [cat]: v };
    if (['shirt', 'shorts', 'shoes', 'skin'].includes(cat)) av.setColors({ [cat]: v }); else rebuild('Yes');
    drawOpts();
  }
  else if (b.dataset.an) av.play(b.dataset.an, { once: !/Loop/.test(b.dataset.an), then: 'Idle_Loop' });
  else if (b.id === 'rnd') { look = randomSport(); rebuild('Dance_Loop'); drawOpts(); }
  else if (b.id === 'save') { profile = { ...profile, name: $('#name').value.trim().slice(0, 14) || 'Giocatore', sport: look, look: profile.look || null }; saveProfile(profile); toast('Salvato! Lo userai in tutti i giochi'); av.play('Yes', { once: true, then: 'Idle_Loop' }); }
});

// rotazione col dito
let drag = null, yaw = 0.35, focus = 0, fz = 0;
$('#gl').addEventListener('pointerdown', e => { drag = e.clientX; });
addEventListener('pointermove', e => { if (drag != null) { yaw += (e.clientX - drag) * 0.01; drag = e.clientX; } });
addEventListener('pointerup', () => drag = null);
let tt = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 1800); }

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (av) { av.update(dt); if (drag == null) yaw += dt * 0.15; av.root.rotation.y = yaw; }
  fz += (focus - fz) * Math.min(1, dt * 4);
  const portrait = innerHeight > innerWidth;
  const d = (portrait ? 9.2 : 6.8) - fz * 3.6, y = 0.95 + fz * 1.0;
  const ox = portrait ? 0 : -0.9 * (1 - fz * 0.4); camera.position.set(ox, y + 0.5, d); camera.lookAt(ox, y - (portrait ? 1.2 : 0), 0);
  composer.render();
}
requestAnimationFrame(frame);

// ritorno alla pagina di provenienza (es. il telecomando sul telefono)
{ const ret = new URLSearchParams(location.search).get('ret'); if (ret && /^[\w.\-\/?=&%:]+$/.test(ret) && !ret.includes('//')) { const b = document.querySelector('#back'); b.href = ret; b.textContent = '← Indietro'; } }
