// newtab.js

// === 1. 全局配置 ===

// 背景配置
const CONFIG = {
    localJpg: 'assets/background.jpg',
    localPng: 'assets/background.png'
};

// 搜索引擎配置
const SEARCH_ENGINES = {
    google: {
        name: 'Google',
        url: 'https://www.google.com/search?q=',
        icon: '🔍'
    },
    bing: {
        name: 'Bing',
        url: 'https://www.bing.com/search?q=',
        icon: '🅱️'
    }
};

const DEFAULT_SEARCH_ENGINE = 'bing'; // 默认使用 Bing

// 搜索引擎管理器
const SearchEngineManager = {
    /**
     * 获取当前搜索引擎
     * @returns {Promise<string>} 引擎 ID (google 或 bing)
     */
    async getEngine() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['searchEngine'], (result) => {
                const engine = result.searchEngine || DEFAULT_SEARCH_ENGINE;
                console.log('当前搜索引擎:', engine);
                resolve(engine);
            });
        });
    },

    /**
     * 设置搜索引擎
     * @param {string} engine 引擎 ID
     * @returns {Promise<void>}
     */
    async setEngine(engine) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ searchEngine: engine }, () => {
                console.log('搜索引擎已切换为:', SEARCH_ENGINES[engine].name);
                resolve();
            });
        });
    },

    /**
     * 获取搜索 URL
     * @param {string} engine 引擎 ID
     * @param {string} query 搜索查询
     * @returns {string} 完整的搜索 URL
     */
    getSearchUrl(engine, query) {
        const engineConfig = SEARCH_ENGINES[engine] || SEARCH_ENGINES[DEFAULT_SEARCH_ENGINE];
        return engineConfig.url + encodeURIComponent(query);
    }
};

document.addEventListener('DOMContentLoaded', async function () {
    // 初始化 Favicon 缓存数据库
    try {
        await FaviconCache.initDB();
        // 清理过期缓存（异步执行，不阻塞页面加载）
        FaviconCache.clearExpiredCache().catch(err => {
            console.warn('清理过期缓存失败:', err);
        });
    } catch (error) {
        console.error('初始化 FaviconCache 失败:', error);
    }

    // 初始化背景
    handleBackgroundFallback();

    // 初始化书签
    // 检查是否有 Chrome API 权限
    if (chrome.bookmarks) {
        chrome.bookmarks.getTree(function (bookmarkTreeNodes) {
            const grid = document.getElementById('bookmarkGrid');
            if (!grid) return;

            // 逻辑：尝试寻找名为 "收藏夹栏" 或 "Bookmarks Bar" 的节点，或者直接取 ID 为 '1' 的节点
            const rootNode = bookmarkTreeNodes[0];
            const bookmarksBar = rootNode.children.find(
                node => node.id === '1' || node.title === '收藏夹栏' || node.title === 'Bookmarks Bar'
            ) || rootNode.children[0]; // 兜底

            if (bookmarksBar && bookmarksBar.children) {
                processBookmarkNodes(bookmarksBar.children, grid);
            }
        });
    } else {
        console.warn("无法获取书签权限，请检查 manifest.json 或运行环境。");
    }

    // 初始化搜索功能
    initSearch();
});

// === 2. 功能逻辑 ===

/**
 * 切换搜索引擎图标显示
 * @param {string} engine 引擎 ID ('bing' 或 'google')
 */
function updateEngineIcon(engine) {
    const bingIcon = document.getElementById('bingIcon');
    const googleIcon = document.getElementById('googleIcon');

    if (engine === 'bing') {
        bingIcon.classList.remove('hidden');
        googleIcon.classList.add('hidden');
    } else {
        bingIcon.classList.add('hidden');
        googleIcon.classList.remove('hidden');
    }
}

/**
 * 初始化搜索功能
 * 支持图标切换和偏好持久化
 */
async function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const toggleButton = document.getElementById('searchEngineToggle');

    if (!searchInput || !toggleButton) {
        console.warn('搜索元素未找到');
        return;
    }

    // 加载用户偏好的搜索引擎
    let currentEngine = await SearchEngineManager.getEngine();
    updateEngineIcon(currentEngine);

    // 图标切换事件
    toggleButton.addEventListener('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();

        // 切换引擎：Bing <-> Google
        currentEngine = currentEngine === 'bing' ? 'google' : 'bing';
        await SearchEngineManager.setEngine(currentEngine);
        updateEngineIcon(currentEngine);
    });

    // 监听搜索框回车事件
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            const query = this.value.trim();
            if (query) {
                const searchUrl = SearchEngineManager.getSearchUrl(currentEngine, query);
                console.log(`搜索: "${query}" 使用 ${SEARCH_ENGINES[currentEngine].name}`);
                window.location.href = searchUrl;
            }
        }
    });
}

function processBookmarkNodes(nodes, container) {
    nodes.forEach(node => {
        // 如果是文件夹
        if (node.children && node.children.length > 0) {
            // 创建文件夹标题
            const folderTitle = document.createElement('h2');
            folderTitle.className = 'folder-title';
            folderTitle.textContent = node.title;
            container.appendChild(folderTitle);

            // 遍历文件夹内的书签
            node.children.forEach(childNode => {
                // 仅渲染具体网页，忽略嵌套文件夹以保持界面扁平
                if (childNode.url) createBookmarkCard(childNode, container);
            });
        }
        // 如果是顶级书签
        else if (node.url) {
            createBookmarkCard(node, container);
        }
    });
}

