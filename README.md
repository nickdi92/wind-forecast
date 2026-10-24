# Vento

PWA installabile che mostra il vento dove sei: che vento è (maestrale, scirocco, libeccio…), quanto soffia, da dove arriva, le raffiche e le previsioni per i prossimi giorni. Pensata per chi viaggia in camper: avvisa quando le raffiche diventano pericolose per tendalino e guida.

## Cosa fa

- **Funziona ovunque, parla come il posto**: nel Mediterraneo i venti hanno i nomi della rosa tradizionale (maestrale, scirocco…); altrove, per esempio in Islanda, l'app dice solo da dove arriva il vento ("Da nord-ovest", verso sud-est), nasconde il pannello del maestrale e i testi sulla Sardegna, e indica le fonti ufficiali del posto.
- **Rosa dei venti** con gli 8 venti del Mediterraneo (fuori dal Mediterraneo le 8 direzioni). La lancetta punta da dove arriva il vento, il ventaglio mostra quanto girerà nelle prossime 6 ore, le scie animate scorrono nella direzione e alla velocità reali. Se nelle prossime 24 ore piove, un arco azzurro sull'anello mostra da dove arriva la pioggia, con il lato da chiudere.
- **In breve**: riepilogo scritto dai dati delle previsioni (che vento è, se rinforza o cala e quando, se gira, cosa comportano le raffiche, come cambia domani e nei giorni dopo), più tre righe a colpo d'occhio su mare, coste e giornata.
- **Prossime 24 ore**: barre con media e raffiche. Trascinando sul grafico la rosa mostra l'ora scelta.
- **Prossimi giorni**: vento dominante, massimo e raffica massima, con il dettaglio ogni 3 ore.
- **Temperatura** e temperatura percepita sotto il vento.
- **Pioggia**: se piove adesso e quanto (mm), o con che probabilità, sotto il vento. Nel grafico delle 24 ore una barretta azzurra per ora, nei giorni la probabilità massima e il totale, nel dettaglio la pioggia di ogni 3 ore.
- **Avvisi raffiche**: da 40 km/h attenzione, da 60 km/h pericolo, con consigli per il camper.
- **Approfondimenti** (pannelli espandibili sotto le previsioni):
  - *Coste esposte e ripari*: in Sardegna e in Islanda una mappa schematica con 8 tratti di costa colorati per esposizione (esposta, laterale, più riparata) secondo la direzione del vento, con le note locali (Bocche di Bonifacio; fiordi, raffiche ai piedi delle montagne e tempeste di sabbia in Islanda). Altrove un quadrante delle 8 esposizioni possibili, che non è una mappa. Segue l'ora scelta sul grafico.
  - *Mare e onde*: altezza significativa, direzione, periodo, tendenza a 24 ore e massimi dei prossimi 3 giorni, con la distinzione tra mare vivo (vento locale) e mare residuo (onda lunga). Scala Douglas.
  - *Maestrale*: ore, media e raffiche nelle finestre 0–24, 24–48 e 48–72 ore, tendenza, quando si attenua secondo le previsioni (mai oltre l'orizzonte), onde e coste sarde esposte.
  - *Camper e attività all'aperto*: guida con raffiche laterali, piazzola, alberi e oggetti, spiaggia, trekking, freddo percepito, foto e drone, proporzionati alle prossime 12 ore. In Islanda anche portiere strappate dal vento, sabbia e ghiaia, onde improvvise sulle spiagge della costa sud e le raffiche misurate su umferdin.is.
  - *Scala Beaufort*: forza della media con fascia ufficiale WMO nell'unità scelta, effetti a terra e in mare, raffiche distinte dalla media.
  - *Rosa dei venti*: provenienza contro direzione di movimento, gli 8 venti con carattere e coste sarde esposte. Toccando un nome sulla rosa si apre qui.
- **Ricerca** di un altro posto, con i posti cercati di recente.
- **Unità**: km/h, nodi o m/s (tocca l'unità in alto).
- **Offline**: mostra gli ultimi dati scaricati, riallineati all'ora attuale.
- Link condivisibili: `?lat=40.92&lon=9.50&name=Olbia`.

## Sviluppo

```bash
npm install
npm run dev      # server locale
npm test         # test della logica (venti, Beaufort, avvisi, previsioni, pioggia, riepiloghi, mare, coste, maestrale, camper)
npm run build    # build di produzione in dist/
npm run icons    # rigenera le icone PWA da public/favicon.svg
```

La geolocalizzazione funziona solo su `localhost` o HTTPS.

## App iOS

L'app usa la stessa pagina dentro [Capacitor](https://capacitorjs.com/), più due parti native in Swift:

- **Widget** (schermata Home e blocco schermo): vento adesso, raffiche, pioggia e prossime 12 ore. Se il posto è la posizione GPS, il widget la segue da solo.
- **Avvisi raffiche**: notifica quando nelle previsioni compare una raffica da 40 km/h, e un promemoria un'ora prima che inizi. Le raffiche pericolose (da 60 km/h) passano anche con la modalità Full immersion. Funzionano ad app chiusa grazie all'aggiornamento in background, che però iOS fa partire quando vuole.

Struttura:

- `ios/WindCore`: logica condivisa tra app e widget (venti, previsioni, avvisi), con i test (`npm run test:ios`).
- `ios/App/App`: app, plugin `Vento` che riceve le previsioni dalla pagina (`src/native.ts`), notifiche e aggiornamento in background.
- `ios/App/VentoWidget`: widget.
- `ios/App/project.yml`: sorgente del progetto Xcode, generato con [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`).

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer   # una volta sola
npm run ios        # build della pagina, copia in ios/, rigenera il progetto Xcode
open ios/App/App.xcodeproj
```

In Xcode scegli il tuo Team in *Signing & Capabilities* per i target `App` e `VentoWidget`, poi esegui su iPhone o simulatore. Il test UI (`AppUITests`) attiva e disattiva gli avvisi nel simulatore.

Per provare una notifica senza aspettare iOS (solo build di debug):

```bash
xcrun simctl launch booted io.github.nickdi92.vento -VentoRunBackgroundRefresh
```

## Deploy

Ogni push su `main` esegue test e build, poi pubblica su GitHub Pages tramite `.github/workflows/deploy.yml`. Nelle impostazioni del repo, Pages deve avere come sorgente "GitHub Actions".

## Dati e condizioni d'uso

- Previsioni: [Open-Meteo](https://open-meteo.com/), dati CC BY 4.0. L'API gratuita è solo per uso **non commerciale** (niente pubblicità o abbonamenti); i limiti valgono per IP, quindi ogni utente usa la propria quota.
- Onde: [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api), stesse condizioni, nessuna chiave. Modelli d'onda di DWD, ECMWF, Météo-France, NOAA e Copernicus Marine, da citare. Risponde con la cella di mare più vicina (maglie di alcuni km: l'app mostra la distanza) e con valori nulli lontano dal mare. Accuratezza limitata sotto costa, non adatto alla navigazione. Se la richiesta fallisce il vento resta visibile e il pannello lo dice; l'altezza delle onde non viene mai stimata dal vento.
- Riepiloghi, esposizione delle coste e consigli sono interpretazioni calcolate dall'app sui dati grezzi, che restano salvati separati. La mappa delle coste è una prima versione basata solo sull'orientamento generale di 8 tratti: non conosce il riparo reale delle singole spiagge.
- Ricerca posti: Open-Meteo Geocoding, dati GeoNames (CC BY 4.0).
- Nome del posto: BigDataCloud reverse geocoding client. Va chiamato solo dal browser e solo con la posizione GPS del dispositivo, mai con coordinate salvate o condivise.

## Privacy

Nessun backend, account, cookie o statistica. La posizione va a Open-Meteo (previsioni e onde) e BigDataCloud, le ricerche a Open-Meteo. In `localStorage` restano preferenze, posti recenti e ultima previsione. Nell'app iOS il widget usa la posizione del telefono e chiede ad Apple il nome del posto; l'ultima previsione resta anche nell'App Group condiviso tra app e widget.
