# Contributing

Thanks for improving MyNewTab. Keep changes small, dependency-free, and compatible with Chrome Manifest V3.

## Local workflow

1. Load the repository as an unpacked extension from `chrome://extensions`.
2. Make the smallest change that solves the issue.
3. Run `node scripts/verify.mjs`.
4. Reload the unpacked extension and smoke-test the affected behavior.
5. Review `git diff --check` before committing.

## Project constraints

- Use native HTML, CSS, and JavaScript; avoid framework/runtime dependencies.
- Keep user data local unless a feature clearly requires network access.
- Do not broaden extension permissions without explaining why.
- Preserve existing IndexedDB data during schema changes whenever possible.
- Release Blob URLs and other browser resources when they are no longer needed.
- Prefer measurable performance wins over speculative abstraction.

## Pull requests

Describe the problem, the user-visible effect, how the change was tested, and any permission/storage migration implications. Update `CHANGELOG.md` for user-visible changes.
