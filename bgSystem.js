// bgSystem.js - 自定义背景系统

const ACTIVE_BG_KEY = 'activeBackgroundId';
const SUPPORTED_BG_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm'
]);
const SUPPORTED_BG_EXTENSIONS = new Map([
    ['jpg', 'image'], ['jpeg', 'image'], ['png', 'image'], ['webp', 'image'],
    ['mp4', 'video'], ['webm', 'video']
]);

function getBackgroundType(file) {
    if (SUPPORTED_BG_TYPES.has(file.type)) {
        return file.type.startsWith('image/') ? 'image' : 'video';
    }
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    return SUPPORTED_BG_EXTENSIONS.get(extension) || null;
}
let currentBackgroundObjectUrl = null;
let activeBackgroundId = null;
let backgroundOperationQueue = Promise.resolve();

function enqueueBackgroundOperation(operation) {
    const run = backgroundOperationQueue.then(operation, operation);
    backgroundOperationQueue = run.catch(() => {});
    return run;
}

function releaseCurrentBackgroundUrl() {
    if (currentBackgroundObjectUrl) {
        URL.revokeObjectURL(currentBackgroundObjectUrl);
        currentBackgroundObjectUrl = null;
    }
}

async function persistActiveBackground(id) {
    const nextId = id || null;
    if (nextId) {
        await chrome.storage.local.set({ [ACTIVE_BG_KEY]: nextId });
    } else {
        await chrome.storage.local.remove(ACTIVE_BG_KEY);
    }
    activeBackgroundId = nextId;
}

/**
 * 初始化背景系统
 */
async function initBackgroundSystem() {
    const modal = document.getElementById('bgSettingsModal');
    const uploadBtn = document.getElementById('uploadBgBtn');
    const fileInput = document.getElementById('bgFileInput');
    const closeBtn = document.getElementById('closeBgModal');

    if (!modal || !uploadBtn || !fileInput || !closeBtn) {
        console.warn('背景系统元素未找到');
        return;
    }

    // === 右键菜单事件（在背景区域） ===
    document.addEventListener('contextmenu', (e) => {
        // 检查是否在背景区域（不在图标或其他元素上）
        if (!e.target.closest('.glass-card') &&
            !e.target.closest('.search-container') &&
            !e.target.closest('.bg-modal')) {
            e.preventDefault();
            modal.classList.remove('hidden');
            refreshBgHistory();
        }
    });

    // === 上传按钮点击 ===
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // === 文件选择 ===
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const type = getBackgroundType(file);
        if (!type) {
            fileInput.value = '';
            alert('不支持的文件格式，请选择 JPG/PNG/WebP/MP4/WebM');
            return;
        }

        await enqueueBackgroundOperation(async () => {
            const previousActiveId = activeBackgroundId;
            let savedId = null;
            let applied = false;
            let committed = false;

            try {
                console.log(`上传文件: ${file.name} (${type})`);
                savedId = await LocalBGCache.saveBackground(file, type);
                await applyBackground(file, type);
                applied = true;
                await persistActiveBackground(savedId);
                committed = true;
            } catch (error) {
                if (savedId && !committed) {
                    try {
                        await LocalBGCache.delete(savedId);
                    } catch (rollbackError) {
                        console.warn('回滚失败的背景记录时出错:', rollbackError);
                    }
                }
                if (applied) {
                    try {
                        await restoreVisibleBackground(previousActiveId);
                    } catch (restoreError) {
                        console.warn('恢复上一个背景时出错:', restoreError);
                        resetToDefaultBackground();
                    }
                }
                console.error('上传背景失败:', error);
                alert('上传失败: ' + error.message);
                return;
            } finally {
                fileInput.value = '';
            }

            try {
                await LocalBGCache.trimToMaxItems();
            } catch (cleanupError) {
                console.warn('裁剪背景历史失败，将在后续操作时重试:', cleanupError);
            }
            await refreshBgHistory();
        });
    });

    // === 关闭模态框 ===
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // Esc 键关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    });

    // === 初始加载历史记录 ===
    await refreshBgHistory();

    console.log('背景系统初始化成功');
}

/**
 * 应用背景（图片或视频）
 * @param {File|Blob} file - 文件对象
 * @param {string} type - 'image' 或 'video'
 */
async function applyBackground(file, type) {
    const nextUrl = URL.createObjectURL(file);
    const video = document.getElementById('bgVideo');

    if (type === 'image') {
        try {
            const probe = new Image();
            probe.src = nextUrl;
            if (probe.decode) {
                await probe.decode();
            } else {
                await new Promise((resolve, reject) => {
                    probe.onload = resolve;
                    probe.onerror = reject;
                });
            }
        } catch (error) {
            URL.revokeObjectURL(nextUrl);
            throw new Error('背景图片无法解码');
        }

        if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load();
            video.classList.add('hidden');
        }
        releaseCurrentBackgroundUrl();
        currentBackgroundObjectUrl = nextUrl;
        document.body.style.backgroundImage = `url("${nextUrl}")`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        return;
    }

    if (!video) {
        URL.revokeObjectURL(nextUrl);
        throw new Error('视频背景容器不存在');
    }

    const previousSrc = video.getAttribute('src');
    const previousHidden = video.classList.contains('hidden');
    video.src = nextUrl;
    video.classList.remove('hidden');
    try {
        await video.play();
        releaseCurrentBackgroundUrl();
        currentBackgroundObjectUrl = nextUrl;
        document.body.style.backgroundImage = 'none';
    } catch (error) {
        video.pause();
        if (previousSrc) {
            video.src = previousSrc;
            if (!previousHidden) video.play().catch(() => {});
        } else {
            video.removeAttribute('src');
            video.load();
        }
        video.classList.toggle('hidden', previousHidden);
        URL.revokeObjectURL(nextUrl);
        throw new Error('视频播放失败，请尝试 MP4 或 WebM 文件');
    }
}

