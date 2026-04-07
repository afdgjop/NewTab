// bgSystem.js - 自定义背景系统

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

        try {
            const type = file.type.startsWith('image/') ? 'image' : 'video';
            console.log(`上传文件: ${file.name} (${type})`);

            // 保存到 IndexedDB
            await LocalBGCache.saveBackground(file, type);

            // 应用背景
            await applyBackground(file, type);

            // 刷新历史记录
            await refreshBgHistory();

            // 清空输入框
            fileInput.value = '';
        } catch (error) {
            console.error('上传背景失败:', error);
            alert('上传失败: ' + error.message);
        }
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
    const url = URL.createObjectURL(file);

    if (type === 'image') {
        // === 应用图片背景 ===
        document.body.style.backgroundImage = `url(${url})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';

        // 隐藏视频背景
        const video = document.getElementById('bgVideo');
        if (video) {
            video.classList.add('hidden');
            video.pause();
            video.src = '';
        }

        console.log('✅ 已应用图片背景');
    } else {
        // === 应用视频背景 ===
        const video = document.getElementById('bgVideo');
        if (video) {
            video.src = url;
            video.classList.remove('hidden');

            // 等待视频加载并播放
            try {
                await video.play();
                console.log('✅ 已应用视频背景');
            } catch (err) {
                console.error('视频播放失败:', err);
                alert('视频播放失败，请尝试其他格式或文件');
            }

            // 移除图片背景
            document.body.style.backgroundImage = 'none';
        }
    }
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

        // 按时间倒序显示（最新在前）
        items.reverse().forEach(item => {
            const div = document.createElement('div');
            div.className = 'bg-history-item';
            div.innerHTML = `
                <img src="${item.thumbnail}" alt="${item.fileName}" title="${item.fileName}">
                <button class="delete-btn" title="删除">×</button>
            `;

            // === 点击缩略图应用背景 ===
            div.querySelector('img').addEventListener('click', async () => {
                try {
                    const bgItem = await LocalBGCache.get(item.id);
                    await applyBackground(bgItem.file, bgItem.type);
                    document.getElementById('bgSettingsModal').classList.add('hidden');
                    console.log(`应用历史背景: ${item.fileName}`);
                } catch (error) {
                    console.error('应用背景失败:', error);
                    alert('应用背景失败: ' + error.message);
                }
            });

            // === 删除按钮 ===
            div.querySelector('.delete-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`确定删除 ${item.fileName}？`)) {
                    try {
                        await LocalBGCache.delete(item.id);
                        await refreshBgHistory();
                        console.log(`已删除: ${item.fileName}`);
                    } catch (error) {
                        console.error('删除背景失败:', error);
                        alert('删除失败: ' + error.message);
                    }
                }
            });

            grid.appendChild(div);
        });

        console.log(`已加载 ${items.length} 个历史背景`);
    } catch (error) {
        console.error('刷新历史记录失败:', error);
    }
}

// === 页面加载时自动初始化 ===
document.addEventListener('DOMContentLoaded', async function () {
    try {
        await LocalBGCache.initDB();
        await initBackgroundSystem();
    } catch (error) {
        console.error('初始化背景系统失败:', error);
    }
});
