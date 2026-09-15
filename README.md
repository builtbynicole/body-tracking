# Verdant Health Tracker

Verdant is a local-first, installable health tracking PWA for iPhone.

## V1 tracks
- Weight
- Sleep
- Food + optional calories
- Exercise + duration + optional calories

## Privacy model
- Data stays in the browser on your device.
- The vault is encrypted with AES-GCM.
- The encryption key is derived from your PIN using PBKDF2-SHA256.
- The key is kept only in memory while the app is unlocked.
- The app auto-locks after 5 minutes of inactivity.
- Encrypted backup export/import is included.

Important: if you clear Safari website data, remove the site data, or delete the PWA, local data may be lost. Export backups periodically.

## Install on iPhone
A PWA must be served over HTTPS (except localhost). The easiest options are GitHub Pages, Netlify, Vercel, or Cloudflare Pages.

1. Upload this folder to any static HTTPS host.
2. Open the HTTPS URL in Safari on your iPhone.
3. Tap Share.
4. Tap "Add to Home Screen".
5. Open Verdant from the new icon.
6. Create your PIN.

## Future native version
A native SwiftUI app would be needed for Apple Health / HealthKit integration (heart rate, sleep, workouts, etc.) and Face ID / Keychain-grade native credential storage.
