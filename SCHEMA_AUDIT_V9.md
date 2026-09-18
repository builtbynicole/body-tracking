# Verdant V9 schema audit

## Audit outcome

V9 starts with new encrypted-storage keys. The older local vault is removed on load, so retired reading/writing, morning/evening review, generic wellness, and subjective body-signal fields cannot coexist with V9 data.

Daily review completion is metadata, not a health observation. It lives in `dailyReviews[YYYY-MM-DD]`, outside `entries`, with:

- `schemaVersion: number` (always 9)
- `completedAt: ISO datetime string`
- `appetite: number | null` (1–10)
- `note: string`
- `reviewedSections: string[]`
- `skippedSections: string[]`

Every item in `entries` has immutable framework fields created by `addEntry`:

- `id: UUID string`
- `type: enum`
- `schemaVersion: number` (always 9)
- `date: ISO datetime string` (when the observation occurred)
- `createdAt: ISO datetime string`
- `sourceRoutine?: string`

Payload data is written before the framework fields, so a payload cannot override identity, type, schema version, or dates.

## Allowed health observation types

### `sleep`

- `start`, `end`: ISO datetime strings
- `hours`, `sleepLatencyMinutes`, `awakeMinutes`, `timeInBedHours`, `sleepEfficiency`, `quality`: numbers
- `note`: string

### `food`

- `meal`: `breakfast | lunch | dinner | snack`
- `name`: string containing food and amount description
- `category`: food-group enum when known, otherwise `other`
- `amount`: number; `unit`: string
- `calories`: number; `calorieSource`: string
- `note`: string

### `water`

- `amount`, `ml`: numbers
- `unit`: `ml | cup | oz`
- `dailyTotal`: boolean when the Daily review has consolidated the day

### `medication`

- `kind`: `supplement | prescription | otc | traditional | other`
- `name`: string
- `doseAmount`: number or null; `doseUnit`: string
- `status`: `taken | late | missed | skipped`
- `note`: string; free-text dose from the compact review is prefixed with `Dose:`

### `exercise`

- `category`: `strength | cardio | flexibility | dance | chinese`
- `name`: string
- `minutes`, `rpe`, `calories`, `met`, `estimateWeightKg`: numbers or null where applicable
- `intensity`: `light | moderate | vigorous`
- `note`: string

### `care`

- `items`: array of care-action enum strings
- `customItems`: string array
- `note`: string

### `body`

- Weight fields: `weight: number`, `weightUnit: kg | jin`, `weightSession: morning | evening`
- Dimension fields: `measurements: object` with numeric values, `measurementUnit: cm | in`
- `note`: string

### `event`

- `kind`: `bowel | period-start | period-end | diarrhea | vomiting | symptom | other`
- `name`, `note`: strings
- `bowelForm`: number 1–7 or null
- `difficulty`, `severity`: number 0–10 or null

### `function`

- `chairStands`, `tugSeconds`, `balanceStage`, `balanceSeconds`, `sitReachCm`, `respiratoryRate`: numbers
- `peakFlow`: number or null
- `note`: string

## Same-day identity rules

- Vitamin D: one record per local date.
- Weight: one record per local date and session (`morning` or `evening`).
- Daily water total: one record per local date after consolidation.
- Saving a reviewed section replaces that section’s same-day observations with the canonical answers shown in the review.
- Skipping a section leaves existing observations untouched.

## Analysis domains

History and Trends use the same seven domain mapping:

- Sleep → `sleep`
- Intake → `food`, `water`, `medication`
- Activity → `exercise`
- Care → `care`
- Body → `body`
- Events → `event`
- Function → `function`
