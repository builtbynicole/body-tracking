# Verdant V9 flow and data design

## Product rule

Verdant behaves like a guided personal review, not a filing cabinet. It remembers the health domains, asks one compact question at a time, and lets the user jump between sections through a visible map.

## Review map

The normal path has 27 screens plus one extra card for each bowel movement recorded:

1. Sleep — 5
2. Intake — 5
3. Activity — 5
4. Care & upkeep — 5
5. Body measurements — 2
6. Body events — 4 plus repeated bowel cards
7. Anything else — 1

Every section is a shortcut destination. Jumping forward marks bypassed sections as skipped; a skipped section does not overwrite data already captured through Quick entry.

## Why sleep has five inputs

The Consensus Sleep Diary’s core measures are designed to derive sleep duration, latency, awake time after sleep onset, efficiency, and perceived quality. Verdant removes separate in-bed, trying-to-sleep, awakening-count, out-of-bed, dream, and wake-rested questions from the daily flow. It keeps sleep onset, final wake, latency, total awake minutes, and quality—the smallest set that still supports the primary trend calculations requested for this personal tracker.

## Reconciliation rule

Quick entry and Daily review are two interfaces over the same day’s records:

- Today’s Quick records prefill the corresponding Daily review answer.
- Saving a reviewed section consolidates that section’s same-day records into one canonical set.
- Skipping a section preserves any existing Quick records in it.
- Quick Vitamin D updates the day’s Vitamin D record instead of adding another.
- Quick water increments an existing daily total when present.
- Morning and evening weight each have at most one same-day record; either interface updates it.

## V9 schema

The encrypted vault contains four roots:

- `version`: exact schema version.
- `entries`: typed health observations only.
- `dailyReviews`: completion metadata keyed by local date; this is not mixed into health history.
- `quickEntries` and `routineDrafts`: reusable shortcuts and encrypted in-progress answers.

Allowed health entry types are `sleep`, `food`, `water`, `medication`, `exercise`, `care`, `body`, `event`, and `function`. Every entry has a generated ID, type, V9 schema version, ISO occurrence time, and creation time. Reserved identity fields cannot be overridden by payload data.

The active history and trend domains are Sleep, Intake, Activity, Care, Body, Events, and Function. Reading/writing and the retired morning/evening/general-wellness models are not part of V9.

V9 intentionally uses new storage keys and removes the incompatible V1–V8 local vault. No mixed-version migration is performed.
