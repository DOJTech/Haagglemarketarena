# Music, currency and weather

## Naija Radio (the Music button)
Three sources, one panel:

1. **Game radio**: four original stations made live in the browser by the game (Lagos Nights, Market Hustle, Highlife Gold, Rainy Day) plus **Auto**, which changes station with the day's weather. Optional sound effects (cha-ching on a sale) and weather sounds (rain, harmattan wind). No files, no data, no licence issues, because the music is ours.
2. **My phone**: the player picks songs from their own phone. They play on that phone only and are never uploaded.
3. **From the internet**: a "Naija hits" shelf you curate, plus a box to paste a link. Spotify, YouTube, Apple Music and Audiomack links open in that service's own sandboxed player. A direct https link to an audio file plays in the game's player.

### Why the game does not host popular Nigerian songs itself
Commercial songs are copyrighted. Storing or streaming them from your server needs licences from the labels, publishers and collecting societies, and without them you risk takedowns and claims. Embedding the official players (Spotify, YouTube and so on) is the licensed way to let people hear current hits: the service handles the licence and pays the artists. Players may need to sign in to hear full songs on Spotify; otherwise they get previews.

### Keeping "latest Nigerian music" fresh
Open `/#owner` > **Naija hits shelf**. Paste playlist links (playlists update themselves, so one link stays fresh) and give each a title. Up to 30. A new database starts with three community playlists of recent Nigerian hits so the shelf is not empty. They are not official Spotify playlists. Replace them with ones you trust, for example Spotify's own Naija playlists, by pasting their links.

### What is allowed, and why it is safe
Only these are accepted, checked on the pages and again on the server (`public/musiclinks.js`): Spotify, YouTube (privacy-enhanced), Apple Music and Audiomack links, and plain https audio files on a real website. Everything else (other sites, `javascript:`, plain http, IP addresses, links with passwords, look-alike domains) is refused. Embedded players run in a sandboxed frame with no permission to navigate your page. The security policy allows frames only from those four services.

### Not yet verified (please test on a real phone)
- I could not listen to the four stations here, so I checked that they are well-formed and that sound is scheduled, not how they sound. Tell me which to change (tempo, drums, mood).
- This environment has no internet access, so I could not load a live Spotify, YouTube, Apple Music or Audiomack player. The links are built to each service's published embed format and tested for shape only. Audiomack's embed format is the one I am least sure of.
- Phones block sound until the player taps something, so music always starts from a button.

## Currency
The game runs in naira. The currency picker (top right) changes how amounts are **shown**; nothing on the server changes and scores are points, so currency never affects rankings. Choosing a country suggests its currency until the player picks one.

Rates are fixed and approximate (naira per 1 unit), set in `CUR` in `public/common.js`:
USD 1,331, GBP 1,764, AED 362.6 and GHS 119.7 were checked against October 2026 reports. EUR, CAD, KES, ZAR, EGP, XOF, UGX, TZS, RWF, INR and BRL are estimates. Update any of them by editing its `r` value. The pages say rates are approximate and not live.

## Weather and the 15 goods
Each of the seven days has weather (sunny, very hot, cloudy, heavy rain, harmattan). Weather and the day's news change what shoppers ask for and what stock costs. The Arena shows a forecast and marks goods **In demand**. Reading it matters: in testing, a player who stocks to the forecast scores about 630 out of 1000, and one who ignores it about 440. Fresh goods (tomatoes, plantain, pepper, zobo) spoil overnight; everything else carries over.

To change goods or weather, edit `P` and `WX` in `lib/engine.js` and `P` in `public/common.js`. If you change what is stored in a game, raise `ENGINE_V` so old saved games are refused cleanly.
