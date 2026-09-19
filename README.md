# Framework Deck

A phone-installable flashcard app for the problems that keep coming back. One **deck per problem**
("Can't start a task", "How to influence my manager"), one **card per framework** inside it.
Study a deck in order, or pull a random card when you just need a nudge.

No accounts, no server, no build step. Everything you write is stored in the browser's
local storage on that device.

## What it does

| Feature | Detail |
| --- | --- |
| Decks | Create, rename, add a note, delete. Each deck is one problem. |
| Cards | Front = the framework's name, back = how to run it. Add, edit, delete. |
| Study in order | Walks the deck 1 → n, then loops. |
| Random | `Random` button jumps to a random card; the `Random` order mode shuffles the whole deck and reshuffles after each pass. |
| Flip | Tap the card (or Space / Enter) to see the back. |
| Gestures | Swipe left/right on the card for next/previous. Arrow keys and `R` work on desktop. |
| Offline | Service worker caches the app; it runs with no signal. |
| Backup | Menu → Export writes a `.json` file; Import merges one back in. |
| Starter content | Three decks are seeded on first run (also re-addable from the menu). |

## Install it on your phone

The app installs as a PWA, which browsers only allow over HTTPS (or `localhost`).

**Easiest route: GitHub Pages**

1. Merge this branch into `main`.
2. Repo → Settings → Pages → Source: **GitHub Actions**. The included workflow
   (`.github/workflows/pages.yml`) publishes on every push to `main`.
3. Open the published URL on your phone.
   - **Android / Chrome:** menu ⋮ → *Add to Home screen* / *Install app*.
   - **iPhone / Safari:** Share → *Add to Home Screen*. (Safari only offers this from Safari itself.)

It then launches full-screen from the home icon, works offline, and keeps its data between launches.

**Local check on a computer**

```bash
python3 -m http.server 8080      # from the repo root
# then open http://localhost:8080
```

Serving it over plain `http://192.168.x.x` to your phone will *run* fine but won't offer the install
prompt, because it isn't a secure context.

## Files

```
index.html              screens and sheets
styles.css              mobile-first, follows the system light/dark setting
app.js                  state, storage, study logic
sw.js                   offline cache (bump CACHE after editing the shell files)
manifest.webmanifest    name, icons, standalone display
icons/                  192 and 512 px PNGs
```

## Data and backups

Cards live in `localStorage` under `frameworkDeck.v1`, per device and per browser. Clearing site
data (or deleting the installed app on iOS) deletes them. Use **Export** now and then; the JSON
imports into any other device running the app.
