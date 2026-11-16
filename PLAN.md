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

## 2. Bowling — da fare (telefono come telecomando, stile Switch Sports: tempismo, rotazione polso, piste speciali)
## 3. Ping pong — da fare (colpi: dritto, rovescio, taglio, pallonetto, schiacciata; tempismo)
## 4. Minigolf delirio — da fare (mappe 3D, avatar, poteri, colpi tra giocatori)
## 5. Liar's Bar rifatto — da fare (prima persona su ogni telefono, schermo = regia, modelli animati CC0)
