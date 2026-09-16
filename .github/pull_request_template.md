## What changed?

Describe the problem and the smallest solution implemented.

## Verification

- [ ] `node scripts/verify.mjs` passes
- [ ] `git diff --check` passes
- [ ] Reloaded the unpacked extension in Chrome
- [ ] Smoke-tested the affected UI/behavior

## Risk review

- [ ] No new extension permissions or host permissions
- [ ] No unexpected network requests
- [ ] No destructive IndexedDB/storage migration
- [ ] Blob URLs/media resources are cleaned up

If any box above cannot be checked, explain why and what mitigates the risk.
