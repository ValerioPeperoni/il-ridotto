// Birilli e piazzola: fisica a corpi rigidi con cannon-es.
import * as CANNON from 'cannon-es';
import { L, pinSpots } from './lane.js';

export const PIN = { h: 0.381, mass: 1.53, com: 0.145 };

export function createDeck() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.allowSleep = true;
  world.solver.iterations = 14;
  world.broadphase = new CANNON.SAPBroadphase(world);
  const mLane = new CANNON.Material('lane'), mPin = new CANNON.Material('pin'), mBall = new CANNON.Material('ball'), mWall = new CANNON.Material('wall');
  world.addContactMaterial(new CANNON.ContactMaterial(mPin, mPin, { friction: 0.3, restitution: 0.52 }));
  world.addContactMaterial(new CANNON.ContactMaterial(mPin, mLane, { friction: 0.4, restitution: 0.15 }));
  world.addContactMaterial(new CANNON.ContactMaterial(mBall, mPin, { friction: 0.12, restitution: 0.62 }));
  world.addContactMaterial(new CANNON.ContactMaterial(mBall, mLane, { friction: 0.2, restitution: 0.05 }));
  world.addContactMaterial(new CANNON.ContactMaterial(mPin, mWall, { friction: 0.3, restitution: 0.3 }));
  world.addContactMaterial(new CANNON.ContactMaterial(mBall, mWall, { friction: 0.1, restitution: 0.3 }));
  const fixed = (shape, x, y, z, mat) => { const b = new CANNON.Body({ mass: 0, material: mat }); b.addShape(shape); b.position.set(x, y, z); world.addBody(b); return b; };
  const deckLen = L.deckStart - L.deckEnd + 0.4, deckZ = (L.deckStart + L.deckEnd) / 2 + 0.2;
  const sideX = L.half + L.gutter + 0.06;
  // piazzola (larga quanto pista + canali), fossa dietro e ai lati più in basso
  fixed(new CANNON.Box(new CANNON.Vec3(L.half, 0.05, deckLen / 2)), 0, -0.05, deckZ, mLane);
  for (const s of [-1, 1]) fixed(new CANNON.Box(new CANNON.Vec3(L.gutter / 2, 0.05, deckLen / 2)), s * (L.half + L.gutter / 2), -0.11, deckZ, mLane);
  fixed(new CANNON.Box(new CANNON.Vec3(1.5, 0.05, 1.2)), 0, -0.45, L.deckEnd - 1.15, mLane); // fossa
  for (const s of [-1, 1]) fixed(new CANNON.Box(new CANNON.Vec3(0.03, 0.5, 2.0)), s * sideX, 0.3, L.deckEnd + 0.4, mWall); // sponde laterali
  fixed(new CANNON.Box(new CANNON.Vec3(1.5, 0.6, 0.05)), 0, 0.2, L.deckEnd - 1.6, mWall); // tenda in fondo
  const pins = pinSpots().map(sp => {
    const b = new CANNON.Body({ mass: PIN.mass, material: mPin, allowSleep: true, sleepSpeedLimit: 0.08, sleepTimeLimit: 0.4, linearDamping: 0.03, angularDamping: 0.08 });
    const c = -PIN.com;
    b.addShape(new CANNON.Cylinder(0.058, 0.038, 0.12, 10), new CANNON.Vec3(0, 0.06 + c, 0));
    b.addShape(new CANNON.Cylinder(0.026, 0.058, 0.13, 10), new CANNON.Vec3(0, 0.185 + c, 0));
    b.addShape(new CANNON.Sphere(0.032), new CANNON.Vec3(0, 0.33 + c, 0));
    b.position.set(sp.x, PIN.com + 0.0005, sp.z); world.addBody(b); b.sleep();
    b.spot = sp; b.standing = true;
    return b;
  });
  return { world, pins, mBall, ball: null, t: 0 };
}

export function resetPins(deck, keep) {
  for (const p of deck.pins) {
    const stand = keep ? keep.includes(p.spot.n) : true;
    p.standing = stand; p.removed = !stand;
    if (stand) {
      // i birilli rimasti in piedi tornano dritti dove sono
      const x = keep ? p.position.x : p.spot.x, z = keep ? p.position.z : p.spot.z;
      p.position.set(x, PIN.com + 0.0005, z); p.quaternion.set(0, 0, 0, 1);
      p.velocity.setZero(); p.angularVelocity.setZero();
      if (!p.world) deck.world.addBody(p);
      p.sleep();
    } else if (p.world) deck.world.removeBody(p);
  }
}

// La palla arriva sulla piazzola: diventa un corpo rigido
export function launchBall(deck, b) {
  if (deck.ball) deck.world.removeBody(deck.ball);
  const body = new CANNON.Body({ mass: 6.8, material: deck.mBall, linearDamping: 0.01, angularDamping: 0.02 });
  body.addShape(new CANNON.Sphere(L.R));
  body.position.set(b.x, L.R + (b.gutter ? -0.06 : 0) + Math.max(0, b.y || 0), b.z);
  body.velocity.set(b.vx, b.air ? b.vy : 0, b.vz);
  body.angularVelocity.set(b.wx + (b.sx || 0), 0, b.wz + (b.sz || 0));
  deck.world.addBody(body); deck.ball = body; deck.t = 0; deck.acc = 0;
  for (const p of deck.pins) if (!p.removed) p.wakeUp(); // un birillo "addormentato" farebbe da muro
  return body;
}

// passi fissi; se il dispositivo è lento la scena rallenta invece di saltare pezzi di fisica
export function stepDeck(deck, dt, maxSteps = 14) {
  deck.acc = (deck.acc || 0) + dt; let n = 0;
  while (deck.acc >= 1 / 240 && n < maxSteps) { deck.world.step(1 / 240); deck.acc -= 1 / 240; deck.t += 1 / 240; n++; }
  if (n === maxSteps) deck.acc = 0;
}

export function knocked(deck) {
  const out = [];
  for (const p of deck.pins) {
    if (p.removed) continue;
    const up = p.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
    const moved = Math.hypot(p.position.x - p.spot.x, p.position.z - p.spot.z);
    const down = up.y < 0.82 || p.position.y < PIN.com - 0.05 || moved > 0.6;
    if (down) out.push(p.spot.n);
  }
  return out;
}

export function settled(deck) {
  if (deck.t < 1.2) return false;
  if (deck.t > 5.5) return true;
  const moving = deck.pins.some(p => !p.removed && p.sleepState !== CANNON.Body.SLEEPING && p.velocity.length() > 0.05);
  const ballGone = !deck.ball || deck.ball.position.z < L.deckEnd - 0.3 || deck.ball.velocity.length() < 0.2 || deck.ball.position.y < -0.2;
  return !moving && ballGone;
}
