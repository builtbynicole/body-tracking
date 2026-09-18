# Verdant Health Tracker

Verdant is a local-first, installable health tracking PWA for iPhone.

## V7 tracks
- Two proactive daily routines: a morning check-in after waking and an evening review after dinner
- One required daily pulse per routine; every detailed question is optional and can be skipped
- Branching questions that only appear for the areas selected that day, with a final open note
- Encrypted draft recovery so an interrupted check-in can resume where it stopped
- A focused “Log now” area for exact-time facts such as weight, water, medication routines, and sudden health events
- Detailed individual records remain available behind a quiet “More records” disclosure instead of competing for attention
- A mobile-first check-in screen with one visible question at a time—no dropdown-heavy form wall
- Visible answer choices that advance automatically, with Back and Cancel always available
- Reusable custom Quick entries created after saving a repeated record, plus built-in 250 mL water and Vitamin D actions
- Five calm analysis areas—Body, Nourish, Move, Focus, and Care—without forcing those categories into the logging flow
- Water intake in mL, cups, or fluid ounces, normalized to mL for daily and longer-term analysis
- Daily check-ins for appetite regulation, muscle/stability, mobility/flexibility, and breath/stamina, recorded once per day instead of repeated on every meal or exercise record
- Separate morning and evening weight entries with exact time in kilograms or 斤 (1 斤 = 0.5 kg)
- Monthly body measurements for waist, hips, abdomen (at the navel), chest/bust, upper arm, and thigh in centimetres or inches
- Monthly body-measurement trends with automatic unit conversion; existing weight records migrate into Body entries without data loss
- Sleep and wake times, automatic duration, sleep difficulty, quality, and notes
- Health events including bowel movements, period start/end, diarrhea, vomiting, symptoms, and custom events
- Breakfast, lunch, dinner, and snacks with food groups and portions
- Medication and supplement doses, including taken, late, missed, and intentionally skipped records; old supplement food entries migrate automatically
- Automatic, editable food-calorie estimates from an on-device reference set
- Strength, cardio, flexibility, dance, and Chinese movement practices
- Automatic, editable exercise-calorie estimates using METs and the latest logged weight
- Appetite and movement reflections on 1–10 scales
- Timed reading sessions with book title, category, automatic duration, and notes
- Timed writing sessions with project/topic, category, automatic duration, and notes
- Care and upkeep check-ins for dental care, face washing, skincare, showering, room tidying, and custom routines
- Weekly, monthly, and quarterly grouped trend charts with concise analysis across every record type

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
