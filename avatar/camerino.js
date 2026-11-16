// Camerino: scegli e personalizza il tuo personaggio (vale per tutti i giochi).
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { loadAvatarLibrary, makeAvatar, optionsFor, randomLook, CATS, HUES, savedProfile, saveProfile } from './avatar.js';
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

let av = null, profile = savedProfile() || { name: '', look: null }, cat = 'head';
const ANIMS = [['Idle', '😐 Fermo'], ['Cheer', '🙌 Esulta'], ['Taunt', '😜 Sfotti'], ['Throw', '🎯 Lancia'], ['Jump_Full_Short', '⤴ Salta'], ['Hit_A', '😵 Colpito'], ['Death_A', '💀 Crolla'], ['Walking_A', '🚶 Cammina'], ['Running_A', '🏃 Corre']];

loadAvatarLibrary(p => { $('#bar').style.width = (p * 100) + '%'; }).then(() => {
  if (!profile.look) profile.look = randomLook();
  av = makeAvatar(profile.look);
  scene.add(av.root);
  $('#name').value = profile.name || '';
  $('#load').classList.add('hide'); $('#ui').classList.remove('hide');
  drawTabs(); drawOpts();
  $('#anims').innerHTML = ANIMS.map(([k, t]) => `<button class="an" data-an="${k}">${t}</button>`).join('');
  av.play('Cheer', { once: true, then: 'Idle' });
});

function drawTabs() { $('#tabs').innerHTML = CATS.map(([k, t]) => `<button class="tab${k === cat ? ' sel' : ''}" data-cat="${k}">${t}</button>`).join(''); }
function drawOpts() {
  const cur = av.look[cat];
  if (cat === 'hue') { $('#opts').innerHTML = HUES.map((h, i) => `<button class="opt sw${i === (cur | 0) ? ' sel' : ''}" data-v="${i}" style="background:hsl(${Math.round(h * 360 + 210) % 360},70%,55%)"></button>`).join(''); return; }
  $('#opts').innerHTML = optionsFor(cat).map(([k, t]) => `<button class="opt${k === cur ? ' sel' : ''}" data-v="${k}">${t}</button>`).join('');
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !av) return;
  if (b.dataset.cat) { cat = b.dataset.cat; drawTabs(); drawOpts(); focus = cat === 'head' || cat === 'hat' ? 1 : 0; }
  else if (b.dataset.v != null) { const L = { ...av.look, [cat]: cat === 'hue' ? +b.dataset.v : b.dataset.v }; av.setLook(L); drawOpts(); av.play(cat === 'prop' ? 'Use_Item' : 'Interact', { once: true, then: 'Idle', fade: 0.15 }); }
  else if (b.dataset.an) av.play(b.dataset.an, { once: !/Idle|Walking|Running/.test(b.dataset.an), then: 'Idle' });
  else if (b.id === 'rnd') { av.setLook(randomLook()); drawOpts(); av.play('Taunt', { once: true, then: 'Idle' }); }
  else if (b.id === 'save') { profile = { name: $('#name').value.trim().slice(0, 14) || 'Giocatore', look: av.look }; saveProfile(profile); toast('Salvato! Lo userai in tutti i giochi'); av.play('Cheer', { once: true, then: 'Idle' }); }
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
  const d = (portrait ? 10.5 : 7.2) - fz * 3.2, y = 1.25 + fz * 0.75;
  const ox = portrait ? 0 : -0.9 * (1 - fz * 0.4); camera.position.set(ox, y + 0.5, d); camera.lookAt(ox, y - (portrait ? 1.2 : 0), 0);
  composer.render();
}
requestAnimationFrame(frame);
