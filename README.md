# Actual Intelligence

A local-first flashcard and quiz revision app for the
[COMP90054 reinforcement learning notes](https://comp90054.github.io/reinforcement-learning/).

Hand-authored flashcards are the core. Quizzes ship with the app, drawn from the
course content. There is no server, no account, and no sign-up — the cards you
write live on your device, on purpose, and you back them up by exporting a JSON
file.

## Why no backend

It's a deliberate trust signal, not a limitation we're apologising for. Your
flashcards never leave your device unless you choose to export them. The whole
app is static files: you can read every line of what runs, host it yourself, and
take your data with you. Durability comes from **export/import**, which is also
the path to sharing decks with classmates.

> IndexedDB is treated as a cache that can be evicted. Export is the backup.

## Features

- **Decks by chapter.** One deck per chapter of the COMP90054 notes
  (introduction through transformers, plus an appendix). Each deck combines the
  quiz questions that ship with the app and the flashcards you've written.
- **Two card types.** Flashcards (front/back) and multiple-choice questions
  (question, options, answer, explanation). Both support **LaTeX**, rendered
  with KaTeX.
- **Authoring is the heart.** Write, edit, and delete your own flashcards — fast
  and keyboard-friendly. Your cards are stored only in IndexedDB on your device.
- **Spaced repetition.** Review with the SM-2 algorithm; each card tracks its due
  date, ease, and interval, and every deck surfaces a "due today" count.
- **Quiz mode.** Answer the shipped MCQs with immediate feedback, and always see
  the explanation — even when you got it right.
- **Flashcard → quiz.** Turn a flashcard into a multiple-choice question in the
  browser: its front becomes the stem, distractors are pulled from sibling cards
  in the same deck. No network, no LLM.
- **Export / import.** Back up or share a deck as a clean JSON file; import merges
  it back into IndexedDB. This is the durability and sharing mechanism.
- **Notion-style design.** Warm canvas, hairline dividers, generous whitespace,
  and a first-class dark mode for late-night revision. Responsive to mobile,
  keyboard shortcuts throughout, visible focus, and reduced-motion respected.

## Status

Early. Built feature-by-feature:

1. ✅ Deck list + open a deck (shipped quiz JSON + your IndexedDB cards)
2. ⬜ Write / edit / delete a flashcard
3. ⬜ Spaced-repetition review (SM-2)
4. ⬜ Quiz mode over shipped MCQs
5. ⬜ Flashcard → quiz via in-browser templating
6. ⬜ Export / import JSON

## Stack

Vite + React + TypeScript, [`idb`](https://github.com/jakearchibald/idb) for
IndexedDB, [KaTeX](https://katex.org/) for math. Hash-routed so it deploys to
GitHub Pages as plain static files. No state library.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + bundle to dist/
npm run typecheck
```

## Licensing

- **Code** — MIT ([LICENSE](LICENSE)).
- **Course content / quizzes** — CC BY-NC 4.0 ([CONTENT-LICENSE](CONTENT-LICENSE)),
  inherited from the COMP90054 notes, which derive from David Silver's RL
  slides. See [ATTRIBUTION.md](ATTRIBUTION.md).

Non-commercial. Contributions — especially quiz decks — are welcome; see
[CONTRIBUTING.md](CONTRIBUTING.md).
