# Actual Intelligence

A local-first flashcard and quiz revision app for the
[COMP90054 reinforcement learning notes](https://comp90054.github.io/reinforcement-learning/).

Hand-authored flashcards are the core. Quizzes ship with the app, drawn from the
course content. There is no server, no account, and no sign-up — the cards you
write live on your device, on purpose, and you back them up by exporting a JSON
file.

## Use it

**→ [tolbertowski.github.io/actual-intelligence](https://tolbertowski.github.io/actual-intelligence/)**

Open the link and start — nothing to install, no sign-up. It runs entirely in
your browser, so the cards you write are stored on *that* device, in *that*
browser (they don't sync across devices). Because that storage can be cleared by
the browser, **back up regularly**: **Progress → Your data → Export backup**
saves a JSON file, and **Import backup** restores it or moves it to another
device. The site is static — you can also clone this repo and host it anywhere,
or run it locally (see [Develop](#develop)).

## Why no backend

It's a deliberate trust signal, not a limitation we're apologising for. Your
flashcards never leave your device unless you choose to export them. The whole
app is static files: you can read every line of what runs, host it yourself, and
take your data with you. Durability comes from **export/import**, which is also
the path to sharing decks with classmates.

> IndexedDB is treated as a cache that can be evicted. Export is the backup.

## Features

- **Decks by chapter, plus your own sets.** One deck per chapter of the
  COMP90054 notes (introduction through transformers, plus an appendix), and you
  can create custom **sets** for cards that don't fit a chapter. Each deck's
  title and description are editable.
- **Two card types.** Flashcards (front/back) and multiple-choice questions —
  including **"select all that apply"** with several correct options. Both
  support **LaTeX**, rendered with KaTeX.
- **Authoring is the heart.** Write, edit, and delete your own cards — fast and
  keyboard-friendly, with a live preview. Your cards are stored only in
  IndexedDB on your device. You can also fix a card mid-session.
- **Spaced repetition.** Review with the SM-2 algorithm; each card tracks its due
  date, ease, and interval, and every deck surfaces a "due today" count.
  **Practice mode** drills a deck any time without touching the schedule.
- **Quiz mode.** Answer MCQs with immediate feedback, and always see the
  explanation — even when you got it right.
- **Flashcard → quiz.** Turn flashcards into multiple-choice questions in the
  browser: the front becomes the stem, distractors are pulled from sibling
  cards. No network, no LLM.
- **Revise everything.** Review, practise, or quiz across *all* decks at once.
- **Progress.** A snapshot of card maturity (New / In progress / Mature, with a
  threshold you set), a due-today forecast, and average ease — overall and per
  deck.
- **Export / import.** Back up or share your cards (and sets, settings, and
  progress) as a clean JSON file; import merges it back into IndexedDB. This is
  the durability and sharing mechanism.
- **Notion-style design.** Warm canvas, hairline dividers, generous whitespace,
  and a first-class dark mode for late-night revision. Responsive to mobile,
  keyboard shortcuts throughout, visible focus, and reduced-motion respected.

## Status

Every feature from the original plan is in:

1. ✅ Deck list + open a deck (shipped quiz JSON + your IndexedDB cards)
2. ✅ Write / edit / delete a card (flashcard or multiple-choice)
3. ✅ Spaced-repetition review (SM-2) + practice mode
4. ✅ Quiz mode over MCQs (single- and multiple-answer)
5. ✅ Flashcard → quiz via in-browser templating
6. ✅ Export / import JSON

Plus, beyond the original plan: custom sets, editable deck names, global
review/practice/quiz across all decks, a progress/stats page with a settable
maturity threshold, and in-session editing.

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
