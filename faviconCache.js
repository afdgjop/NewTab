/**
 * Favicon 缓存管理模块
 * 使用 IndexedDB 存储 favicon 的 Base64 数据
 * 支持缓存过期和自动清理机制
 */

const FaviconCache = (function() {
    const DB_NAME = 'FaviconCacheDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'icons';
    const CACHE_DURATION = 10 * 24 * 60 * 60 * 1000; // 10天（毫秒）
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
    const CLEANUP_KEY = 'faviconCacheLastCleanup';
    const MAX_ICON_BYTES = 256 * 1024;

    let dbInstance = null;

    /**
     * 初始化 IndexedDB 数据库
     * @returns {Promise<IDBDatabase>} 数据库实例
     */
    function initDB() {
        if (dbInstance) {
            return Promise.resolve(dbInstance);
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB 初始化失败:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                dbInstance = request.result;
                dbInstance.onversionchange = () => {
                    dbInstance.close();
                    dbInstance = null;
                };
                console.log('IndexedDB 初始化成功');
                resolve(dbInstance);
            };

            // 数据库升级时保留已有缓存，只补齐缺失的结构
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                let objectStore;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'hostname' });
                } else {
                    objectStore = request.transaction.objectStore(STORE_NAME);
                }
                if (!objectStore.indexNames.contains('expiresAt')) {
                    objectStore.createIndex('expiresAt', 'expiresAt', { unique: false });
                }
                console.log('对象存储结构已就绪');
            };
        });
    }

    /**
     * 从缓存获取图标
     * @param {string} hostname 域名
     * @returns {Promise<string|null>} Base64 图标数据，如果未找到或已过期则返回 null
     */
    async function getCachedIcon(hostname) {
        try {
            const db = await initDB();
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            
            return new Promise((resolve, reject) => {
                const request = store.get(hostname);
                
                request.onsuccess = () => {
                    const record = request.result;
                    
                    // 未找到缓存
                    if (!record) {
                        resolve(null);
                        return;
                    }
                    
                    // 检查是否过期
                    const now = Date.now();
                    if (record.expiresAt && now > record.expiresAt) {
                        console.log(`缓存已过期: ${hostname}`);
                        // 异步删除过期记录（不阻塞当前操作）
                        deleteCachedIcon(hostname).catch(err => {
                            console.warn('删除过期缓存失败:', err);
                        });
                        resolve(null);
                        return;
                    }
                    
                    console.log(`从缓存加载图标: ${hostname}`);
                    resolve(record.iconData);
                };
                
                request.onerror = () => {
                    console.error('读取缓存失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('获取缓存图标时出错:', error);
            return null;
        }
    }

    /**
     * 将图标保存到缓存
     * @param {string} hostname 域名
     * @param {string} iconData Base64 图标数据
     * @returns {Promise<void>}
     */
    async function saveCachedIcon(hostname, iconData) {
        try {
            const db = await initDB();
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const now = Date.now();
            const record = {
                hostname: hostname,
                iconData: iconData,
                cachedAt: now,
                expiresAt: now + CACHE_DURATION
            };
            
            return new Promise((resolve, reject) => {
                const request = store.put(record);
                
                request.onsuccess = () => {
                    console.log(`图标已缓存: ${hostname}`);
                    resolve();
                };
                
                request.onerror = () => {
                    console.error('保存缓存失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('保存缓存图标时出错:', error);
        }
    }

    /**
     * 删除单个缓存记录
     * @param {string} hostname 域名
     * @returns {Promise<void>}
     */
    async function deleteCachedIcon(hostname) {
        try {
            const db = await initDB();
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            return new Promise((resolve, reject) => {
                const request = store.delete(hostname);
                
                request.onsuccess = () => {
                    console.log(`已删除缓存: ${hostname}`);
                    resolve();
                };
                
                request.onerror = () => {
                    console.error('删除缓存失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('删除缓存时出错:', error);
        }
    }

    /**
     * 清理所有过期的缓存记录
     * @returns {Promise<number>} 清理的记录数量
     */
    async function clearExpiredCache() {
        try {
            const db = await initDB();
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('expiresAt');
            
            const now = Date.now();
            let deletedCount = 0;
            
            return new Promise((resolve, reject) => {
                // 使用游标遍历所有记录
                const request = index.openCursor(IDBKeyRange.upperBound(now));
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    
                    if (cursor) {
                        const record = cursor.value;
                        
                        // 如果已过期则删除
                        if (record.expiresAt && now > record.expiresAt) {
                            cursor.delete();
                            deletedCount++;
                        }
                        
                        cursor.continue();
                    } else {
                        // 遍历完成
                        if (deletedCount > 0) {
                            console.log(`已清理 ${deletedCount} 个过期缓存`);
                        }
                        resolve(deletedCount);
                    }
                };
                
                request.onerror = () => {
                    console.error('清理缓存失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('清理过期缓存时出错:', error);
            return 0;
        }
    }

    /**
     * 按间隔清理过期缓存，避免每个新标签页都全量扫描 IndexedDB。
     */
    async function clearExpiredCacheIfNeeded() {
        const now = Date.now();
        const lastCleanup = Number(localStorage.getItem(CLEANUP_KEY) || 0);
        if (now - lastCleanup < CLEANUP_INTERVAL) return 0;
        const deletedCount = await clearExpiredCache();
        localStorage.setItem(CLEANUP_KEY, String(now));
        return deletedCount;
    }

    /**
     * 清空所有缓存（用于调试）
     * @returns {Promise<void>}
     */
    async function clearAllCache() {
        try {
            const db = await initDB();
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            return new Promise((resolve, reject) => {
                const request = store.clear();
                
                request.onsuccess = () => {
                    console.log('所有缓存已清空');
                    resolve();
                };
                
                request.onerror = () => {
                    console.error('清空缓存失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('清空缓存时出错:', error);
        }
    }

    /**
     * 将图片 URL 转换为 Base64 数据
     * @param {string} url 图片 URL
     * @returns {Promise<string>} Base64 数据
     */
    async function urlToBase64(url) {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('响应不是图片');
        if (blob.size > MAX_ICON_BYTES) throw new Error('图标文件过大');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('读取图标失败'));
            reader.readAsDataURL(blob);
        });
    }

    // 暴露公共 API
    return {
        initDB,
        getCachedIcon,
        saveCachedIcon,
        deleteCachedIcon,
        clearExpiredCache,
        clearExpiredCacheIfNeeded,
        clearAllCache,
        urlToBase64
    };
})();