async function restoreVisibleBackground(id) {
    if (!id) {
        resetToDefaultBackground();
        return;
    }
    const item = await LocalBGCache.get(id);
    if (!item) {
        resetToDefaultBackground();
        return;
    }
    await applyBackground(item.file, item.type);
}

async function restoreActiveBackground() {
    const result = await chrome.storage.local.get([ACTIVE_BG_KEY]);
    const id = result[ACTIVE_BG_KEY];
    if (!id) return;
    const item = await LocalBGCache.get(id);
    if (!item) {
        await persistActiveBackground(null);
        return;
    }
    await applyBackground(item.file, item.type);
    activeBackgroundId = id;
}

function resetToDefaultBackground() {
    releaseCurrentBackgroundUrl();
    const video = document.getElementById('bgVideo');
    if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.classList.add('hidden');
    }
    document.body.style.backgroundImage = '';
    if (typeof handleBackgroundFallback === 'function') handleBackgroundFallback();
}

/**
 * 刷新历史记录网格
 */
async function refreshBgHistory() {
    const grid = document.getElementById('bgHistoryGrid');
    if (!grid) return;

    try {
        const items = await LocalBGCache.getAll();
        grid.innerHTML = '';

        if (items.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999; padding: 20px 0;">暂无历史记录</p>';
            return;
        }

        // 按时间倒序显示（最新在前），避免把文件名拼入 innerHTML。
        items.reverse().forEach(item => {
            const div = document.createElement('div');
            div.className = 'bg-history-item';
            const img = document.createElement('img');
            img.src = item.thumbnail;
            img.alt = item.fileName || '背景预览';
            img.title = item.fileName || '';
            img.loading = 'lazy';
            img.decoding = 'async';
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.type = 'button';
            deleteBtn.title = '删除';
            deleteBtn.textContent = '×';
            div.append(img, deleteBtn);

            img.addEventListener('click', async () => {
                await enqueueBackgroundOperation(async () => {
                    const previousActiveId = activeBackgroundId;
                    let applied = false;
                    try {
                        const bgItem = await LocalBGCache.get(item.id);
                        if (!bgItem) throw new Error('背景记录不存在');
                        await applyBackground(bgItem.file, bgItem.type);
                        applied = true;
                        await persistActiveBackground(item.id);
                    } catch (error) {
                        if (applied) {
                            try {
                                await restoreVisibleBackground(previousActiveId);
                            } catch (restoreError) {
                                console.warn('恢复上一个背景时出错:', restoreError);
                                resetToDefaultBackground();
                            }
                        }
                        console.error('应用背景失败:', error);
                        alert('应用背景失败: ' + error.message);
                        return;
                    }
                    document.getElementById('bgSettingsModal')?.classList.add('hidden');
                });
            });

            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm(`确定删除 ${item.fileName}？`)) return;

                await enqueueBackgroundOperation(async () => {
                    const wasActive = activeBackgroundId === item.id;
                    try {
                        if (wasActive) {
                            await persistActiveBackground(null);
                        }
                        await LocalBGCache.delete(item.id);
                    } catch (error) {
                        if (wasActive) {
                            try {
                                await persistActiveBackground(item.id);
                            } catch (restoreError) {
                                console.warn('恢复活动背景标记失败:', restoreError);
                            }
                        }
                        console.error('删除背景失败:', error);
                        alert('删除失败: ' + error.message);
                        return;
                    }

                    if (wasActive) {
                        resetToDefaultBackground();
                    }
                    await refreshBgHistory();
                });
            });

            grid.appendChild(div);
        });

        console.log(`已加载 ${items.length} 个历史背景`);
    } catch (error) {
        console.error('刷新历史记录失败:', error);
    }
}

// === 页面加载时自动初始化 ===
window.addEventListener('pagehide', (event) => {
    if (!event.persisted) releaseCurrentBackgroundUrl();
});

document.addEventListener('DOMContentLoaded', async function () {
    try {
        await LocalBGCache.initDB();
        try {
            await restoreActiveBackground();
        } catch (error) {
            console.warn('恢复上次背景失败，本次将使用默认背景:', error);
            resetToDefaultBackground();
        }
        await initBackgroundSystem();
    } catch (error) {
        console.error('初始化背景系统失败:', error);
    }
});
