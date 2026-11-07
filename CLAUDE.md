# Farmacia: note per lo sviluppo

- App PWA statica pubblicata su https://farmacia-dabo.github.io/ (repository Farmacia-DaBo/farmacia-dabo.github.io, branch main).
- File: index.html (interfaccia), core.js (calcoli condivisi con il service worker), sw.js, manifest.webmanifest, icons/.
- Rispondere sempre in italiano.

## Regole a ogni modifica
1. **Aggiornare la guida in app** (array `GUIDA` in index.html, vista Altro → Guida all'uso) ogni volta che una funzione viene aggiunta o cambia comportamento.
2. Alzare la versione: costante `CACHE` in sw.js (`farmacia-vX.Y.Z`) e la riga "Farmacia · vX.Y" in fondo alla vista Altro.
3. Non cambiare il formato dei dati senza migrazione in `migra()`: i dati esistono solo sui telefoni e nei backup .json.
