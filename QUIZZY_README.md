# Quizzy Studio (first version)

Run: `npm install`, then `npm run lint`, `npm run build`, `npm run dev` (use Chrome or Edge).

## What a video looks like
Title card -> N questions (default 5). Each question: it appears with A/B/C options
(the narrator reads it) -> countdown ring with tick sounds ->
the right option turns green with a chime and confetti. The LAST question shows no
answer: it shows "Write your answer in the comments!" (editable) instead.
Then an ending card ("Subscribe"). Your account badge (Story & Info) is on every frame.

## You control the timing
- Countdown seconds (3-30) for the whole video, and optionally a different value per question.
- A question stays on screen as long as its voice clips need, so the narrator is never cut.

## Languages
- One language per video (English OR Arabic): the screen text, the options letters (A,B,C / أ,ب,ج) and the narrator all use it. Make a second video by switching the language and exporting again (files: quizzy-english.webm / quizzy-arabic.webm).

## Voices (the professional-voice library)
Browsers cannot record their built-in robot voice into a video file, so the video voice comes from:
1. ElevenLabs AI voices (paste your own API key, press "Load my voices", pick an English
   and an Arabic voice, then "Generate all missing voices"). Clips are saved in the
   browser, so the same text is never paid for twice. Free plan: a monthly allowance;
   some voices in the public voice library may need a paid plan.
2. Your own voice: "Record" on any clip.
3. Any audio file: "Import" on any clip.
"Browser voice (listen only)" is just for checking the wording; it never goes into the video.
If you edit a question after making its voice, the clip is marked "text changed, redo it".

## Tested / not tested
Tested here in a real browser: the whole app, preview with sound, the timeline growing
with the voice clips, import of audio clips, the voice-generation screens against a FAKE
ElevenLabs server I wrote (so the screens and caching work, but the real service was NOT
reached), and an exported 80 s WebM (VP9 + Opus, 720x1280) whose frames and sound I inspected.
NOT tested: the real ElevenLabs service, microphone recording, 1080p, landscape export,
`npm run lint` / `npm run build` on your machine.

## Limits
WebM only. The options appear one after another a little before the narrator finishes
(not word-by-word). Check every fact in your questions yourself.

## Update: question bank, no intro, numbered options
- The questions start at once (a title card is optional: "Show a title card at the start").
- Options are numbered 1, 2, 3 (or 4) in both languages.
- Question bank: about 2,500 bilingual questions (about 2,200 general knowledge + 338 generated math
  facts) in 13 topics: capitals & countries, geography & landmarks, animals, nature, space, science,
  human body, food, colors/shapes/numbers, time, jobs/vehicles/community, inventions/history, math.
  "Pick random questions" draws new ones from the topics you tick, mixes the topics, and never repeats
  a question until the chosen topics are used up (the history is saved in the browser; "Forget what I
  used" clears it). Wrong options are chosen randomly each time. You can still edit every question.
- Where the data is: src/bank/*.ts (one file per topic). docs/REVIEW-*.md = what the fact-checkers changed.

## How accurate is the bank? (honest)
Written by AI helpers, then re-read line by line by independent AI reviewers who fixed or deleted
doubtful items (about 50 corrections, e.g. wrong Arabic words, ambiguous distractors, over-claims).
Web searches were used only for part of the claims (animals/nature, space/science/body/food: about 40
claims); capitals, geography, shapes, time, community and history were reviewed from knowledge,
without web search. So it is carefully checked but NOT guaranteed error-free: watch the question you
publish, especially numbers, and tell me about any mistake you see so I can fix it.
