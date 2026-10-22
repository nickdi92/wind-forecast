# Vento

PWA installabile che mostra il vento dove sei: che vento è (maestrale, scirocco, libeccio…), quanto soffia, da dove arriva, le raffiche e le previsioni per i prossimi giorni. Pensata per chi viaggia in camper: avvisa quando le raffiche diventano pericolose per tendalino e guida.

## Cosa fa

- **Rosa dei venti** con gli 8 venti del Mediterraneo. La lancetta punta da dove arriva il vento, il ventaglio mostra quanto girerà nelle prossime 6 ore, le scie animate scorrono nella direzione e alla velocità reali.
- **Prossime 24 ore**: barre con media e raffiche. Trascinando sul grafico la rosa mostra l'ora scelta.
- **Prossimi giorni**: vento dominante, massimo e raffica massima, con il dettaglio ogni 3 ore.
- **Avvisi raffiche**: da 40 km/h attenzione, da 60 km/h pericolo, con consigli per il camper.
- **Ricerca** di un altro posto, con i posti cercati di recente.
- **Unità**: km/h, nodi o m/s (tocca l'unità in alto).
- **Offline**: mostra gli ultimi dati scaricati, riallineati all'ora attuale.
- Link condivisibili: `?lat=40.92&lon=9.50&name=Olbia`.

## Sviluppo

```bash
npm install
npm run dev      # server locale
npm test         # test della logica (venti, Beaufort, avvisi, previsioni)
npm run build    # build di produzione in dist/
npm run icons    # rigenera le icone PWA da public/favicon.svg
```

La geolocalizzazione funziona solo su `localhost` o HTTPS.

## Deploy

Ogni push su `main` esegue test e build, poi pubblica su GitHub Pages tramite `.github/workflows/deploy.yml`. Nelle impostazioni del repo, Pages deve avere come sorgente "GitHub Actions".

## Dati

- Previsioni: [Open-Meteo](https://open-meteo.com/) (gratis, senza chiave).
- Ricerca posti: Open-Meteo Geocoding.
- Nome del posto dalla posizione: BigDataCloud reverse geocoding (client).
