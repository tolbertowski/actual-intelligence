# Contributing

Thanks for considering a contribution. The most valuable thing you can add is
**quiz content** — well-written questions, keyed to a chapter, with an
explanation that teaches even when the reader got it right. Shared decks are how
this tool grows.

## Ground rules

- **Content is CC BY-NC 4.0.** By contributing quiz questions you agree to
  release them under the same non-commercial license as the rest of the course
  material (see [CONTENT-LICENSE](CONTENT-LICENSE)). Don't paste in material you
  don't have the right to share.
- **Code is MIT.** Code contributions are under the [LICENSE](LICENSE).
- **No backend, ever.** This is a settled architectural constraint. The app is a
  100% client-side static SPA: no server, no database, no accounts. PRs that add
  one won't be merged.

## Adding a quiz deck

Decks live in [`public/decks/`](public/decks/), one JSON file per chapter, named
after the chapter id (e.g. `mdps.json`). The chapter ids are fixed — see
`src/types.ts` (`CHAPTER_IDS`).

A deck file looks like:

```json
{
  "deck": "mdps",
  "version": 1,
  "cards": [
    {
      "id": "short-stable-slug",
      "kind": "mcq",
      "tags": ["bellman"],
      "question": "Question text. LaTeX with $...$ or $$...$$ is supported.",
      "options": ["...", "...", "...", "..."],
      "answer": 1,
      "explanation": "Always shown after answering — make it teach."
    },
    {
      "id": "another-slug",
      "kind": "flashcard",
      "front": "Prompt (LaTeX OK).",
      "back": "Answer (LaTeX OK)."
    }
  ]
}
```

Then register the file in `SHIPPED_DECK_FILES` in `src/lib/decks.ts`.

### Writing good questions

- One idea per card. Sentence case. Keep the voice quiet and matter-of-fact.
- `answer` is the **0-based index** into `options`.
- Make distractors plausible, not silly — a good wrong answer reflects a real
  misconception.
- The explanation should stand on its own and explain *why*, not just restate
  the answer.
- Math is KaTeX. Use `$...$` for inline and `$$...$$` for display math.

## Running locally

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
npm run typecheck
```

## Pull requests

Keep PRs focused. For content PRs, a one-line note on where the questions come
from (which part of the notes) helps review. Be kind in issues and reviews.
