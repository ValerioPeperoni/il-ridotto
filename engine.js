// ===== Motore blackjack (condiviso tra gioco e simulatore) =====
// Regole: 6 mazzi, il banco sta su ogni 17 (S17), blackjack paga 3:2,
// raddoppio su qualsiasi coppia di carte, raddoppio dopo divisione,
// divisione fino a 4 mani, assi divisi ricevono una carta sola,
// il banco controlla subito se ha blackjack (peek). Niente resa, niente assicurazione.
const BJ = (() => {
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const SUITS = ['♠','♥','♦','♣'];
  const VAL = [11,2,3,4,5,6,7,8,9,10,10,10,10];
  const rankOf = c => c % 13;
  const valOf = c => VAL[c % 13];
  const suitOf = c => Math.floor(c / 13) % 4;

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randomSeed() {
    try { const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0]; }
    catch (e) { return (Math.random() * 4294967296) >>> 0; }
  }

  class Shoe {
    constructor(decks = 6, rand = rng(randomSeed()), penetration = 0.75) {
      this.decks = decks; this.rand = rand; this.pen = penetration;
      this.cards = new Int16Array(decks * 52);
      for (let i = 0; i < this.cards.length; i++) this.cards[i] = i % 52;
      this.shuffle();
    }
    shuffle() {
      const a = this.cards, r = this.rand;
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      this.pos = 0;
    }
    draw() { if (this.pos >= this.cards.length) this.shuffle(); return this.cards[this.pos++]; }
    needsShuffle() { return this.pos >= this.cards.length * this.pen; }
    left() { return this.cards.length - this.pos; }
  }

  function handInfo(cards) {
    let t = 0, aces = 0;
    for (let i = 0; i < cards.length; i++) { const v = VAL[cards[i] % 13]; t += v; if (v === 11) aces++; }
    while (t > 21 && aces) { t -= 10; aces--; }
    return { total: t, soft: aces > 0 };
  }
  const isNatural = cards => cards.length === 2 && handInfo(cards).total === 21;
  const isPair = cards => cards.length === 2 && valOf(cards[0]) === valOf(cards[1]);

  // ---- Strategia base (6 mazzi, S17, DAS, senza resa) ----
  // Restituisce 'H' carta, 'S' stai, 'D' raddoppia, 'P' dividi.
  function basic(cards, upCard, canDouble, canSplit) {
    return basicWhy(cards, upCard, canDouble, canSplit)[0];
  }
  function basicWhy(cards, upCard, canDouble, canSplit) {
    const up = valOf(upCard);
    const upTxt = up === 11 ? 'un asso' : (up === 10 ? 'un 10' : 'un ' + up);
    const { total, soft } = handInfo(cards);
    if (canSplit && isPair(cards)) {
      const p = valOf(cards[0]);
      let split = false, why = '';
      switch (p) {
        case 11: split = true; why = 'Coppia di assi: si divide sempre. Due mani che partono da 11 sono oro.'; break;
        case 8: split = true; why = 'Coppia di 8: si divide sempre. 16 è la mano peggiore, due mani da 8 sono molto meglio.'; break;
        case 10: why = 'Coppia di figure: hai 20, non si rompe mai.'; break;
        case 5: why = 'Coppia di 5: non si divide, è un 10 e si gioca come tale.'; break;
        case 2: case 3: case 7: split = up <= 7; why = split ? `Coppia di ${p} contro ${upTxt}: dividi, il banco è debole.` : `Coppia di ${p} contro ${upTxt}: il banco è forte, non dividere.`; break;
        case 4: split = up === 5 || up === 6; why = split ? 'Coppia di 4 contro 5 o 6: dividi, il banco rischia di sballare.' : 'Coppia di 4: non si divide, gioca 8.'; break;
        case 6: split = up <= 6; why = split ? `Coppia di 6 contro ${upTxt}: dividi, il banco è debole.` : `Coppia di 6 contro ${upTxt}: non dividere.`; break;
        case 9: split = up <= 9 && up !== 7; why = split ? `Coppia di 9 contro ${upTxt}: dividi, 18 non basta e due mani da 9 sono migliori.` : (up === 7 ? 'Coppia di 9 contro un 7: stai, 18 batte il 17 probabile del banco.' : `Coppia di 9 contro ${upTxt}: stai su 18.`); break;
      }
      if (split) return ['P', why];
    }
    let a, why;
    if (soft && total >= 12 && total <= 21) {
      const s = `${total} morbido (con l'asso che vale 11)`;
      if (total >= 19) { a = 'S'; why = `${s}: stai, è già una mano forte.`; }
      else if (total === 18) {
        if (up >= 3 && up <= 6) { a = 'Ds'; why = `${s} contro ${upTxt}: raddoppia, il banco è debole e non puoi sballare.`; }
        else if (up <= 8) { a = 'S'; why = `${s} contro ${upTxt}: stai.`; }
        else { a = 'H'; why = `${s} contro ${upTxt}: chiedi carta, 18 perde spesso contro un banco forte e non rischi di sballare.`; }
      }
      else if (total === 17) { a = (up >= 3 && up <= 6) ? 'D' : 'H'; why = a === 'D' ? `${s} contro ${upTxt}: raddoppia.` : `${s}: chiedi carta, 17 da solo non vince quasi mai e l'asso ti protegge.`; }
      else if (total >= 15) { a = (up >= 4 && up <= 6) ? 'D' : 'H'; why = a === 'D' ? `${s} contro ${upTxt}: raddoppia.` : `${s}: chiedi carta, non puoi sballare.`; }
      else if (total >= 13) { a = (up === 5 || up === 6) ? 'D' : 'H'; why = a === 'D' ? `${s} contro ${upTxt}: raddoppia.` : `${s}: chiedi carta, non puoi sballare.`; }
      else { a = 'H'; why = `${s}: chiedi carta.`; }
    } else {
      const h = `${total} duro`;
      if (total <= 8) { a = 'H'; why = `${h}: chiedi carta, non puoi sballare.`; }
      else if (total === 9) { a = (up >= 3 && up <= 6) ? 'D' : 'H'; why = a === 'D' ? `9 contro ${upTxt}: raddoppia, il banco è debole.` : `9 contro ${upTxt}: chiedi carta.`; }
      else if (total === 10) { a = up <= 9 ? 'D' : 'H'; why = a === 'D' ? `10 contro ${upTxt}: raddoppia, sei tu in vantaggio.` : `10 contro ${upTxt}: chiedi carta, ma non raddoppiare.`; }
      else if (total === 11) { a = up <= 10 ? 'D' : 'H'; why = a === 'D' ? `11 contro ${upTxt}: raddoppia, è la mano migliore per farlo.` : '11 contro un asso: chiedi carta senza raddoppiare.'; }
      else if (total === 12) { a = (up >= 4 && up <= 6) ? 'S' : 'H'; why = a === 'S' ? `12 contro ${upTxt}: stai, lascia sballare il banco.` : `12 contro ${upTxt}: chiedi carta, sballi solo con una figura.`; }
      else if (total <= 16) { a = up <= 6 ? 'S' : 'H'; why = a === 'S' ? `${h} contro ${upTxt}: stai. Il banco deve tirare e sballa spesso.` : `${h} contro ${upTxt}: chiedi carta. Fa male, ma il banco arriverà quasi sicuramente a 17 o più.`; }
      else { a = 'S'; why = `${h}: stai sempre.`; }
    }
    if (a === 'D' && !canDouble) { a = 'H'; why += ' Non puoi raddoppiare, quindi chiedi carta.'; }
    if (a === 'Ds') { if (canDouble) a = 'D'; else { a = 'S'; why += ' Non puoi più raddoppiare, quindi stai.'; } }
    return [a, why];
  }

  // ---- Giocatori "umani" ----
  const STRATEGIES = {
    perfect: {
      name: 'Giocatore perfetto',
      short: 'Perfetto',
      desc: 'Segue la strategia base: per ogni combinazione la mossa con il risultato atteso migliore.',
      play: (c, up, cd, cs) => basic(c, up, cd, cs),
    },
    gut: {
      name: 'A sentimento',
      short: 'A sentimento',
      desc: 'Il classico giocatore della serata: chiede fino a 14, sta da 15 in su senza guardare il banco, raddoppia solo su 10 e 11, divide solo assi e 8.',
      play: (c, up, cd, cs) => {
        const u = valOf(up), { total, soft } = handInfo(c);
        if (cs && isPair(c) && (valOf(c[0]) === 11 || valOf(c[0]) === 8)) return 'P';
        if (cd && !soft && total === 11) return 'D';
        if (cd && !soft && total === 10 && u <= 9) return 'D';
        if (soft) return total >= 18 ? 'S' : 'H';
        return total >= 15 ? 'S' : 'H';
      },
    },
    nobust: {
      name: 'Non sballo mai',
      short: 'Prudente',
      desc: 'Ha paura di sballare: sta su qualsiasi 12 duro o più. Non raddoppia e non divide mai.',
      play: (c) => { const { total, soft } = handInfo(c); if (soft) return total >= 18 ? 'S' : 'H'; return total >= 12 ? 'S' : 'H'; },
    },
    mimic: {
      name: 'Imito il banco',
      short: 'Imita il banco',
      desc: 'Gioca come il banco: chiede fino a 16 e sta da 17. Sembra furbo, ma sballa per primo.',
      play: (c) => handInfo(c).total >= 17 ? 'S' : 'H',
    },
    coin: {
      name: 'Testa o croce',
      short: 'Casuale',
      desc: 'Lancia una moneta per decidere tra carta e stai (ma su 21 sta, non è scemo).',
      play: (c, up, cd, cs, r) => handInfo(c).total >= 21 ? 'S' : (r() < 0.5 ? 'H' : 'S'),
    },
  };

  // ---- Una mano completa, per il simulatore ----
  // Ritorna il risultato netto in unità di puntata. Aggiorna st (statistiche).
  function playRound(shoe, play, rand, st) {
    if (shoe.needsShuffle()) shoe.shuffle();
    const p0 = shoe.draw(), d0 = shoe.draw(), p1 = shoe.draw(), d1 = shoe.draw();
    const dealer = [d0, d1], up = d0;
    const pNat = isNatural([p0, p1]), dNat = isNatural(dealer);
    st.rounds++;
    if (dNat || pNat) {
      let net;
      if (dNat && pNat) { net = 0; st.push++; }
      else if (dNat) { net = -1; st.loss++; st.dealerBJ++; }
      else { net = 1.5; st.win++; st.playerBJ++; }
      st.net += net; st.sq += net * net; st.hands++;
      return net;
    }
    const hands = [{ cards: [p0, p1], bet: 1, need: false, aces: false }];
    for (let i = 0; i < hands.length; i++) {
      const h = hands[i];
      if (h.need) { h.cards.push(shoe.draw()); h.need = false; }
      if (h.aces) continue;
      for (;;) {
        const { total } = handInfo(h.cards);
        if (total >= 21) break;
        const two = h.cards.length === 2;
        const canSplit = two && isPair(h.cards) && hands.length < 4;
        const a = play(h.cards, up, two, canSplit, rand);
        if (a === 'S') break;
        if (a === 'H') { h.cards.push(shoe.draw()); continue; }
        if (a === 'D' && two) { h.bet *= 2; st.doubles++; h.cards.push(shoe.draw()); break; }
        if (a === 'P' && canSplit) {
          st.splits++;
          const isAce = valOf(h.cards[0]) === 11;
          const nh = { cards: [h.cards[1]], bet: h.bet, need: true, aces: isAce };
          h.cards = [h.cards[0], shoe.draw()];
          h.aces = isAce;
          hands.splice(i + 1, 0, nh);
          if (isAce) break;
          continue;
        }
        h.cards.push(shoe.draw()); // azione non valida: trattata come carta
      }
    }
    // Il banco gioca sempre qui (anche se il giocatore ha sballato) per poter
    // contare quante volte sarebbe sballato anche lui.
    while (handInfo(dealer).total < 17) dealer.push(shoe.draw());
    const dt = handInfo(dealer).total, dBust = dt > 21;
    if (dBust) st.dealerBust++;
    let net = 0;
    for (const h of hands) {
      const t = handInfo(h.cards).total;
      st.hands++;
      if (t > 21) { net -= h.bet; st.loss++; st.playerBust++; if (dBust) st.bothBust++; }
      else if (dBust || t > dt) { net += h.bet; st.win++; }
      else if (t < dt) { net -= h.bet; st.loss++; }
      else st.push++;
    }
    st.net += net; st.sq += net * net;
    return net;
  }
  const newStats = () => ({ rounds: 0, hands: 0, net: 0, sq: 0, win: 0, loss: 0, push: 0, playerBust: 0, dealerBust: 0, bothBust: 0, doubles: 0, splits: 0, playerBJ: 0, dealerBJ: 0 });

  return { RANKS, SUITS, VAL, rankOf, valOf, suitOf, rng, randomSeed, Shoe, handInfo, isNatural, isPair, basic, basicWhy, STRATEGIES, playRound, newStats };
})();

