# Verdant Health Tracker

Verdant is a local-first, installable health tracking PWA for iPhone.

## V3 tracks
- Weight in kilograms or 斤 (1 斤 = 0.5 kg)
- Sleep and wake times, automatic duration, sleep difficulty, quality, and notes
- Breakfast, lunch, dinner, snacks, and supplements with food groups and portions
- Automatic, editable food-calorie estimates from an on-device reference set
- Strength, cardio, flexibility, dance, and Chinese movement practices
- Automatic, editable exercise-calorie estimates using METs and the latest logged weight
- Appetite and movement reflections on 1–10 scales
- Timed reading sessions with book title, category, automatic duration, and notes
- Timed writing sessions with project/topic, category, automatic duration, and notes
- Weekly, monthly, and quarterly trend charts with cautious pattern summaries for health, reading, and writing

## About calorie estimates
- Food estimates use approximate energy values and household portion weights stored in the app. Recipes, brands, and preparation methods vary, so the estimate can be corrected before saving.
- Exercise estimates use activity MET values, duration, intensity, and the latest logged weight. If no weight has been logged, the estimate clearly uses a 70 kg reference weight.
- Estimates are for personal reflection and are not medical or dietary advice.

## Privacy model
- Data stays in the browser on your device.
- The vault is encrypted with AES-GCM.
- The encryption key is derived from your PIN using PBKDF2-SHA256.
- The key is kept only in memory while the app is unlocked.
- The app auto-locks after 5 minutes of inactivity.
- Encrypted backup export/import is included.
- Nutrition and exercise calculations run on-device and do not send entries to a server.

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
