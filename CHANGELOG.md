# Changelog

All notable changes to this project are documented here.

## [1.1.0] - 2026-09-16

### Fixed
- Persist and restore the active local wallpaper reliably.
- Revoke obsolete Blob URLs and avoid background-switch memory leaks.
- Serialize background mutations to prevent rapid-switch races.
- Roll back failed background uploads without deleting valid history first.
- Prevent IME composition Enter presses from triggering a search.
- Fix the PNG fallback path and malformed bookmark/search state handling.
- Avoid unsafe filename interpolation in background-history markup.

### Changed
- Reduce repeated favicon-cache cleanup work and preserve cache data on upgrades.
- Reduce unnecessary permanent GPU compositing on bookmark cards.
- Remove the unused remote Font Awesome stylesheet.
- Narrow extension resource exposure and validate stored search-engine values.
- Add reduced-motion support and lightweight release verification.

## [1.0.0]
- Initial release.
