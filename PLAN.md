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
Stato: v1 PUBBLICATA (bot 3 livelli, 2 giocatori, allenamento, personalizzazione). Prossimo: online 1v1, modalità caos.

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
## 4. Minigolf delirio — da fare (mappe 3D, avatar, poteri, colpi tra giocatori)
## 5. Liar's Bar rifatto — da fare (prima persona su ogni telefono, schermo = regia, modelli animati CC0)
