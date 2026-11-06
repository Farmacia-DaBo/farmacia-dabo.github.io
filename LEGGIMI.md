# Farmacia: pubblicazione e installazione

## Pubblicazione su GitHub Pages (come SMG)
1. Crea una **nuova organizzazione** GitHub dedicata, per esempio `Farmacia-Davi` (il nome deve essere libero).
   *Non* metterla in una sottocartella del sito di SMG: due app installabili sullo stesso indirizzo si danno fastidio su Android.
2. Nell'organizzazione crea il repository pubblico **`<nome-organizzazione>.github.io`**, tutto in minuscolo, per esempio `farmacia-davi.github.io`.
3. Carica **tutto il contenuto di questa cartella** (index.html, core.js, sw.js, manifest.webmanifest, la cartella icons) nella radice del repository, branch `main`.
4. Dopo 1-2 minuti l'app è online su `https://farmacia-davi.github.io/`.

## Installazione sui telefoni
Apri l'indirizzo con **Chrome**, poi menu ⋮ → **Installa app** (non "Aggiungi a schermata Home").
Ogni telefono tiene **i propri dati**: tu i tuoi familiari, la tua compagna i suoi.

## Aggiornamenti
Quando carichi una nuova versione, alza il numero in `sw.js` (`farmacia-v1.0.0` → `farmacia-v1.0.1`).
Alla riapertura l'app mostra "Nuova versione disponibile" con il pulsante **Aggiorna**.

## Backup
I dati stanno solo sul telefono. Da **Altro → Salva backup** crei un file .json che puoi mandare su Drive.
Con **Ripristina backup** lo ricarichi, anche su un telefono nuovo. Se l'ultimo backup ha più di 30 giorni, l'app te lo ricorda.
