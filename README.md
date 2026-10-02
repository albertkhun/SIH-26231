# (SIH PS 26231) – MVP
Presumptive field-test result + tamper-evident digital record. Not a replacement for laboratory confirmation.

## Run
    npm run install:all
    cp server/.env.example server/.env; cp client/.env.example client/.env   # already created here
    # MongoDB: local mongod or Atlas - set MONGO_URI in server/.env
    npm run dev          # API :5001, web (HTTPS) :5173 -> open the LAN URL on a phone
Phone camera and GPS need HTTPS; the dev server uses a self-signed cert (accept the warning).

## Nothing is invented – fill these in (app refuses to produce results until complete)
- `server/config/card.json` – dictionary, bounds, marker ids + corners, patch centres/sizes + measured Lab (D65), test-area rect
- `server/config/kits.json` – per-kit reference Lab (from the kit's own chart), `tClose`, `tMargin`, timer `minSeconds/maxSeconds` (null = no window enforced)
- `server/config/quality.json` – blur / glare / exposure / tilt thresholds, `warpWidthPx`
`GET /api/config` shows exactly which values are still missing.

## MVP limits (honest)
- Signing key is a server-held Ed25519 software key per enrolled device (no Android Keystore/biometric). Key revocation is basic.
- Captured JPEG is produced by the browser canvas; hash is of the bytes uploaded.
- Quality checks and calibration run client-side; server re-derives the class from submitted Lab and enforces the timer window, but cannot re-verify the image analysis.
- Not offline-first; ΔE before/after is an in-sample fit residual; no accuracy claim is made. Thresholds need forensic validation.
- Tilt is an approximate foreshortening angle, not a full homography decomposition.
- `npm test` checks colour maths/canonical JSON only (synthetic, no kit values).

## Calibration mode and demo mode
- **Calibration mode** (`/calibrate`, link on the Test Log): live raw numbers (marker count, tilt, blur, glare/clipped fractions, median RGB + uncalibrated Lab of each patch and the test area). Needs card geometry only; applies no thresholds; saves nothing.
- **Demo mode**: set `DEMO_MODE=on` in `server/.env` and restart. Uses `server/config/demo.json` (placeholder values, NOT measured). An amber banner shows on every screen and every signed record carries `demoConfig: true` (shown as a DEMO tag). Open `/demo-card` to display a card with generated ArUco markers; switch the test-area swatch to see positive / inconclusive / negative. Set it back to `off` for real work.
