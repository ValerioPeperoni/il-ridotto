// Regole dell'8-ball (versione da bar, vicina a quelle internazionali).
export const isSolid = id => id >= 1 && id <= 7;
export const isStripe = id => id >= 9 && id <= 15;
export const groupOf = id => isSolid(id) ? 'piene' : isStripe(id) ? 'rigate' : id === 8 ? 'otto' : 'bianca';

export function newMatch(names, opts = {}) {
  return {
    names, turn: opts.first ?? 0, groups: [null, null], open: true, breakShot: true,
    ballInHand: true, kitchen: true, winner: null, shots: 0, fouls: [0, 0], practice: !!opts.practice, casa: !!opts.casa,
  };
}

export function remaining(balls, group) {
  return balls.filter(b => b.on && groupOf(b.id) === group).length;
}
// Palle che il giocatore può colpire per prime
export function legalTargets(m, balls, p = m.turn) {
  if (m.practice) return balls.filter(b => b.on && b.id !== 0).map(b => b.id);
  if (m.open) return balls.filter(b => b.on && b.id !== 0 && b.id !== 8).map(b => b.id);
  const g = m.groups[p];
  if (remaining(balls, g) === 0) return [8];
  return balls.filter(b => b.on && groupOf(b.id) === g).map(b => b.id);
}

// Analizza il colpo e aggiorna lo stato. Restituisce { foul, reason, msg, keep, end }
export function judge(m, balls, events) {
  const p = m.turn, o = 1 - p, legal = legalTargets(m, balls.map(b => ({ ...b, on: b.on || events.some(e => e.t === 'pot' && e.a === b.id) })), p);
  const firstHit = events.find(e => e.t === 'ball' && (e.a === 0 || e.b === 0));
  const first = firstHit ? (firstHit.a === 0 ? firstHit.b : firstHit.a) : null;
  const potted = events.filter(e => e.t === 'pot').map(e => e.a);
  const scratch = potted.includes(0);
  const firstTime = firstHit ? firstHit.time : Infinity;
  const railAfter = events.some(e => e.t === 'rail' && e.time > firstTime);
  const wasBreak = m.breakShot;
  const groupBefore = m.groups[p];
  const clearedBefore = !m.open && groupBefore && legal.length === 1 && legal[0] === 8;
  let foul = false, reason = '';
  if (m.practice) {
    m.shots++; m.ballInHand = scratch; m.breakShot = false; m.kitchen = false;
    return { foul: scratch, reason: scratch ? 'Bianca in buca' : '', keep: true, potted, end: false };
  }
  if (scratch) { foul = true; reason = 'Bianca in buca'; }
  else if (first == null) { foul = true; reason = 'Non hai toccato nessuna palla'; }
  else if (!legal.includes(first)) { foul = true; reason = first === 8 ? 'Hai colpito prima l\'8' : 'Hai colpito prima una palla dell\'avversario'; }
  else if (!wasBreak && potted.length === 0 && !railAfter) { foul = true; reason = 'Nessuna palla in buca e nessuna sponda dopo il tocco'; }

  // regole della casa: l'8 e la 15 solo nelle buche centrali; l'1 è l'ultima delle piene
  const respot = [];
  if (m.casa && !wasBreak) {
    const side = id => events.some(e => e.t === 'pot' && e.a === id && (e.pocket === 1 || e.pocket === 4));
    if (potted.includes(15) && !side(15)) { respot.push(15); if (!foul) { foul = true; reason = 'La 15 va nelle buche centrali'; } }
    if (potted.includes(1)) {
      const othersBefore = balls.filter(b => (b.on || potted.includes(b.id)) && b.id >= 2 && b.id <= 7 && !potted.includes(b.id)).length;
      if (othersBefore > 0) { respot.push(1); if (!foul) { foul = true; reason = "L'1 va imbucata per ultima tra le piene"; } }
    }
    if (potted.includes(8) && !side(8) && clearedBefore && !foul) { m.winner = o; m.shots++; return { foul: true, keep: false, potted, end: true, msg: `L'8 va nelle buche centrali: vince ${m.names[o]}` }; }
  }
  m.shots++; m.breakShot = false; m.kitchen = false;
  // l'8 in buca
  if (potted.includes(8)) {
    if (wasBreak) {
      return { foul, reason, respot8: true, keep: !foul, potted, end: false, msg: 'L\'8 in buca sul colpo d\'apertura: torna sul dischetto' };
    }
    if (!foul && clearedBefore) { m.winner = p; return { foul: false, keep: false, potted, end: true, msg: `${m.names[p]} manda l'8 in buca e vince!` }; }
    m.winner = o;
    return { foul: true, keep: false, potted, end: true, msg: foul ? `8 in buca con fallo (${reason.toLowerCase()}): vince ${m.names[o]}` : `L'8 in buca troppo presto: vince ${m.names[o]}` };
  }
  // assegnazione dei gruppi
  let assigned = null;
  if (m.open && !wasBreak && !foul) {
    const f = potted.find(id => id !== 0 && id !== 8);
    if (f != null) { const g = groupOf(f); m.groups[p] = g; m.groups[o] = g === 'piene' ? 'rigate' : 'piene'; m.open = false; assigned = g; }
  }
  let keep = false;
  if (!foul) {
    if (wasBreak) keep = potted.some(id => id !== 0);
    else if (m.open) keep = false;
    else keep = potted.some(id => groupOf(id) === m.groups[p]);
  }
  if (foul) m.fouls[p]++;
  if (!keep) m.turn = o;
  m.ballInHand = foul;
  let msg = '';
  if (foul) msg = `Fallo: ${reason}. Palla in mano a ${m.names[o]}`;
  else if (assigned) msg = `${m.names[p]} gioca le ${assigned}`;
  return { foul, reason, keep, potted, end: false, msg, assigned, respot };
}
