# Verdant Health Tracker

Verdant is a private, local-first health journal built around one guided daily review. It is designed to feel like a calm conversation: the app remembers what to ask, presents one question at a time, and saves structured records for trends.

## V9 experience

- One complete daily body review—no morning/evening split and no generic mood, energy, or stress survey
- A 27-screen normal path covering Sleep, Intake, Activity, Care & upkeep, Body measurements, Body events, and a final note—down from the earlier 50+ questions
- A persistent section map with direct shortcuts and explicit whole-section skipping
- Yes/no questions reveal only the details that apply; the final note is optional
- Encrypted draft recovery so an interrupted review resumes where it stopped
- Quick one-tap Vitamin D and water records, plus user-created Quick entries
- Exact-time weight entry and a separate monthly Body measurements entry
- A separate periodic Physical function check using repeatable strength, mobility, balance, flexibility, and breathing measures
- Weekly, monthly, and quarterly charts and pattern summaries
- A clean V9 health-only vault; the incompatible older local dataset is intentionally removed rather than mixed into the new schema

## What the daily review records

- Sleep: sleep onset, final wake, sleep latency, total awake minutes during the night, and quality. Net sleep duration and sleep efficiency are calculated automatically.
- Intake: appetite regulation, breakfast/lunch/dinner/snacks with amounts in natural language, daily water total, Vitamin D, and separate named/timed medication or supplement records.
- Activity: strength, cardio, flexibility, dance, and Chinese movement practice, each asked separately with conditional details. Calories are estimated from METs, time, exertion, and the latest weight.
- Care & upkeep: brushing, flossing, face washing, skincare, showering, and room tidying.
- Body measurements: morning and evening weights in kg or 斤 (1 斤 = 0.5 kg). Waist, hips, abdomen, chest/bust, upper arm, and thigh remain a separate monthly check.
- Body events: repeated bowel movements with time, Bristol stool type, and difficulty; period start/end; diarrhea, vomiting, and other symptoms.

## Physical function

The periodic Physical function check records the 30-second chair stand, Timed Up and Go, 4-stage balance, chair sit-and-reach, resting respiratory rate, and optional peak flow. These are repeatable observations for personal trends, not diagnosis. Follow the in-app safety guidance and stop if a test feels unsafe.

## Calorie estimates

- Food estimates use approximate energy values and household portion weights stored in the app. Recipes, brands, preparation, and free-text descriptions vary, so values are estimates rather than dietary measurements.
- Exercise estimates use activity MET values, duration, exertion, and the latest logged weight. If no weight exists, the app clearly uses a 70 kg reference weight.
- All calculations run on-device and are for personal reflection, not medical or dietary advice.

## Privacy

- Data stays in the browser on the device.
- The vault uses AES-GCM encryption and a PIN-derived PBKDF2-SHA256 key.
- The key remains only in memory while the app is unlocked.
- The app auto-locks after 5 minutes of inactivity.
- Encrypted backup export/import is included.

Important: clearing browser/site data or deleting the installed PWA can remove local records. Export backups periodically.

## Install on iPhone

A PWA must be served over HTTPS (except localhost).

1. Publish this folder through a static HTTPS host such as GitHub Pages, Netlify, Vercel, or Cloudflare Pages.
2. Open the URL in Safari.
3. Tap Share, then Add to Home Screen.
4. Open Verdant and create a PIN.

Apple Health/HealthKit and Face ID/Keychain integration would require a future native app.
