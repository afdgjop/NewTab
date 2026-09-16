// LocalBGCache.js - 背景缓存管理模块

const LocalBGCache = {
    DB_NAME: 'LocalBGCache',
    DB_VERSION: 1,
    STORE_NAME: 'backgrounds',
    MAX_ITEMS: 3,  // 最多保留 3 个背景

    db: null,
    dbPromise: null,

    /**
     * 初始化 IndexedDB
     * @returns {Promise<IDBDatabase>}
     */
    async initDB() {
        if (this.db) return this.db;
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                const error = request.error;
                this.dbPromise = null;
                console.error('LocalBGCache 初始化失败:', error);
                reject(error);
            };

            request.onsuccess = () => {
                const db = request.result;
                this.db = db;
                this.dbPromise = null;
                db.onversionchange = () => {
                    db.close();
                    if (this.db === db) this.db = null;
                };
                console.log('LocalBGCache 初始化成功');
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                    store.createIndex('uploadTime', 'uploadTime', { unique: false });
                    console.log('创建背景存储空间');
                }
            };
        });

        return this.dbPromise;
    },

    /**
     * 保存背景文件（历史裁剪在成功应用后执行）
     * @param {File} file - 文件对象
     * @param {string} type - 'image' 或 'video'
     * @returns {Promise<string>} 返回新项的 ID
     */
    async saveBackground(file, type) {
        await this.initDB();
        const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
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

        await new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.add(item);

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error('保存背景失败:', request.error);
                reject(request.error);
            };
        });

        console.log(`背景已保存: ${file.name} (${type})`);
        return id;
    },

    /**
     * 在新背景已经成功应用并持久化后，再裁剪历史记录。
     * 这样坏文件或后续持久化失败不会提前删除旧背景。
     */
    async trimToMaxItems() {
        await this.initDB();
        const items = await this.getAll();
        const excess = Math.max(0, items.length - this.MAX_ITEMS);
        for (let i = 0; i < excess; i++) {
            await this.delete(items[i].id);
            console.log(`删除最旧背景: ${items[i].fileName}`);
        }
    },

    /**
     * 获取所有背景（按时间排序，最旧在前）
     * @returns {Promise<Array>}
     */
    async getAll() {
        await this.initDB();
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
        await this.initDB();
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
        await this.initDB();
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
            return new Promise((resolve, reject) => {
                const objectUrl = URL.createObjectURL(file);
                const img = new Image();
                const cleanup = () => URL.revokeObjectURL(objectUrl);
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = 120;
                        canvas.height = 72;
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
                    } catch (error) {
                        reject(error);
                    } finally {
                        cleanup();
                    }
                };
                img.onerror = () => {
                    cleanup();
                    reject(new Error('无法读取背景图片'));
                };
                img.src = objectUrl;
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
        await this.initDB();
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
