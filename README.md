# 🍀 MyNewTab (Browser Extension)

A lightweight, visually stunning, and feature-rich browser New Tab extension built on **Chrome Manifest V3**. Developed with native HTML/CSS/JavaScript with absolutely zero bloated framework dependencies. Enjoy ultra-fast loading speeds and a frictionless Glassmorphism UI.

## ✨ Core Features

- **🚀 Minimalist Search Experience**: Built-in Google and Bing search engines. Seamlessly switch between them with a quick click on the search icon.
- **📚 Smart Bookmark Navigation**: Automatically reads and displays your "Bookmarks Bar". Utilizes a flat design approach, skipping overly complex nested folders.
- **🎨 Intelligent Favicon Fetcher**:
  - **Offline Caching**: Uses IndexedDB to persist icons and load them locally, vastly improving page load times and supporting offline display.
  - **Multi-tier Fallback Strategy**: Prioritizes DuckDuckGo's public API for internet icons; smartly falls back to Chrome's internal API for local network IPs or fetch failures; and auto-generates a colorful fallback text icon with the initial letter if all else fails.
- **🖼️ Immersive Dynamic Backgrounds**:
  - Upload local high-resolution images (JPG/PNG/WebP) or **dynamic videos** (MP4/WebM) as your background!
  - Features an advanced history cache manager: Keeps your 3 most recently used backgrounds, allowing a one-click switch from the settings panel. Powered by IndexedDB for large media storage to prevent quota limits.
- **💎 Modern UI Design**: Employs Glassmorphism effects universally, paired with silky-smooth micro-interactions, delivering a premium visual experience.

## 📦 Installation

### Method 1: Load via Developer Mode (Recommended)
1. Clone or download this repository to your local machine and extract it.
2. Open a Chromium-based browser (e.g., Chrome, Edge, Brave), enter `chrome://extensions/` (or `edge://extensions/`) in the address bar, and hit Enter.
3. Toggle the **"Developer mode"** switch in the top right corner.
4. Click the **"Load unpacked"** button in the top left.
5. Select the extracted `MyNewTab` folder.
6. Open a new tab and enjoy the brand new experience!

## ⚙️ Configuration (Config)

If you have cloned this repository and wish to modify the default search engine or default wallpaper, you can directly edit `MyNewTab/newtab.js`:

```javascript
// === 1. GLOBAL CONFIGURATION ===

const CONFIG = {
    // Your default local wallpapers (Placed in the assets/ directory)
    localJpg: 'assets/background.jpg',
    localPng: 'assets/background.png'
};

// You can also modify the DEFAULT_SEARCH_ENGINE variable. (Options: 'bing' or 'google')
const DEFAULT_SEARCH_ENGINE = 'bing';
```

## 🛠️ Tech Stack

- **Manifest V3**: Fully embraces the latest generation of Chrome extension standards.
- **Vanilla JS**: 0 external dependencies.
- **IndexedDB**: Ensures smooth large-scale Base64 cache and video/image saving.
- **CSS3 Variables & Backdrop-filter**: Realizing modern glass-gradient UI.

## 🛡️ Privacy Statement

**This extension runs entirely locally.** All configurations (search engine preferences), background image caches, and bookmark icon caches are safely stored within your browser's local sandbox environment (using the Storage API & IndexedDB). With the exception of fetching website Favicons, it will absolutely never collect or upload any user data to any external server.

## 📄 License

This project is open-sourced under the [MIT License](LICENSE). Feel free to fork, modify, and use it. Issues and Pull Requests are always welcome!

---
*If you like this project, please consider giving it a ⭐ on GitHub!*
