# Sea’N’Sound

A two-person exhibition prototype: two native phone clients, an authoritative local session server, a shared sea display and a private facilitator panel. No cloud service or visitor account is used at runtime.

## Run the laptop

Requires Node.js 20.19+ (tested here on Node 24).

```sh
cd sea-n-sound
npm install
npm start
```

The terminal prints three addresses:

- **Display:** `http://localhost:8787`. Open it on the exhibition screen; choose Full screen. Enable sea sound once if desired.
- **Facilitator:** the printed link includes a random private key after `#`. Keep that complete link. A plain `/facilitator` link cannot control the session without this key. Restarting the server generates a new key.
- **Phone server:** `http://192.168.…:8787` (your actual local address). Use this in both installed apps. Do not enter `localhost` on a phone.

Keep all three devices on the same Wi-Fi/hotspot. Allow Node through the laptop firewall on the private network. Guest Wi-Fi with client isolation will not work. No public internet is needed after dependencies and native apps have been installed. Keep the laptop awake. This prototype uses unencrypted local traffic; use a dedicated trusted exhibition network, not public hosting.

## Install the phone app

`mobile/` is one React Native / Expo app with A and B roles. Choose a different role on each phone. The native build includes its JavaScript bundle and works without the Expo development server.

```sh
cd mobile
npm install
npx expo install --check
```

**Android, local build:** install Android Studio and its SDK, connect a phone with USB debugging enabled, then run `npm run android -- --variant release`. This builds and installs the bundled release app. Repeat for the second Android phone. Android configuration explicitly permits the local HTTP/WebSocket connection.

**iPhone, local build:** requires macOS, Xcode and Apple device signing. Run `npm run ios -- --device --configuration Release`, select your device, and configure your Apple development team if prompted. Accept Local Network access. Repeat for the second iPhone. Signing/provisioning must be done with your own Apple identity.

**Optional distributable builds:** install the EAS CLI, configure your own Expo project with `eas build:configure`, and run `eas build --profile preview --platform android` for an APK or `eas build --profile preview --platform ios` for a registered-device iOS build. Building this way requires internet and the relevant developer accounts; running the installed apps does not.

Expo Go (`npm start` inside mobile) is useful for rehearsal, but requires the development server and is not the offline exhibition deployment.

## Rehearse without native installation

Open the printed facilitator link and use its Seat A / Seat B browser links in separate browser profiles or on two phones. Slide the vertical handle up and down beside each illustrated seat. Browser haptics depend on browser support; iOS browser haptics are not a substitute for the native app. Use native builds for the intended experience. Each browser origin has one saved phone identity, so use separate profiles to simulate genuinely separate devices.

## Facilitation

1. Start the server and open the display. Enable quiet sea audio if wanted.
2. Open the private facilitator link in a separate window.
3. On each phone enter the printed network address; select A or B and join. Check that both connections appear on the laptop.
4. Let visitors discover the interaction. Each vertical handle directly controls its own seat; holding still does not supply an automatic rhythm.
5. **Reset movement** clears rhythm history and returns both seats to rest while retaining pairing. **Release both seats / next pair** clears pairing and sends both native apps back to setup. Tap Join on each phone for the next pair.
6. Adjust reversal timing, cycle duration tolerance and divergence grace during rehearsal. Hold time remains two seconds as specified.

Seat assignment and address persist on each native phone. A dropped connection retries automatically. The server reserves a disconnected seat for that phone until the facilitator releases the pair. On server restart the phones rejoin automatically. Multiple simultaneous pairs are intentionally unsupported.

## Synchrony model

The laptop samples state at approximately 30 Hz. Each phone has a continuous vertical thumb handle beside the illustrated seat. Dragging up and down drives the seat directly; release recentres the handle and settles the seat. The base and the metal pivot remain stationary, with only the upper seat rotating about that pivot.

Three reversals establish a recent full cycle. Full-cycle durations may differ by up to 40%. Matching reversals must be within 320 ms, with an additional cap of 24% of the shorter cycle so opposite-phase rocking never qualifies. Two seconds of qualifying movement still earns synchrony. A brief mismatch pauses qualification; a mismatch longer than 650 ms clears it. Input that has stopped moving times out after 900 ms. Releasing or disconnecting clears synchrony, with the lights fading back to their individual colours.

Every new shared rhythm gets a unique cue event. Both phones consume each event once, rather than relying on a transient colour flag. iPhone acknowledgment now uses one standard system vibration (about 400 ms), replacing the subtle Light impact. Android uses a success notification with a vibration fallback. The Test vibration button calls the exact same feedback function used for synchrony. The phones acknowledge cue receipt to the laptop; the facilitator view shows receipt for A and B. This verifies software dispatch, not physical sensation. Device settings can suppress vibration, so confirm it on both actual phones during rehearsal.

## Visual and audio scope

The woven, curved seat illustration is a simplified interaction drawing rather than an engineering simulation. Lights sit above each seat. The sea and wave line remain visible. Laptop audio is a quiet, locally synthesized sea-like texture; the wave line is an evolving prototype representation, not live sound sensing or a recording-derived analysis. It starts only after an explicit audio click. Reduced-motion preferences stop the decorative wave animation; direct seat feedback remains.

## Checks

```sh
npm test
```

Automated rhythm tests cover aligned input, opposite phase, incompatible pace, stopping, inactivity, reset and disconnection. Integration tests exercise real WebSocket clients, seat exclusivity, reset authorization and reconnection. Both Android and iOS JavaScript/Hermes bundles were exported successfully with Expo; dependency compatibility and native app syntax were also checked. Native device haptics, OS signing, Wi-Fi latency and two-person usability still need an on-site rehearsal on your actual phones.

## Framework references

- [Expo SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/)
- [Expo native haptics](https://docs.expo.dev/versions/v54.0.0/sdk/haptics/)
- [Build for local development](https://docs.expo.dev/guides/local-app-development/)

## Dependency maintenance

The project pins Expo SDK 54 and includes reproducible lockfiles. An online audit reported transitive advisories in Expo’s build tooling (`postcss` and `image-size`); these are not used to process visitor input. Build only trusted project assets. A forced audit upgrade introduced an incompatible nested Expo version during validation, so the tested locked dependency set was restored. Upgrade the Expo SDK and its matched native packages together before using this prototype as a public production service.

## iOS build workaround

`mobile/scripts/fix-ios-paths.rb` is an optional helper for Expo SDK 54 builds in paths containing spaces. After generating the iOS project, it fixes shell quoting and replaces the template asset catalog and splash storyboard with Apple’s `UILaunchScreen` configuration. It requires the CocoaPods `xcodeproj` Ruby gem. This prototype uses the default app icon; configure a production icon before distributing a release.

## Version 1.1.0

Includes vertical rocking handles, stationary bases and pivots, larger light glows, more forgiving synchrony, unique cue events, stronger iPhone vibration and a manual vibration test. Installed and rehearsed on iPhone 12 Pro Max and iPhone 14; both phones’ Test vibration controls were confirmed physically. A two-person synchrony rehearsal is still recommended for each exhibition network.
