## Aggiornamento operativo — 16/11/2026 (ChatGPT)

Questo aggiornamento prevale sulle istruzioni di branch e sulle priorità precedenti riportate più sotto.

- Ordine concordato: **Golf Caos → Ping pong → Bowling → Biliardo**. Non iniziare Liar's Bar senza parlarne prima con Valerio.
- Branch di lavoro attuale: `ai/golf-caos-phone-view`. `dev` è il successivo ramo d'integrazione; `main` e `gh-pages` restano pubblici e non vanno modificati senza approvazione esplicita.
- Golf Caos: è stata aggiunta la replica 3D individuale sui telefoni, con camera in terza persona dietro il proprio avatar, pallina/indicatore, snapshot dal PC a circa 15 Hz e fionda touch con direzione e potenza esplicite. Il PC resta autorità per la fisica.
- Sono stati corretti interpolazione e orientamento della camera, gestione delle risorse WebGL e chiusura della vista al cambio gioco/lobby. L'orientamento e il look vengono sincronizzati a ogni snapshot; questo evita che i telefoni che ricevono solo aggiornamenti successivi perdano la personalizzazione degli avatar.
- Verifiche locali: `node --check` sui moduli JavaScript, `python -m compileall` sui test Python, controllo statico degli import relativi, degli asset della scena telefono e degli ID HTML usati dal controller: superati.
- Limite non risolto: Chromium/Playwright in questo ambiente blocca la navigazione locale con `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Non sono stati verificati screenshot, gameplay end-to-end o telefoni reali. Non dichiarare il gioco pronto finché questi test non sono eseguiti.
- Nessuna modifica a `main` o `gh-pages`; il sito pubblico non è stato aggiornato.

---

# Il Ridotto: istruzioni per chi continua il lavoro (umano o AI)

Ultimo aggiornamento: 16/11/2026, scritto da Claude per poter passare il lavoro ad altre AI (ChatGPT, Qwen, ecc.).
Leggi tutto prima di toccare il codice. Rispondi a Valerio **in italiano**.

## 1. Chi è Valerio e come vuole lavorare
- Laureato in Fisica a Roma. È **alle prime armi con terminale, cartelle e Git**: il lavoro tecnico lo fai tu, a lui dai solo istruzioni brevi e semplici (cosa cliccare, cosa provare).
- Parla in modo diretto e colloquiale, spesso con la dettatura vocale (frasi spezzate). Vuole **giudizi onesti**, niente complimenti di circostanza.
- Prima di lavorare su un gioco vuole che tu **studi il gioco di riferimento** (immagini, video, recensioni) e ti avvicini a quello per colori, realismo, grafica, font, comandi. Non serve una copia identica, ma il riferimento va rispettato.
- Prova tutto lui su PC (scheda grafica integrata, tipo Intel Iris Xe) e su telefoni veri: **il gioco non deve laggare**.

## 2. Che cos'è il progetto
Una raccolta di giochi da festa nel browser. Il **PC o la TV** è lo schermo comune, i **telefoni** fanno da controller e si collegano inquadrando un QR. Niente account, niente installazioni.
- Sito: https://valeriopeperoni.github.io/il-ridotto/
- Repository: https://github.com/ValerioPeperoni/il-ridotto (branch ChatGPT: `ai/golf-caos-phone-view`; `dev` per integrazione; `main` e `gh-pages` per la versione pubblica. GitHub Pages pubblica `gh-pages`).
- Sito statico **senza passaggio di build**: HTML + moduli JS ES, three.js locale in `vendor/` con importmap (`three` → `vendor/three.module.js`, `three/addons/` → `vendor/jsm/`). three.js r160, cannon-es 0.20, PeerJS 1.5.4, qrcode.js.

### Pubblicare
```
git checkout dev && git add -A && git commit -m "..."
git checkout main && git merge --ff-only dev && git push origin main dev main:gh-pages && git checkout dev
```
Alla fine dei messaggi di commit Claude aggiungeva le righe di attribuzione; usa le tue.

## 3. Mappa dei file
| Cosa | File |
|---|---|
| Ingresso e lobby con le sale | `index.html` (contiene anche il tavolo di blackjack/Dubito: `table.js`, `chars.js`, `sfx.js`, `engine.js`, `play.html/js`, `scuola.html`) |
| Rete telefoni ↔ schermo | `net.js` (`hostRoom(code, {onOpen,onMsg,onClose,onError})`, `joinRoom`, `randomCode`; ID PeerJS = `ridotto1758-` + codice) |
| Controller del telefono (tutti i giochi) | `telecomando.html` + `telecomando.js` (schermate: join, wait, bowl, pong, golf, caos) |
| Camerino (avatar condiviso) | `avatar.html`, `avatar/camerino.js`, `avatar/avatar.js`, `avatar/costumes.js`, `avatar/stage.js` |
| Biliardo | `biliardo.html`, `pool/` (physics, rules, bot, looks, game) |
| Bowling (nuovo) | `bowling.html`, `bowling/main.js` (+ `lane.js`, `pins.js`, `score.js`); il vecchio è in `bowling_old.html` + `bowling/game.js` |
| Golf Caos (nuovo) | `golf.html`, `caos/main.js`, `caos/course.js`, `caos/nature.js`, `caos/fx.js` |
| Ping pong (vecchio, da rifare) | `pingpong.html`, `pong/` |
| Minigolf vecchio (sostituito da Golf Caos, non più linkato) | `minigolf.html`, `golf/` |
| Asset | `assets/avatar` (KayKit, CC0), `assets/furniture` (KayKit, CC0), `assets/nature` (Quaternius Stylized Nature MegaKit, CC0, texture ridotte a 512), `assets/hdr` (Poly Haven, CC0) |
| Strumenti e test | `sviluppo/` (vedi §7) |

### Avatar (`avatar/avatar.js`)
- `loadAvatarLibrary(onProgress)` carica 9 personaggi KayKit (stesso scheletro a 41 ossa) più `anims.glb`, che ha 47 animazioni: Idle, Idle_B, Running_A/B, Walking_A/B/C, Cheer, Taunt, Throw, Hit_A/B, Death_A/B, Jump_*, Sit_Chair_*, 1H/2H_Melee_Attack_*, 1H_Ranged_Aiming/Shoot, Spellcast_*, Dodge_*, Interact, PickUp, Use_Item, Block, Lie_Idle, Unarmed_*.
- `makeAvatar(look, {height})` restituisce `{root, bones, mixer, play(name,{once,then,fade,speed}), update(dt), setLook, dispose}`. Altezza base 2.45 unità.
- GLTFLoader toglie i punti dai nomi delle ossa: si scrivono `handslotr`, `upperarmr`, `lowerarmr`, `wristr`, `head`, `chest`, `hips`.
- Il "look" (`{costume, head, body, arms, legs, hat, cape, prop, hue}`) è salvato in `localStorage['ridotto-avatar'] = {name, look}`. Il telefono lo manda nel messaggio `join` (`look`).
- I costumi buffi (banana, hot dog, dinosauro, squalo, maiale, pollo, cactus) e i cappelli sono fatti a mano con forme semplici: **Valerio li trova rudimentali**, vanno rifatti meglio (modelli veri o più dettaglio).

## 4. Stato di ogni gioco e cosa vuole Valerio

### Biliardo (riferimento: 8 Ball Pool, ma in 3D)
Funziona: bot a 3 livelli, 2 giocatori, allenamento, online 1 contro 1, modalità Caos. È il gioco che gli piace di più.
Da fare:
1. Luci e colori meno saturi e meno forti.
2. Bomba piazzabile dove vuoi, con un'esplosione bella.
3. Poteri più "Mario Kart".
4. Regole: la 8 e la 15 vanno imbucate nelle buche centrali; la 1 va per ultima, dopo tutte le altre.
5. Modalità a 4 giocatori, a squadre.

### Bowling (riferimento: Nintendo Switch Sports)
Rifatto: sala serale con neon, avatar del camerino che lancia e diventa trasparente al tiro, replay degli strike, piste speciali uguali per tutti nello stesso frame, riflessi presi dalla sala stessa (il riflesso di un HDRI da studio creava dei "fari").
- Telefono: frecce ◀ ▶ per spostarsi; tieni premuto e fai il gesto, la palla parte da sola nel punto più basso; la direzione viene dal braccio, l'effetto dalla rotazione del polso. In alternativa "Effetto coi tasti".
- Feedback: l'effetto dal polso a volte viene letto al contrario. Va provato e tarato con un telefono vero; mostrare a schermo i numeri misurati aiuta.

### Golf Caos (riferimento: **Super Battle Golf**; potenza come Golf With Your Friends)
Fatto:
- Isola 3D generata (6 buche con fairway a strisce, green, bunker, laghetti, mare), natura Quaternius a istanze divise a blocchi.
- Tutti giocano insieme: si corre alla propria palla e si tira; il primo in buca prende più punti, più un bonus sul par.
- Casse "?" con razzo, bomba, gelo, fulmine, calamita, super tiro, mina. Mazzata a chi è vicino.
- Bot; telefono con levetta, tasto e oggetto.

Feedback del 16/11 e prossimi passi, **in ordine**:
1. **Vista sul telefono:** ogni telefono mostra la SUA telecamera, in terza persona dietro il suo avatar, con una freccia o un segnalino che porta alla sua palla. Il PC resta la vista comune che segue l'azione.
   - Implementazione consigliata: il telefono carica la stessa scena (moduli `caos/*`) in qualità bassa e riceve dal PC lo stato a ~15-20 Hz: posizioni, rotazioni e animazione di giocatori e palle, oggetti, esplosioni. Il PC resta l'arbitro della fisica.
   - Sul telefono: interpolazione tra gli stati ricevuti; la telecamera segue il proprio giocatore.
2. **FATTO (16/11 sera):** mira a fionda col mouse (clic sulla palla e trascina indietro: freccia a terra + puntini della traiettoria + cerchio d'atterraggio) e col telefono (tasto TIRA: trascina giù = potenza, di lato = mira). Preset grafica Leggera/Media/Bella nella sala (localStorage `ridotto-gfx`). Idea originale: fionda. Vicino alla palla trascini il dito (o il mouse) all'indietro: la direzione del trascinamento è la mira, la lunghezza è la potenza, e rilasciando tiri. Durante il trascinamento si vedono una grande freccia a terra e un cerchio sul punto di atterraggio previsto. Sul putt, una linea corta. Togliere la barra che va su e giù.
3. **Lag:** preset di qualità (bassa, media, alta) salvato in localStorage:
   - meno erba e fiori;
   - niente bloom;
   - ombre 1024 o spente;
   - risoluzione fissa a 1;
   - nebbia più vicina e meno alberi lontani;
   - LOD per gli alberi (lontano un albero semplificato o un billboard).

   Misurare con `renderer.info.render.triangles`.
4. Animazioni più curate: uno swing da golf vero (oggi si usa `1H_Melee_Attack_Slice_Horizontal`; si può fare a mano con le ossa o prendere la Universal Animation Library di Quaternius, che Valerio ha già), cadute e rialzi, esultanze.
5. Più caos alla Super Battle Golf: golf cart, oggetti nuovi, buche a tema, ostacoli che si muovono.

### Ping pong (riferimento: Switch Sports; il peggiore secondo Valerio, da rifare)
Da fare:
- Prima persona, senza spettatori.
- L'avatar dell'avversario non deve tremare.
- Battuta chiara.
- Pallina e scia più belle, interfaccia e font nuovi (Fredoka).
- Gesti col telefono buoni (colpo, pallonetto, taglio, schiacciata), ambiente più bello.
- Si può riusare la fisica in `pong/ball.js` (Magnus, rimbalzi).

### Liar's Bar rifatto
**Non iniziare senza averne parlato con Valerio.** Idea: prima persona su ogni telefono, lo schermo comune fa da regia, niente mazziere, personaggi animati.

### Blackjack e Dubito (il tavolo originale)
Funzionano. Usano ancora i vecchi personaggi con le maschere veneziane (`chars.js`); in futuro andrebbero passati agli avatar del camerino. `table.js` va modificato direttamente: il vecchio `build.py` non serve più.

## 5. Direzione grafica (vale per tutto)
- Stile cartoon curato, "bello ma non AAA", tipo Among Us, Fall Guys e Switch Sports. **Mai roba che sembri fatta di cubi.**
- Interfaccia: font Fredoka (`fonts.css`), card bianche arrotondate, colori `#3d7bff` blu, `#ffcf3a` giallo, `#ff5c9a` rosa, `#1d2340` inchiostro.
- Luci morbide, **non sparate e non sature**: controlla sempre gli screenshot cercando aloni e bagliori.
  - Tone mapping ACES o AgX.
  - Bloom basso, con soglia 1.0, solo su materiali emissivi.
  - Per i riflessi negli interni usa `PMREMGenerator.fromScene(scena)`, non un HDRI da studio.
- Asset gratuiti CC0: KayKit (GitHub KayKit-Game-Assets), Quaternius (Valerio li scarica e li manda), Poly Haven. Prima di copiarle nel sito, le texture vanno ridotte a 512 o 1024.
- Prestazioni: obiettivo 60 fps su Iris Xe.
  - InstancedMesh divise a blocchi con `computeBoundingSphere()`, così funziona il frustum culling.
  - Pixel ratio adattivo (già presente in bowling e golf).
  - Ombre solo dove servono.

## 6. Protocollo telefono ↔ schermo (`telecomando.js`)
- **Telefono → PC:**
  - `join {name, color, pid, look}`
  - bowling: `aim {x,a}`, `swing {th}`, `throw {power, hook, timing, pull}`, `spin {v}`
  - golf caos: `joy {x,y}`, `btn {on}`, `use`
- **PC → telefono:**
  - `hi {name, color, game}`, `full`, `kicked`, `end {text, score}`
  - bowling: `turn {yours, x, a, spin, frame, pins, spec}`, `res`
  - golf caos: `caos {phase, state, item, hole, strokes, score, color, near}`
- I telefoni funzionano al meglio sulla stessa rete Wi-Fi. Il server di segnalazione è quello pubblico di PeerJS; nei test se ne usa uno locale con `?peer=127.0.0.1:9000`.

## 7. Come provare (cartella `sviluppo/`)
- Server locale: `cd <sito> && python3 -m http.server 8123`. Server PeerJS locale: `node sviluppo/test/peerserver.cjs` (porta 9000).
- Test automatici con Playwright e Chrome (`--use-angle=swiftshader`):
  - `sviluppo/test/bw.py` gioca una partita di bowling coi bot e salva screenshot;
  - `gauto.py` fa lo stesso per Golf Caos;
  - `still.py` fa foto da una telecamera fissa (parametro `?cam=x,y,z,lx,ly,lz`).
- Parametri utili:
  - bowling: `?debug&auto=classica|speciale&frames=2`
  - golf: `?debug&auto&bots=3&lite&speed=6` (`lite` = senza natura e ombre, `speed` = simulazione accelerata)
- **Prima di pubblicare:**
  - nessun errore in console;
  - una partita completa giocata dai bot;
  - screenshot guardati davvero (luci, inquadrature, niente oggetti che coprono la vista);
  - prova del telefono con due pagine (schermo + telecomando).

## 8. Errori già fatti, da non ripetere
- I riflessi di un HDRI da studio su materiali lucidi fanno aloni enormi ("fari"): negli interni usa `fromScene`.
- Una cupola del cielo più grande del far plane della telecamera viene tagliata e si vede nero: la cupola deve seguire la telecamera.
- Le InstancedMesh con `frustumCulled = false` disegnano tutto e fanno laggare.
- Il primo `dt` di `requestAnimationFrame` può essere negativo: limitalo tra 0 e 0.05.
- Un bot che preme un tasto nello stesso istante in cui smette di mirare può far partire un'azione diversa: controlla lo stato prima di agire.
- Il gesto del telefono va tarato su un telefono vero: mostra a schermo i valori misurati e lascia gli interruttori "al contrario".
