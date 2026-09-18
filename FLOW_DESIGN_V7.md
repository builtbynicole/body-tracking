# Verdant V7 flow design

## Product goal

Verdant should feel like a calm daily conversation, not a filing system. The app owns the checklist; the user only decides how much detail is useful today.

## Research translated into product rules

The design is informed by research on [routine-based cue planning](https://bpspsychub.onlinelibrary.wiley.com/doi/10.1111/bjhp.12504), [mobile ecological momentary assessment burden and compliance](https://pmc.ncbi.nlm.nih.gov/articles/PMC7970161/), and the [Consensus Sleep Diary](https://academic.oup.com/sleep/article-abstract/35/2/287/2558899).

1. Anchor check-ins to stable events, not vague motivation: morning is **after waking** and evening is **after dinner**.
2. Keep a tiny valid record: one overall body-and-mind pulse is enough to save either routine.
3. Separate **log now** facts from **remember tonight** facts. Exact numbers and sudden events stay immediate; food, movement, care, medication, and focus can be recalled in the evening review.
4. Reveal detail only after intent. Optional areas are selected together, then only those follow-up questions appear.
5. Never punish incompleteness. There are no red missed states or streak-loss messages.
6. Preserve continuity. In-progress routines are encrypted in the vault and resume where they stopped.
7. Keep raw records analyzable. Optional routine answers create the same food, water, movement, medication, care, focus, event, sleep, and check-in records used by Trends.

## Information hierarchy

- **Daily pulse:** required 1–10 overall body-and-mind rating.
- **Recommended context:** morning sleep timing; evening mood, energy, and manageable stress.
- **Optional detail:** nourishment, hydration, movement, medication/supplements, care, reading/writing, body signals, and health events.
- **Open context:** one final “anything else?” note.

## Current scope and next validation

V7 changes the in-app flow but does not add push notifications. After real use, validate the preferred reminder windows, which optional branches are actually used, and whether morning and evening should each have their own configurable cue.