function createBookmarkCard(node, container) {
    // 过滤非 http/https 协议 (如 javascript: 伪协议)
    if (!node.url || !/^https?:/.test(node.url)) return;

    const link = document.createElement('a');
    link.className = 'glass-card';
    link.href = node.url;
    // 建议添加在新标签页打开，防止覆盖当前新标签页，可视个人习惯决定
    // link.target = "_blank"; 

    const iconContainer = document.createElement('div');
    iconContainer.className = 'app-icon';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'app-name';
    titleSpan.textContent = node.title || '未知网页';

    link.appendChild(iconContainer);
    link.appendChild(titleSpan);
    container.appendChild(link);

    // === 图标加载核心策略 ===
    loadSmartIcon(node.url, node.title, iconContainer);
}

/**
 * 智能图标加载策略（集成缓存）
 * 策略优化：
 * 1. 优先从 IndexedDB 缓存读取（支持离线访问）
 * 2. 缓存未命中时：
 *    - 内网IP -> Chrome 内部 API
 *    - 公网域名 -> DuckDuckGo API（国内可访问）-> Chrome 内部 API 兜底
 * 3. 成功获取的图标自动保存到缓存
 */
async function loadSmartIcon(url, title, container) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        // STEP 1: 优先从缓存读取
        const cachedIconData = await FaviconCache.getCachedIcon(hostname);
        if (cachedIconData) {
            displayCachedIcon(container, cachedIconData, title);
            return;
        }

        // STEP 2: 缓存未命中，从网络加载
        // 判断是否为内网环境
        const isLocalNetwork = (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
            hostname.endsWith('.local')
        );

        if (isLocalNetwork) {
            // 内网 -> 使用 Chrome 内部 API
            loadLocalFavicon(container, url, title, hostname);
        } else {
            // 公网 -> 使用 DuckDuckGo API（国内可访问）
            loadNetworkFavicon(container, hostname, title);
        }

    } catch (e) {
        console.error('加载图标失败:', e);
        addFallbackIcon(container, title);
    }
}

/**
 * 显示缓存的图标
 */
function displayCachedIcon(container, base64Data, title) {
    const img = document.createElement('img');
    img.src = base64Data;
    img.alt = title;
    img.onerror = () => {
        img.remove();
        addFallbackIcon(container, title);
    };
    container.appendChild(img);
}

/**
 * 加载本地图标 (Chrome MV3 _favicon API)
 * 用于内网地址，不需要缓存
 */
function loadLocalFavicon(container, pageUrl, title, hostname) {
    const internalFaviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
    internalFaviconUrl.searchParams.set("pageUrl", pageUrl);
    internalFaviconUrl.searchParams.set("size", "64");

    const img = document.createElement('img');
    img.src = internalFaviconUrl.toString();
    img.alt = title;

    img.onerror = () => {
        img.remove();
        addFallbackIcon(container, title);
    };

    container.appendChild(img);
}

/**
 * 从网络加载 Favicon（公网域名）
 * 优先使用 DuckDuckGo API（国内可访问）
 * 加载成功后自动缓存到 IndexedDB
 */
function loadNetworkFavicon(container, hostname, title) {
    // 使用 DuckDuckGo API 作为主要源（国内可访问）
    const ddgUrl = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
    const img = document.createElement('img');
    img.src = ddgUrl;
    img.alt = title;

    img.onload = async () => {
        // 加载成功，尝试缓存
        try {
            const base64Data = await FaviconCache.urlToBase64(ddgUrl);
            await FaviconCache.saveCachedIcon(hostname, base64Data);
        } catch (error) {
            console.warn(`缓存图标失败 (${hostname}):`, error);
        }
    };

    img.onerror = () => {
        img.remove();
        // DuckDuckGo 失败 -> 尝试 Chrome 内部 API
        loadLocalFaviconFallback(container, hostname, title);
    };

    container.appendChild(img);
}

/**
 * Chrome 内部 API 兜底方案（用于公网域名）
 */
function loadLocalFaviconFallback(container, hostname, title) {
    const internalFaviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
    internalFaviconUrl.searchParams.set("pageUrl", `https://${hostname}`);
    internalFaviconUrl.searchParams.set("size", "64");

    const img = document.createElement('img');
    img.src = internalFaviconUrl.toString();
    img.alt = title;

    img.onerror = () => {
        img.remove();
        // 所有方式都失败 -> 显示文字兜底
        addFallbackIcon(container, title);
    };

    container.appendChild(img);
}

// 3.4 文字图标兜底
function addFallbackIcon(container, title) {
    // 防止重复添加
    if (container.querySelector('.fallback-icon')) return;

    const fallbackIcon = document.createElement('div');
    const letter = (title && title.length > 0) ? title.charAt(0).toUpperCase() : '?';
    fallbackIcon.textContent = letter;
    fallbackIcon.className = 'fallback-icon';

    const colors = ['#e74c3c', '#8e44ad', '#3498db', '#16a085', '#f39c12', '#2c3e50', '#27ae60', '#d35400'];
    const randomColor = colors[title.charCodeAt(0) % colors.length] || colors[0]; // 根据标题固定颜色，防止刷新变色
    fallbackIcon.style.background = randomColor;

    container.appendChild(fallbackIcon);
}

// === 3. 背景处理 ===
function handleBackgroundFallback() {
    const body = document.body;

    const setBg = (url) => {
        body.style.backgroundImage = `url('${url}')`;
    };

    // 1. 尝试本地 JPG
    const imgJpg = new Image();
    imgJpg.onload = () => setBg(CONFIG.localJpg);
    imgJpg.onerror = () => {
        // 2. 失败则尝试本地 PNG，如果都失败则不设置背景(回退到CSS默认颜色)
        const imgPng = new Image();
        imgPng.onload = () => setBg(CONFIG.localPng);
        imgPng.src = CONFIG.localPng;
    };
    imgJpg.src = CONFIG.localJpg;
}