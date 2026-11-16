# Piano di lavoro — Il Ridotto (priorità correnti)

**Aggiornamento: 16 novembre 2026.** Questo ordine sostituisce quello del piano storico conservato più sotto.

1. **Golf Caos:** completare visuale individuale e comandi sui telefoni; validare camera, freccia, mira/potenza, sincronizzazione e prestazioni su browser e dispositivi reali. Poi effetti/oggetti dinamici e animazioni più curate.
2. **Ping pong:** rework dell'esperienza in prima persona e della palestra, stabilità dell'avversario, battuta chiara e controlli touch calibrati. Conservare la fisica esistente dove funziona.
3. **Bowling:** rifinitura di illuminazione, materiali, dettagli e animazioni; verifica del gesto e dell'effetto su telefoni reali.
4. **Biliardo:** successivamente, colori/luci, bomba piazzabile, poteri, regole delle buche centrali e modalità a squadre.

**Direzione grafica:** qualità cartoon curata da gioco indie commerciale, riferimenti Nintendo Switch Sports, Super Battle Golf, Golf With Your Friends, Fall Guys e Among Us. Interfaccia Fredoka e palette Ridotto (blu `#3d7bff`, giallo `#ffcf3a`, rosa `#ff5c9a`, inchiostro `#1d2340`). Luci morbide e non sature. Obiettivo circa 60 FPS su Intel Iris Xe e telefoni stabili.

**Git e rilascio:** il lavoro attivo è sul branch `ai/golf-caos-phone-view`; in seguito si propone l'integrazione in `dev`. Non modificare `main` o `gh-pages` e non pubblicare finché i controlli browser, screenshot, partita completa e prova su telefoni non sono superati e Valerio non approva. Non iniziare Liar's Bar senza averne parlato con Valerio.

---

## Piano storico precedente (riferimento secondario)

# Piano di lavoro (aggiornato da Claude)

Ordine concordato con Valerio (16/11/2026): biliardo → bowling → ping pong → minigolf → (poi) Liar's Bar rifatto. Rissa: in pausa.

Regole di lavoro:
- Sorgente in /home/claude/ridotto (site/ = sito, src/ + build.py = tavolo), copia in il-ridotto per il deploy.
- Branch `dev` per il lavoro in corso; `main` + `gh-pages` solo con roba testata.
- Ogni gioco nuovo = pagina separata (non rompe blackjack/Dubito), link dalla lobby.
- Checklist prima di pubblicare: nessun errore in console, partita completa giocata da test automatico, screenshot controllati, funziona su telefono (touch, verticale/orizzontale).

## 1. Biliardo (biliardo.html, site/pool/*)
Design: 8-ball in prima persona (stile 8 Ball Pool ma 3D), fisica vera (strisciamento/rotolamento, effetti
alto/basso/laterale, sponde, bocche delle buche), linea di mira con palla fantasma, barra potenza, effetto,
vista dall'alto, bot (3 livelli), 2 giocatori stesso schermo, allenamento, personalizzazione stecca/palline/panno.
Dopo: online 1v1 (ognuno sul suo telefono), modalità "caos" con poteri.
Stato: v1 PUBBLICATA (bot 3 livelli, 2 giocatori, allenamento, personalizzazione) + Modalità Caos (gettoni: bomba, mazzata, buche larghe, calamita, fantasma). Online 1 contro 1 fatto.

## 2. Bowling (bowling.html, site/bowling/*, telecomando.html)
Pista con olio davanti e secco in fondo (effetto vero), birilli a corpi rigidi (cannon-es), punteggio completo,
telefono come palla (giroscopio: forza dal braccio, effetto dal polso, tempismo del rilascio), dito/mouse come alternativa,
bot, piste speciali (gobbe, muri mobili, corridoio, salto, girandola), 3/5/10 frame.
Stato: v1 PUBBLICATA. Da provare con telefoni veri (soglie del giroscopio). Idee: avatar che lancia, replay dello strike.
## 3. Ping pong (pingpong.html, site/pong/*, telecomando.html modalità racchetta)
Pallina con Magnus/attrito/rimbalzi, personaggi del Ridotto, colpi: dritto, carico, schiacciata, pallonetto, taglio, smorzata;
tempismo = direzione, forza = profondità (troppa = fuori), arbitro con regole vere (battuta, doppio rimbalzo, rete, a 11 ai vantaggi),
computer a 3 livelli, 2 giocatori con vista TV, compensazione del ritardo del telefono.
Stato: v1 PUBBLICATA. Da provare con telefoni veri (soglie del gesto). Idee: colpi speciali, tornei.
## 4. Minigolf Delirio (minigolf.html, site/golf/*, telecomando.html modalità fionda)
6 buche sospese nel vuoto a tema casinò (dadi, roulette che gira, salto, mulino, labirinto con blocchi mobili),
tutti tirano insieme, palle con occhi e cappello, 7 poteri (bomba, raggio, ghiaccio, palloni giganti, calamita, molla, scambio),
fino a 6 giocatori (telefoni, uno su schermo, bot), classifica a colpi.
Stato: v1 PUBBLICATA. Idee: più buche, buche con salite a più piani, giro della morte, editor di buche, avatar del Ridotto accanto alla palla.
## 5. Liar's Bar rifatto — da fare (prima persona su ogni telefono, schermo = regia, modelli animati CC0)

## Prossimi ritocchi (in ordine, uno per sessione)
1. FATTO: personaggio che lancia nel bowling e replay al rallentatore dello strike.
2. FATTO: 3 buche nuove (flipper, ponte stretto, scala a due piani), bot più furbi. Resta: giro della morte, personaggio accanto alla palla.
3. FATTO: ping pong con barra carica e colpo di fuoco. Resta (idea): torneo a eliminazione.
4. FATTO: biliardo online 1 contro 1 (codice o link, chi crea fa da arbitro, risincronizzazione se cade la linea).
5. Liar's Bar rifatto: NON iniziare senza parlarne con Valerio (prima persona su ogni telefono, schermo = regia, modelli animati CC0).
Da fare con Valerio: prova con telefoni veri (soglie di giroscopio e gesto in bowling e ping pong).

## Nuova direzione grafica (16/11 pomeriggio, dopo il feedback di Valerio)
Feedback: grafica troppo semplice ovunque (avatar, animazioni, luci troppo forti/sature, lag). Ping pong e golf da rifare; bowling da rifare;
biliardo da migliorare (colori, bomba da piazzare con esplosione vera, regole 8 e 15 nelle buche centrali e 1 per ultima, 4 giocatori a squadre).
Golf di riferimento: Super Battle Golf (campo vero, omini che corrono, oggetti, armi, golf cart). Potenza tipo Golf With Your Friends.
Strategia: restare sul web (telefoni, link) ma con asset veri CC0: KayKit (personaggi con 95 animazioni, oggetti, ambienti - scaricati da GitHub),
Quaternius (Valerio li manda), HDR Poly Haven; luci da studio condivise (site/avatar/stage.js), font Fredoka.
Fatto: Camerino (avatar.html) con avatar componibili (testa/busto/braccia/gambe/cappello/mantello/oggetto/colore), salvato per tutti i giochi.
Prossimo: bowling rifatto con i nuovi avatar e ambiente, poi Super Battle Golf, ping pong in prima persona, biliardo.
