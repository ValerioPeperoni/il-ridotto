# Il Ridotto: istruzioni per chi continua il lavoro (umano o AI)

Ultimo aggiornamento: 16/11/2026, scritto da Claude per poter passare il lavoro ad altre AI (ChatGPT, Qwen, ecc.).
Leggi tutto prima di toccare il codice. Rispondi a Valerio **in italiano**.

## 1. Chi è Valerio e come vuole lavorare
- Laureato in Fisica a Roma. È **alle prime armi con terminale, cartelle e Git**: il lavoro tecnico lo fai tu, a lui dai solo istruzioni brevi e semplici (cosa cliccare, cosa provare).
- Parla in modo diretto e colloquiale, spesso con la dettatura vocale (frasi spezzate). Vuole **giudizi onesti**, niente complimenti di circostanza.
- Prima di lavorare su un gioco vuole che tu **studi il gioco di riferimento** (immagini, video, recensioni) e ti avvicini a quello per colori, realismo, grafica, font, comandi. Non serve una copia identica, ma il riferimento va rispettato.
- Prova tutto lui su PC (scheda grafica integrata, tipo Intel Iris Xe) e su telefoni veri: **il gioco non deve laggare**.

## 1b. Strategia per arrivare alla qualità di Switch Sports (17/11)
Valerio vuole giochi che "facciano venire voglia di giocare" come Switch Sports, non prototipi. Non serve chiedergli feedback su estetica, animazioni, fisica: si lavora e basta; il suo feedback serve solo per i comandi col telefono.
1. **Personaggi stile Sportsmate**: passare dagli avatar KayKit (cavalieri/scheletri) agli Universal Base Characters di Quaternius (umani stilizzati, maschio/femmina, capelli, già nell'upload di Valerio) con la Universal Animation Library 1+2 (stesso scheletro: Idle, Jog, Sprint, Dance, Hit, Death, OverhandThrow, Sword…). Vestiti e colori via texture/tinte. Le animazioni sportive che mancano (swing da golf, lancio bowling, dritto/rovescio ping pong, esultanze) vanno create a mano: piccolo strumento JS che scrive clip a keyframe sulle ossa del rig.
2. **Ambienti**: modellare meglio con asset CC0 (Quaternius, KayKit, Kenney), materiali PBR leggeri, luci cotte (lightmap/AO finti con texture), riflessi da `fromScene`, post-processing leggero (SSAO no, troppo pesante; vignettatura, color grading).
3. **Comandi**: conta l'inizio del gesto (fatto nel ping pong), finestre generose, mira automatica dove serve; Joy-Con via WebHID per chi gioca sul PC.
4. **Prestazioni**: preset grafica, istanze, niente luci aggiunte a runtime (fanno ricompilare tutti i materiali: è la causa dei blocchi di secondi), effetti precompilati al caricamento.

**Stato 17/11 notte:** `avatar/sport.js` funziona (prova: `sporttest.html?clips=Idle_Loop,Sprint_Loop,OverhandThrow,Sword_Regular_A`). `loadSportLibrary()`, `makeSportsmate(look,{height})`, `randomSport()`; look = {body M/F, skin 0-5, hair, hairColor, beard, shirt, shorts, shoes}. Vestiti = colori per vertice (attributo `aOutfit` dalle ossa: maglia/pantaloncini/scarpe) con stoffa leggermente gonfiata. Asset in `assets/sport/` (UAL1+UAL2 senza mesh, 86 animazioni; corpi e capelli con texture ridotte). Ossa stile Unreal: `hand_r`, `lowerarm_r`, `upperarm_r`, `Head`, `spine_03`, `pelvis`. FATTO: camerino nuovo (corpo, pelle, capelli, barba, maglia/pantaloncini/scarpe; profilo `sport` in localStorage, il telefono lo manda nel join come `sport`), integrazione in bowling, ping pong (racchetta in `hand_r`, dritto Sword_Regular_A / rovescio Sword_Regular_B), golf (PC e telefono; mazza in `hand_r` ruotata π su x). `ALIAS` in sport.js traduce i vecchi nomi di animazione KayKit. Prossimo: clip sportive fatte a mano, scarpe vere, costumi buffi agganciati alle nuove ossa, ambienti.

## 1c. Feedback di Valerio del 18/11 e cosa è stato fatto quella notte
Valerio ha provato tutto: meglio di prima, ma ancora "da beta". Le sue richieste, e lo stato:
- **Ping pong.** Palla che "rimbalzava su muri invisibili" e veniva colpita a metà tavolo. Causa: il punto di colpo previsto poteva cadere sopra il tavolo. FATTO: `planReceive` sceglie un punto dietro la fine del tavolo (o sporgendosi sul bordo per le palle corte, altrimenti palla imprendibile); gli avatar si muovono anche avanti/indietro (`a.z`), la telecamera in prima persona li segue; ogni colpo viene controllato con `predict` e allungato se non arriverebbe all'avversario; niente reti involontarie. Dritto/rovescio decisi quando parte il colpo avversario (`G.ideal.side`): prima il personaggio si spostava sempre per prendere di dritto. Anticipo = incrociato, ritardo = lungolinea (al contrario col rovescio). Battuta che cambia con forza (profondità e velocità), anticipo/ritardo (angolo), rotazione del polso (effetto laterale), gesto verso il basso (taglio). I dettagli del gesto che arrivano dopo il colpo (Wi-Fi) correggono la traiettoria appena partita (`G.lastHit`, `h.re`). Il computer sbaglia a volte (`miss`: lunga, larga, rete). Animazioni varie (Sword_Regular_A/C dritto, B rovescio, OverhandThrow schiacciata). Sul telefono: quando batti, tutta la racchetta diventa gialla "TOCCA QUI per lanciare". Prova senza grafica: `pingpong.html?debug&auto&pts=7&fast&norender` e leggi `__G.log`.
- **Telefono con file vecchi in memoria.** `telecomando.js` legge `build.txt` e, se la versione è diversa dalla sua `BUILD`, si ricarica. Prima di pubblicare: `python3 sviluppo/tools/stamp.py <cartella sito>` (aggiorna `?v=`, `BUILD` e `build.txt`).
- **Bowling.** "Non lancia, devi provare 3-4 volte", "sempre 39 km/h", "l'effetto non segue il braccio". FATTO in `telecomando.js`: il verso del gesto si decide dal primo tratto ampio (non dal primo tremolio); si lancia nel punto più basso, cioè quando la velocità in avanti smette di crescere; potenza = picco della velocità angolare (2.2→8.5 rad/s per 0→100%); asse del braccio stimato da gravità + forza centripeta nel tratto veloce, così direzione (rotazione di lato) ed effetto (rotazione attorno al braccio) non dipendono da come tieni il telefono. Birilli rifatti col profilo regolamentare (spline, laccati, due strisce rosse e corona). Setter e rastrello con bordi arrotondati e metallo. **Da tarare su telefono vero.** Ancora da fare: animazioni del lancio, ambiente.
- **Golf.** FATTO: col tasto viola (fionda) la levetta e il trascinamento girano ancora la mira; la palla non schizza più in aria sulla buca (entra se rotola sotto 6 m/s o se ci cade dall'alto; altrimenti sfiora e devia; un leggero imbuto attira le palle lente); chi ha finito resta in gioco (corre, prende casse, usa poteri, dà e prende mazzate, ogni colpo vale un punto; i bot che hanno finito vanno a dare fastidio); via il super tiro, nuovi poteri: 🍌 banana (chi la pesta scivola, le palle deviano), 🍄 gigante (8 s, travolgi chi tocchi, immune), 🔄 scambio (la tua palla si scambia con quella più vicina alla buca). Bandiera di stoffa che sventola nello shader, asta a strisce, colonna di luce e alone sulla buca corrente. Razzo a cartone (corpo tornito, alette, oblò, fiamma). Arredo (`caos/props.js`): club house con veranda, insegna e parcheggio (KayKit City Builder Bits, CC0, `assets/city/`), a ogni tee cartello con numero/par/metri, lava-palline, cestino, panchina e golf cart. `propZones()` dice a `loadNature` dove non piantare alberi, così PC e telefono mettono tutto negli stessi punti.
- **Domanda di Valerio: perché le demo AI sembrano giochi commerciali e i nostri no?** Risposta data: le demo sono una scena sola con asset di artisti e scelte tra tanti tentativi; noi facciamo 5 giochi insieme con controlli via rete; Claude li vede solo da screenshot lenti. Proposte: un gioco alla volta fino a "finito"; animazioni da motion capture (Mixamo, Valerio le scarica con un account Adobe); modelli veri (Kenney Minigolf Kit, Quaternius) e generatori 3D con AI per oggetti specifici.

## 1d. 22/11: metodo nuovo e cosa è stato fatto
**Metodo concordato con Valerio:** un gioco alla volta, con la lista completa di cosa manca, finito e controllato prima di passare al successivo. Ordine: ping pong → golf → bowling. Non aspettare che sia lui a scoprire i problemi: cercali (registrazioni, controlli automatici, confronto coi giochi di riferimento).

**Strumenti nuovi (in `sviluppo/tools/`):**
- **Partite registrate:** `pingpong.html` e `golf.html` accettano `?rec`. Il gioco non usa l'orologio e avanza a passi fissi con `window.__adv(n)`. Con `&norender` non disegna e va velocissimo; con `&trace` il ping pong salva ogni passo della palla in `__G.trace`. In registrazione i ritardi passano da `later()`, che segue il tempo del gioco. `registra_partita.py URL fotogrammi cartella ogni` salva i fotogrammi; poi `montage` (ImageMagick) li mette in un foglio da guardare.
- **Controllo delle traiettorie:** `controlla_traiettorie.py trace.json` segnala i cambi di velocità senza colpo o rimbalzo e la palla ferma a mezz'aria.
- **Blender senza schermo:** `pip install bpy` funziona nella macchina di Claude, per bake di luci, conversioni e modelli.
- **Animazioni Mixamo:** `retarget.html` (si apre con un server locale che vede `site/` e `npm/three`) carica un FBX di Mixamo e lo adatta al nostro scheletro copiando le rotazioni rispetto alla posa di riposo. Le dita sono incluse. Salva un JSON di `AnimationClip`, che `avatar/sport.js` carica da `assets/sport/` (lista `EXTRA`). Così sono fatti `Golf_Drive` e `Golf_Drive_B`, scaricati da Valerio. Per il bowling e il ping pong Mixamo non ha niente.

**Ping pong:**
- **Il bug dei "muri invisibili":** la palla veniva colpita a circa 1 m dalla racchetta (misurato) perché il fendente da spada non passa dove passa la palla.
- **Braccio guidato:** ora il braccio con la racchetta è guidato da `pong/arm.js`, con cinematica inversa a due ossa, orientamento della mano e piegamento del busto se la palla è bassa. Il percorso (preparazione → impatto → accompagnamento) è in `STROKE` di `game.js`, nel sistema del corpo. All'impatto la testa della racchetta è sulla palla: errore medio 10 cm su 107 colpi.
- **Posizione del giocatore:** il personaggio si piazza con `placeFor()` usando `CONTACT`. L'impatto è controllato a ogni passo della fisica (`t0 + n/480`), non a ogni fotogramma.
- **Correzione a metà volo:** tolta.
- **Gesto dal telefono:**
  - `sw0` porta `dir` (+1 dritto = racchetta da destra a sinistra, cioè rotazione antioraria attorno alla verticale; −1 rovescio);
  - `sw1`, 50 ms dopo, porta forza, su/giù, polso e verso, e arriva prima dell'impatto;
  - verso sbagliato = colpo a vuoto (`G.strict`);
  - un solo tentativo per palla, finestra `HIT_EARLY` 0.45 s;
  - sul telefono c'è il tasto "Dritto e rovescio al contrario?" (`ridotto-pongflip`).
- **Palazzetto:** tabellone col punteggio sul muro, ombre morbide finte, riflessi da `fromScene`, seggiolone dell'arbitro.
- **Da fare:** facce e personaggi più belli, gambe che si spostano di lato invece di correre in avanti, prima persona del telefono.

**Golf:**
- **Swing vero:** è `Golf_Drive_B`. Mentre carichi il personaggio va indietro col bastone in proporzione alla potenza (`golfPose`). Quando tiri, la palla parte all'istante dell'impatto (`SWING.impact` 1.17 s di clip) tramite `pendingShot` e `fireShot`. Durante lo swing si sta fermi.
- **Poteri:** via la banana (era uguale alla mina). Il gigante ora si vede anche sul telefono (bit 128 nei flag del `cv`).
- **Rete e telefono:**
  - **Mazzate perse:** i tocchi brevissimi non si perdono più (`input.press`).
  - **Oggetti in corsa:** il tasto oggetto usa `pointerdown`, perché il `click` non arriva mentre un altro dito è sulla levetta.
  - **Zoom:** niente zoom con due dita o doppio tocco; se scatta, si rimette a posto.
- **Buca:** palla quasi ferma entro 1.7 raggi della buca = dentro, subito.
- **Mazzate equilibrate:** dopo una mazzata si è intoccabili per 2.5 s (il personaggio lampeggia); chi ha finito tramortisce per meno tempo; i punti si danno solo se il colpo va a segno (`knock` restituisce true o false).
- **Terreno (rifatto `assets/terrain.jpg` con `/tmp/bake.py`):**
  - fairway a scacchi;
  - roccia sui pendii ripidi;
  - sabbia bagnata sulla riva;
  - bordo dei bunker;
  - conche più scure;
  - sottobosco;
  - sentieri.

**Bowling:**
- **Fossa aperta:** la pista finisce a `L.deckEnd`, dietro c'è la fossa aperta (fondo a −0.4, tenda), così palla e birilli non spariscono più "dentro il pavimento".
- **Birilli:** tolto lo sheen dal materiale (pesante).
- **Da fare:** grafica della sala, animazioni del lancio, lancio che a volte non parte.

## 1e. 23/11 notte: personaggi nuovi, ping pong, bowling
- **Personaggi (tutti i giochi):** costruiti da zero con `sviluppo/charbuild/build.py` (Python + numpy + scikit-image + bpy).
  - **Forme:** capsule ed ellissoidi uniti in modo morbido (SDF), marching cubes, decimazione e lisciatura in Blender.
  - **Pesi:** calcolati sulle ossa dello scheletro Quaternius (`rig.py` legge il gltf), con la spalla che segue in parte la clavicola.
  - **Uscita:** `assets/sport/sportsmates.json` (base64): corpo, scarpe, mani (dita vere), testa con UV per la faccia, 7 capigliature (`short`, `spiky`, `bob`, `ponytail`, `buns`, `afro`, `long`) + barba, varianti M e F.
  - **In `avatar/sport.js`:** `makeStylized()` clona sempre lo scheletro M e lega le mesh alla sua `Skeleton`, quindi tutte le animazioni UAL e i JSON Mixamo funzionano.
  - **Colori:** materiale `smMaterial` per zone. Pelle, maglia, pantaloncini, scarpe e suola sono pesi per vertice (`aR1`, `aR2`); gli orli di maniche, pantaloncini, girovita e colletto sono decisi pixel per pixel dall'attributo `aLim` (tipo di parte + posizione lungo l'osso), con bordino `uTrim`. C'è una luce di contorno morbida (`uRim`).
  - **Faccia:** disegnata su tela per ogni personaggio (occhi grandi con riflessi, sopracciglia del colore dei capelli, guance, bocca), con tre tele: aperta, chiusa (sbatte le palpebre) e `happy` (`av.mood('happy', sec)`).
  - **Compatibilità:** i vecchi nomi dei capelli sono tradotti con `OLD_HAIR`; `opts.classic` riporta ai personaggi Quaternius.
- **Ping pong:**
  - **Gambe:** guidate da `makeLegs` in `pong/arm.js`. I piedi restano appoggiati e fanno passi laterali quando il corpo scivola, con il ginocchio in avanti.
  - **Braccio sinistro:** in posa pronta (`makeFreeArm`).
  - **Animazione di base:** `Idle_Loop`.
  - **Dopo il punto:** reazioni `Yes`/`Dance_Loop` (vincitore, faccia felice) e `Idle_No_Loop`/`Hit_Chest` (chi perde).
  - **Prima persona:** telecamera più vicina al tavolo, fov 50.
  - **Palazzetto:** listelli di legno, fasce colorate, festoni, stendardi.
- **Bowling:**
  - **Sala:** diurna, luminosa e sportiva (pareti a listelli con finestre, plafoniere, festoni, murale col cielo, moquette blu).
  - **Riflessi:** veri sulla pista principale con `Reflector` + shader `LANE_REFL` (fresnel, trasparente). Si spengono con `?norefl` e sui telefoni.
  - **Lancio:** procedurale in `deliveryPose()`: piedi con IK (`makeLegs`), rincorsa da z 1.25 a 0.3, scivolata sul piede sinistro con la destra indietro, busto in avanti, braccio da `G.swingFrom` a 1.9 rad, ritorno in piedi dopo 1.7 s. Il personaggio diventa semitrasparente (0.45) solo dopo il rilascio.
  - **Registrazione:** `?rec` come negli altri giochi.

## 2. Che cos'è il progetto
Una raccolta di giochi da festa nel browser. Il **PC o la TV** è lo schermo comune, i **telefoni** fanno da controller e si collegano inquadrando un QR. Niente account, niente installazioni.
- Sito: https://valeriopeperoni.github.io/il-ridotto/
- Repository: https://github.com/ValerioPeperoni/il-ridotto (Valerio vuole rinominarlo "giochi": dalle impostazioni di GitHub, il proxy di Claude non può farlo; poi il sito diventa /giochi/) (rami: `dev` per il lavoro, `main` e `gh-pages` per la versione pubblica; GitHub Pages pubblica `gh-pages`).
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
| Ingresso "Giochi" | `index.html` (scelta del gioco) |
| Il Ridotto: blackjack e Dubito | `ridotto.html` (+ `table.js`, `chars.js`, `sfx.js`, `engine.js`, `play.html/js`, `scuola.html`) |
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
**16/11 notte:** luci più morbide (riflessi da una stanza scura con due lampade calde invece di RoomEnvironment, bloom 0.14 soglia 1.0, esposizione 0.88), colori delle palle meno saturi, opzione "Regole della casa" (`CFG.casa`, rules.js, confermate da Valerio): piene 2-8, rigate 9-15, in qualsiasi ordine; l'8 e la 15 solo nelle buche centrali (pocket 1 e 4, altrimenti fallo e tornano sul dischetto); l'1 non si tocca finché non hai finito le tue: è la palla finale (`FINAL()`), come l'8 nel classico.
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
1. **FATTO (16/11 sera, Claude, provato con schermo + telefono simulati):** `caos/world.js` (mondo condiviso), `caos/phone-view.js` (scena sul telefono, terza persona, segnalino e freccia a bordo schermo verso la palla, freccia di mira e cerchio d'arrivo, effetti replicati). Messaggi: join `wantView`, PC→tel `cvl` (look e casse a ogni buca), `cv` (stato 15 Hz: P=[x,y,z,yaw,clip,clipN,bx,by,bz,flags,aim,charge,lx,lz,item]), `cfx` (boom/splash/light/beam/cup); tel→PC `joy` con `cy` = yaw della telecamera del telefono. Da tarare su telefono vero. Idea originale: **Vista sul telefono:** ogni telefono mostra la SUA telecamera, in terza persona dietro il suo avatar, con una freccia o un segnalino che porta alla sua palla. Il PC resta la vista comune che segue l'azione.
   - Implementazione consigliata: il telefono carica la stessa scena (moduli `caos/*`) in qualità bassa e riceve dal PC lo stato a ~15-20 Hz: posizioni, rotazioni e animazione di giocatori e palle, oggetti, esplosioni. Il PC resta l'arbitro della fisica.
   - Sul telefono: interpolazione tra gli stati ricevuti; la telecamera segue il proprio giocatore.
2. **Aggiornato (16/11 notte):** sul telefono si mira trascinando il dito di lato in un punto libero dello schermo (messaggio `turn {d}`, nessun limite di rotazione, la telecamera segue), la potenza col tasto TIRA tenuto e trascinato giù con barra a 4 tacche. Il terreno è un'immagine già pronta (`assets/terrain.jpg`, rigenerabile con `terrainTexture(true)`) e la visuale del telefono si carica già in sala, più leggera. Prima: mira a fionda col mouse (clic sulla palla e trascina indietro: freccia a terra + puntini della traiettoria + cerchio d'atterraggio) e col telefono (tasto TIRA: trascina giù = potenza, di lato = mira). Preset grafica Leggera/Media/Bella nella sala (localStorage `ridotto-gfx`). Idea originale: fionda. Vicino alla palla trascini il dito (o il mouse) all'indietro: la direzione del trascinamento è la mira, la lunghezza è la potenza, e rilasciando tiri. Durante il trascinamento si vedono una grande freccia a terra e un cerchio sul punto di atterraggio previsto. Sul putt, una linea corta. Togliere la barra che va su e giù.
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

### Ping pong (riferimento: Switch Sports / Wii Sports Resort)
**FATTO 16/11 sera (Claude, screenshot controllati):** palazzetto chiaro senza pubblico (parquet, campo azzurro, transenne blu PING PONG, vetrate), tavolo e rete nuovi, racchette rifatte, avversario = avatar del camerino (KayKit) con racchetta in mano, animazioni di spostamento laterale morbide e colpo; il giocatore vicino in prima persona con la racchetta davanti alla telecamera; interfaccia Fredoka chiara. Prova: `pingpong.html?debug&auto&fp` (prima persona coi bot) o `&auto=tv`. Aggiunti dopo: scia a nastro che si assottiglia, palla che gira davvero (texture), ombra della palla sul tavolo, anello sul rimbalzo, racchetta in mano orientata come le armi KayKit (lama lungo +y dell'osso handslotr, rotazione y=π), avversario più alto (2.05) in posa 'Block'. Poi: la racchetta in prima persona segue la rotazione del telefono (`deviceorientation` → quaternione relativo `pq` a 30 Hz, calibrato a ogni battuta o col tasto "Rimetti dritta"); la direzione del colpo viene dalla rotazione del telefono; battuta col tasto LANCIA sul telefono (`toss`). Da tarare su telefono vero. Idea futura: Joy-Con della Switch collegati al PC via Bluetooth e letti con WebHID (libreria joy-con-webhid) per comandi alla Switch.
Vecchie note:
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
