# Arcane Mashup

Offline Android survivor game (working title). You are a mage with **4 spell slots** and **5 elements**
(fire, ice, lightning, earth, wind). Put two different elements in your slots and the game automatically
activates a **fusion** (10 in total, e.g. fire + wind = Firestorm, ice + lightning = Frozen Chain).
Undiscovered fusions are greyed out in the **Grimoire** and unlock the first time you trigger them.

- Portrait, one-handed, touch only (floating joystick, spells auto-aim)
- Fully offline, no accounts, no network calls
- 3 mages (Fire, Ice, Wind), 1 map, 2 elemental bosses (each is weak to one element)
- Permanent upgrades bought with coins, progress saved locally

## Run locally (browser)

```bash
npm install            # once (only needed for the Android build)
npm start              # serves ./www on http://localhost:8080
```

Or just open `www/index.html` in a browser. Arrow keys / WASD also move the mage on desktop; `Esc` pauses.

## Build the APK

Every push builds an APK on GitHub Actions (`.github/workflows/build-apk.yml`):

1. Open the repo's **Actions** tab, pick the latest *Build APK* run, download the **arcane-mashup-apk** artifact.
2. Pushes to `main` also publish `arcane-mashup.apk` under **Releases**.
3. Non-`main` branches build a separate "Dev" app (own app id and save data) so it installs next to the main one.

The APK is signed with the fixed **debug** key in `keystore/debug.keystore` (same as the other games), so new builds
install over old ones. It is *not* a Play Store release key.

Local Android build (needs JDK 21 and the Android SDK):

```bash
npm ci
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug -I ../android-signing.gradle
```

## Where things are

| What | Where |
| --- | --- |
| All user-visible text (translate here) | `www/strings.js` |
| Elements, spells, 10 fusions, bosses, mages, upgrade costs | `www/data.js` |
| Game simulation (no DOM, testable in Node) | `www/core.js` |
| Rendering, sprites and particles (all drawn with code) | `www/gfx.js` |
| Screens, input, HUD, game flow | `www/main.js` |
| Save data, **settings** (music / effects / vibration) | `www/save.js` (UI: gear on the menu, or the pause screen) |
| Sound (WebAudio, generated), vibration | `www/audio.js` |
| Rewarded ads (currently simulated) | `www/ads.js` |
| Self-test and balance simulation | `tools/sim.js` (`npm run sim`) |

Settings (music, effects, vibration) are stored in the save under `settings`; save key `arcane_mashup_save_v1`.

## Ads

Only rewarded video (reroll at level-up, revive, double coins). No banners, no forced ads.
Everything goes through `AdService` in `www/ads.js`. Today it **simulates** an ad: a 3 second countdown on the button,
then the reward, then a cooldown. To switch to real AdMob, replace the body of `start()` in `ads.js` with the SDK call
and call `finish(placement)` from the "user earned reward" callback. Nothing else needs to change.

## Tests

`npm test` (also run in CI) checks that all 10 fusions activate and deal damage, that text exists for every id, that
level-up cards are chosen sensibly, and simulates full runs with a bot (NaN / performance checks).
