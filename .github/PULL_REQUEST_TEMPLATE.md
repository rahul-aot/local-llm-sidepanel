## What and why

<!-- What does this change, and why? Link the issue: "Closes #123". -->

## How to test

<!-- Steps a reviewer can follow, or the tests that cover it. -->

## Screenshots

<!-- For UI changes: light and dark theme, at 360 px panel width. Delete if not applicable. -->

## Checklist

- [ ] `npm test` passes (and, if possible, against a real server with `OLLAMA_URL=…`)
- [ ] Tests added or updated in `tests/e2e.cjs`
- [ ] No new network requests other than to the user's Ollama server, and no new runtime dependencies
- [ ] New colours added to both light and dark tokens in `sidepanel.css`
- [ ] Keyboard accessible, and no horizontal scroll at 360 px
- [ ] Docs and `CHANGELOG.md` updated if behaviour or setup changed
