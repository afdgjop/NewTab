// LocalBGCache.js - 背景缓存管理模块

const LocalBGCache = {
    DB_NAME: 'LocalBGCache',
    DB_VERSION: 1,
    STORE_NAME: 'backgrounds',
    MAX_ITEMS: 3,  // 最多保留 3 个背景

    db: null,

    /**
     * 初始化 IndexedDB
     * @returns {Promise<IDBDatabase>}
     */
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                console.error('LocalBGCache 初始化失败:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('LocalBGCache 初始化成功');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 创建对象存储
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                    // 创建索引用于按时间排序
                    store.createIndex('uploadTime', 'uploadTime', { unique: false });
                    console.log('创建背景存储空间');
                }
            };
        });
    },

    /**
     * 保存背景文件（带 FIFO 策略）
     * @param {File} file - 文件对象
     * @param {string} type - 'image' 或 'video'
     * @returns {Promise<string>} 返回新项的 ID
     */
    async saveBackground(file, type) {
        const id = Date.now().toString();
        const thumbnail = await this.generateThumbnail(file, type);

        const item = {
            id,
            type,
            file,
            fileName: file.name,
            mimeType: file.type,
            uploadTime: Date.now(),
            thumbnail
        };

        // 检查数量，实施 FIFO 策略
        const items = await this.getAll();
        if (items.length >= this.MAX_ITEMS) {
            // 删除最旧的（数组第一个）
            const oldest = items[0];
            await this.delete(oldest.id);
            console.log(`删除最旧背景: ${oldest.fileName}`);
        }

        // 保存新项
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.add(item);

            request.onsuccess = () => {
                console.log(`背景已保存: ${file.name} (${type})`);
                resolve(id);
            };

            request.onerror = () => {
                console.error('保存背景失败:', request.error);
                reject(request.error);
            };
        });
    },

    /**
     * 获取所有背景（按时间排序，最旧在前）
     * @returns {Promise<Array>}
     */
    async getAll() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const index = store.index('uploadTime');
            const request = index.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('获取背景列表失败:', request.error);
                reject(request.error);
            };
        });
    },

    /**
     * 获取单个背景
     * @param {string} id - 背景 ID
     * @returns {Promise<Object>}
     */
    async get(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('获取背景失败:', request.error);
                reject(request.error);
            };
        });
    },

    /**
     * 删除背景
     * @param {string} id - 背景 ID
     * @returns {Promise<void>}
     */
    async delete(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log(`背景已删除: ${id}`);
                resolve();
            };

            request.onerror = () => {
                console.error('删除背景失败:', request.error);
                reject(request.error);
            };
        });
    },

    /**
     * 生成缩略图
     * @param {File} file - 文件对象
     * @param {string} type - 'image' 或 'video'
     * @returns {Promise<string>} Base64 数据 URL
     */
    async generateThumbnail(file, type) {
        if (type === 'image') {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        // 缩略图尺寸
                        canvas.width = 120;
                        canvas.height = 72;

                        // 计算裁剪区域（居中裁剪）
                        const aspectRatio = img.width / img.height;
                        let sx = 0, sy = 0, sw = img.width, sh = img.height;

                        if (aspectRatio > 120 / 72) {
                            sw = img.height * (120 / 72);
                            sx = (img.width - sw) / 2;
                        } else {
                            sh = img.width / (120 / 72);
                            sy = (img.height - sh) / 2;
                        }

                        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 120, 72);
                        resolve(canvas.toDataURL('image/jpeg', 0.7));
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        } else {
            // 视频缩略图使用 SVG 占位符
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="72" viewBox="0 0 120 72">
                <rect width="120" height="72" fill="#2c3e50"/>
                <text x="60" y="36" text-anchor="middle" font-size="14" fill="white" dy=".3em">▶ VIDEO</text>
            </svg>`;
            return 'data:image/svg+xml;base64,' + btoa(svg);
        }
    },

    /**
     * 清空所有背景
     * @returns {Promise<void>}
     */
    async clearAll() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('所有背景已清空');
                resolve();
            };

            request.onerror = () => {
                console.error('清空背景失败:', request.error);
                reject(request.error);
            };
        });
    }
};
