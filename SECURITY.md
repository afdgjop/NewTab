# Security Policy

## Supported version

Security fixes are applied to the latest version on the `main` branch.

## Reporting a vulnerability

Please avoid opening a public issue for a vulnerability that could expose user data, execute unintended code, or broaden extension permissions.

Use GitHub's private vulnerability reporting feature when it is available for this repository. If private reporting is unavailable, contact the repository maintainer privately before publishing technical details.

Please include:
- affected version or commit;
- reproduction steps;
- security impact;
- any suggested mitigation.

## Permission changes

Changes to `permissions`, `host_permissions`, Content Security Policy, or web-accessible resources require explicit review. The verification script pins the current permission and host-permission allowlists and also pins the current policy of having no custom Content Security Policy and no web-accessible resources. Any change to those areas must update the verifier deliberately before CI can pass.

## Scope

The extension stores settings and local wallpaper/favicon caches in Chrome storage and IndexedDB. Network access is currently limited to fetching favicons from `https://icons.duckduckgo.com/*`.
