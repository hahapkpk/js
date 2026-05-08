// ==UserScript==
// @name         夸克网盘空间占用目录树
// @name:en      Quark Cloud Disk Space Tree Analyzer
// @version      1.8
// @description  分析夸克网盘当前目录空间占用，并使用可展开目录树展示。
// @description:en Analyze Quark Cloud Disk space usage and display with an expandable directory tree.
// @license      LGPL-3.0
// @author       Augenstern-O, hahapkpk
// @namespace    https://github.com/hahapkpk/js
// @homepage     https://github.com/hahapkpk/js
// @supportURL   https://github.com/hahapkpk/js/issues
// @icon         https://pan.quark.cn/favicon.ico
// @match        https://pan.quark.cn/*
// @grant        GM_addStyle
// @original     百度网盘空间占用分析优化版 by wiix
// @originalURL  https://greasyfork.org/zh-CN/scripts/466286
// @source       https://greasyfork.org/zh-CN/scripts/564638
// @downloadURL  https://raw.githubusercontent.com/hahapkpk/js/main/quark-disk-space-tree.user.js
// @updateURL    https://raw.githubusercontent.com/hahapkpk/js/main/quark-disk-space-tree.user.js
// ==/UserScript==

(function() {
    'use strict';

    const MAX_CONCURRENT_REQUESTS = 4;
    const PAGE_SIZE = 100;
    const CACHE_TTL_MS = 30 * 60 * 1000;
    const CACHE_PREFIX = 'quark-disk-space-tree:';

    let processing = false;
    let buttonAdded = false;
    let currentResult = null;
    let currentSort = 'size-desc';
    let currentRenderOptions = {};
    let failedDirs = [];
    let selectedFids = new Set();
    let activePathInfo = null;
    let progressState = createProgressState();

    function sleep(time) {
        return new Promise((resolve) => setTimeout(resolve, time));
    }

    function createProgressState() {
        return {
            startedAt: Date.now(),
            scannedDirs: 0,
            scannedFiles: 0,
            scannedSize: 0,
            queuedDirs: 0,
            activeRequests: 0,
            failedDirs: 0,
            currentPath: ''
        };
    }

    function formatSize(value) {
        if (!value || value === 0) return '0B';
        if (value < 1024) return value + 'B';
        if (value < 1024 * 1024) return (value / 1024).toFixed(2) + 'KB';
        if (value < 1024 * 1024 * 1024) return (value / 1024 / 1024).toFixed(2) + 'MB';
        if (value < 1024 * 1024 * 1024 * 1024) return (value / 1024 / 1024 / 1024).toFixed(2) + 'GB';
        return (value / 1024 / 1024 / 1024 / 1024).toFixed(2) + 'TB';
    }

    function parseSize(text) {
        const input = String(text || '').trim().toUpperCase();
        if (!input) return 0;
        const match = input.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/);
        if (!match) return 0;
        const value = Number(match[1]);
        const unit = match[2] || 'B';
        const map = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
        return value * map[unit];
    }

    function parseTime(time, cFormat) {
        if (!time) return null;
        const format = cFormat || '{y}-{m}-{d} {h}:{i}:{s}';
        let date = time instanceof Date ? time : new Date(time);
        const formatObj = {
            y: date.getFullYear(),
            m: date.getMonth() + 1,
            d: date.getDate(),
            h: date.getHours(),
            i: date.getMinutes(),
            s: date.getSeconds()
        };
        return format.replace(/{([ymdhis])+}/g, (result, key) => String(formatObj[key]).padStart(2, '0'));
    }

    function download(filename, result) {
        const text = JSON.stringify(result, null, 4);
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    function getCurrentPathInfo() {
        const hash = window.location.hash;
        if (hash && hash.includes('/list/')) {
            const parts = hash.split('/');
            if (parts.length > 3 && parts[3] && parts[3] !== 'all') {
                const pathParts = [];
                for (let i = 3; i < parts.length; i++) {
                    const part = parts[i];
                    if (!part) continue;
                    if (part.includes('-')) {
                        const dashIndex = part.indexOf('-');
                        if (dashIndex === 32) {
                            pathParts.push({
                                fid: part.substring(0, 32),
                                name: decodeURIComponent(part.substring(33))
                            });
                        } else {
                            pathParts.push({ fid: '', name: decodeURIComponent(part) });
                        }
                    }
                }
                if (pathParts.length > 0) {
                    const lastPart = pathParts[pathParts.length - 1];
                    return {
                        fid: lastPart.fid || '0',
                        name: lastPart.name || '当前目录',
                        fullPath: '/' + pathParts.map((p) => p.name).join('/')
                    };
                }
            }
        }
        return { fid: '0', name: '根目录', fullPath: '/' };
    }

    async function listFile(fid, page = 1, pageSize = PAGE_SIZE) {
        const params = {
            pr: 'ucpro',
            fr: 'pc',
            uc_param_str: '',
            pdir_fid: fid || '0',
            _page: page,
            _size: pageSize,
            _fetch_total: 1,
            _fetch_sub_dirs: 0,
            _sort: 'file_type:asc,updated_at:desc',
            fetch_all_file: 1,
            fetch_risk_file_name: 1
        };
        const url = 'https://drive-pc.quark.cn/1/clouddrive/file/sort?' + new URLSearchParams(params);
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            throw new Error('API 请求失败: ' + response.status + ' ' + response.statusText);
        }
        const data = await response.json();
        if (data.status === 200 && data.data && Array.isArray(data.data.list)) {
            return data.data.list;
        }
        throw new Error('API 返回格式异常');
    }

    async function deleteQuarkNode(node) {
        if (!node || !node.fid || node.fid === '0') {
            throw new Error('根目录或无效节点不能删除');
        }
        const params = {
            pr: 'ucpro',
            fr: 'pc',
            uc_param_str: ''
        };
        const url = 'https://drive-pc.quark.cn/1/clouddrive/file/delete?' + new URLSearchParams(params);
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action_type: 2,
                exclude_fids: [],
                filelist: [node.fid]
            })
        });
        if (!response.ok) {
            throw new Error('删除请求失败: ' + response.status + ' ' + response.statusText);
        }
        const data = await response.json();
        if (data && data.status === 200 && data.code === 0) {
            return data.data;
        }
        throw new Error((data && (data.message || data.error_msg)) || '删除接口返回异常');
    }

    async function deleteQuarkNodes(nodes) {
        const fids = nodes
            .filter((node) => node && node.fid && node.fid !== '0')
            .map((node) => node.fid);
        if (fids.length === 0) {
            throw new Error('没有可删除的文件或目录');
        }
        const params = {
            pr: 'ucpro',
            fr: 'pc',
            uc_param_str: ''
        };
        const url = 'https://drive-pc.quark.cn/1/clouddrive/file/delete?' + new URLSearchParams(params);
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action_type: 2,
                exclude_fids: [],
                filelist: fids
            })
        });
        if (!response.ok) {
            throw new Error('批量删除请求失败: ' + response.status + ' ' + response.statusText);
        }
        const data = await response.json();
        if (data && data.status === 200 && data.code === 0) {
            return data.data;
        }
        throw new Error((data && (data.message || data.error_msg)) || '批量删除接口返回异常');
    }

    async function listAllFiles(fid) {
        let page = 1;
        let files = [];
        while (processing) {
            const pageFiles = await listFile(fid, page, PAGE_SIZE);
            files = files.concat(pageFiles);
            if (pageFiles.length < PAGE_SIZE) break;
            page += 1;
        }
        return files;
    }

    function isDirectory(record) {
        return record.dir === true || record.file_type === 0 || record.obj_category === 'folder';
    }

    function getFileName(record) {
        return record.file_name || record.name || record.fileName || '未命名';
    }

    function getFileSize(record) {
        return Number(record.size || record.file_size || 0);
    }

    function getModifiedAt(record) {
        return Number(record.updated_at || record.last_update_at || record.modify_time || record.created_at || 0);
    }

    function formatModifiedTime(value) {
        if (!value) return '-';
        const timestamp = String(value).length === 10 ? value * 1000 : value;
        return parseTime(new Date(timestamp));
    }

    function makeFileNode(record, path) {
        const name = getFileName(record);
        const size = getFileSize(record);
        return {
            name,
            value: size,
            file_count: 1,
            path: path + '/' + name,
            isDir: false,
            fid: record.fid || '',
            modifiedAt: getModifiedAt(record),
            children: []
        };
    }

    function makeDirNode(name, path, fid, record = {}) {
        return {
            name,
            value: 0,
            file_count: 0,
            path,
            isDir: true,
            fid,
            modifiedAt: getModifiedAt(record),
            children: []
        };
    }

    async function runConcurrentTasks(tasks, worker, limit) {
        let cursor = 0;
        const runners = Array.from({ length: limit }, async function() {
            while (processing) {
                if (cursor >= tasks.length) {
                    if (progressState.activeRequests === 0) break;
                    await sleep(80);
                    continue;
                }
                const index = cursor;
                cursor += 1;
                progressState.queuedDirs = Math.max(tasks.length - cursor, 0);
                progressState.activeRequests += 1;
                progressState.currentPath = tasks[index].path || progressState.currentPath;
                updateProgress();
                try {
                    await worker(tasks[index]);
                } finally {
                    progressState.activeRequests -= 1;
                    updateProgress();
                }
            }
        });
        await Promise.all(runners);
    }

    async function scanDirectoryTask(task, tasks) {
        const files = await listAllFiles(task.fid);
        progressState.scannedDirs += 1;

        for (const file of files) {
            if (!processing) break;
            const fileName = getFileName(file);
            if (isDirectory(file)) {
                const childPath = task.path === '/' ? '/' + fileName : task.path + '/' + fileName;
                const childNode = makeDirNode(fileName, childPath, file.fid || file.file_fid || '', file);
                task.node.children.push(childNode);
                tasks.push({ fid: childNode.fid, node: childNode, path: childPath });
            } else {
                const fileNode = makeFileNode(file, task.path === '/' ? '' : task.path);
                task.node.children.push(fileNode);
                progressState.scannedFiles += 1;
                progressState.scannedSize += fileNode.value;
            }
        }
    }

    async function collectFiles(fid, name, result, currentPath = '', isRoot = false) {
        failedDirs = [];
        progressState = createProgressState();
        const rootPath = isRoot ? currentPath : currentPath + '/' + name;
        const root = makeDirNode(name, rootPath || '/', fid || '0');
        result.push(root);

        const tasks = [{ fid: fid || '0', node: root, path: root.path }];

        await runConcurrentTasks(tasks, async function(task) {
            try {
                await scanDirectoryTask(task, tasks);
            } catch (error) {
                failedDirs.push({ fid: task.fid, node: task.node, path: task.path, error: error.message });
                progressState.failedDirs = failedDirs.length;
            }
        }, MAX_CONCURRENT_REQUESTS);

        recalculateNode(root);
        return { size: root.value, file_count: root.file_count };
    }

    function recalculateNode(node) {
        if (!node.isDir) {
            node.file_count = 1;
            return { size: node.value || 0, count: 1 };
        }
        let size = 0;
        let count = 0;
        for (const child of node.children || []) {
            const childStats = recalculateNode(child);
            size += childStats.size;
            count += childStats.count;
        }
        node.value = size;
        node.file_count = count;
        return { size, count };
    }

    async function retryFailedDirectories() {
        if (!currentResult || failedDirs.length === 0 || processing) return;
        processing = true;
        const retryTargets = failedDirs.slice();
        failedDirs = [];
        progressState = createProgressState();

        await runConcurrentTasks(retryTargets, async function(task) {
            try {
                task.node.children = [];
                await scanDirectoryTask(task, retryTargets);
            } catch (error) {
                failedDirs.push({ fid: task.fid, node: task.node, path: task.path, error: error.message });
                progressState.failedDirs = failedDirs.length;
            }
        }, MAX_CONCURRENT_REQUESTS);

        recalculateNode(currentResult[0]);
        processing = false;
        renderTreeView(currentResult);
    }

    function getCacheKey(pathInfo) {
        return CACHE_PREFIX + (pathInfo.fid || '0') + ':' + pathInfo.fullPath;
    }

    function cacheScanResult(pathInfo, result) {
        try {
            localStorage.setItem(getCacheKey(pathInfo), JSON.stringify({
                savedAt: Date.now(),
                result
            }));
        } catch (error) {
            console.warn('缓存扫描结果失败:', error);
        }
    }

    function loadCachedResult(pathInfo) {
        try {
            const raw = localStorage.getItem(getCacheKey(pathInfo));
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed.savedAt || Date.now() - parsed.savedAt > CACHE_TTL_MS) {
                localStorage.removeItem(getCacheKey(pathInfo));
                return null;
            }
            return parsed;
        } catch (error) {
            console.warn('读取缓存失败:', error);
            return null;
        }
    }

    function updateProgress(message) {
        const processText = document.getElementById('process_text');
        const processFile = document.getElementById('process_text_file');
        if (!processText || !processFile) return;
        const seconds = Math.max(Math.round((Date.now() - progressState.startedAt) / 1000), 0);
        processText.textContent = message || [
            '已扫描目录 ' + progressState.scannedDirs,
            '已扫描文件 ' + progressState.scannedFiles,
            '累计 ' + formatSize(progressState.scannedSize),
            '耗时 ' + seconds + ' 秒',
            '队列 ' + progressState.queuedDirs,
            '并发 ' + progressState.activeRequests,
            '失败 ' + progressState.failedDirs
        ].join(' / ');
        processFile.textContent = progressState.currentPath ? '当前: ' + progressState.currentPath : '';
    }

    function getSortedChildren(node) {
        const children = Array.isArray(node.children) ? node.children.slice() : [];
        return children.sort(function(a, b) {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            if (currentSort === 'name-asc') return String(a.name).localeCompare(String(b.name), 'zh-Hans-CN');
            if (currentSort === 'count-desc') return (b.file_count || 0) - (a.file_count || 0);
            if (currentSort === 'updated-desc') return (b.modifiedAt || 0) - (a.modifiedAt || 0);
            if (currentSort === 'updated-asc') return (a.modifiedAt || 0) - (b.modifiedAt || 0);
            return (b.value || 0) - (a.value || 0);
        });
    }

    function removeNodeByFid(parent, fid) {
        if (!parent || !Array.isArray(parent.children)) return false;
        const index = parent.children.findIndex((child) => child.fid === fid);
        if (index >= 0) {
            parent.children.splice(index, 1);
            return true;
        }
        return parent.children.some((child) => removeNodeByFid(child, fid));
    }

    function findNodeByFid(parent, fid) {
        if (!parent) return null;
        if (parent.fid === fid) return parent;
        for (const child of parent.children || []) {
            const found = findNodeByFid(child, fid);
            if (found) return found;
        }
        return null;
    }

    function getSelectedNodes() {
        if (!currentResult || !currentResult[0]) return [];
        return Array.from(selectedFids)
            .map((fid) => findNodeByFid(currentResult[0], fid))
            .filter(Boolean);
    }

    function getExpandedPaths() {
        return new Set(Array.from(document.querySelectorAll('.quark-tree-item:not(.collapsed)'))
            .map((item) => item.dataset.path)
            .filter(Boolean));
    }

    function updateSelectionUI() {
        const selectedCountLabel = document.getElementById('selectedCountLabel');
        const batchDeleteButton = document.getElementById('batchDeleteButton');
        const count = selectedFids.size;
        if (selectedCountLabel) selectedCountLabel.textContent = '已选 ' + count + ' 项';
        if (batchDeleteButton) batchDeleteButton.disabled = count === 0;
        document.querySelectorAll('.quark-tree-select').forEach((checkbox) => {
            checkbox.checked = selectedFids.has(checkbox.dataset.fid);
        });
    }

    function handleSaveCache() {
        if (!activePathInfo || !currentResult) {
            alert('当前没有可保存的扫描结果。');
            return;
        }
        cacheScanResult(activePathInfo, currentResult);
        updateProgress('已手动保存当前扫描缓存。');
        alert('已保存缓存。');
    }

    function handleLoadCache() {
        activePathInfo = getCurrentPathInfo();
        const cached = loadCachedResult(activePathInfo);
        if (!cached || !cached.result) {
            alert('当前目录没有可用缓存。');
            return;
        }
        selectedFids.clear();
        renderTreeView(cached.result, { fromCache: true, savedAt: cached.savedAt });
        updateProgress('已手动读取缓存。');
    }

    function removeSelectedFids(fids) {
        fids.forEach((fid) => selectedFids.delete(fid));
    }

    async function handleDeleteNode(node, button) {
        if (!node || !node.fid || node.fid === '0') return;
        const nodeType = node.isDir ? '目录' : '文件';
        const confirmed = confirm('确认删除' + nodeType + '：' + node.path + '\n\n该操作会调用夸克网盘删除接口。');
        if (!confirmed) return;

        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = '删除中';
        const expandedPaths = getExpandedPaths();
        try {
            await deleteQuarkNode(node);
            if (currentResult && currentResult[0]) {
                removeNodeByFid(currentResult[0], node.fid);
                selectedFids.delete(node.fid);
                recalculateNode(currentResult[0]);
                renderTreeView(currentResult, { expandedPaths });
            }
            updateProgress('已删除' + nodeType + ': ' + node.path);
        } catch (error) {
            button.disabled = false;
            button.textContent = oldText;
            alert('删除失败: ' + error.message);
        }
    }

    async function handleBatchDelete() {
        const selectedNodes = getSelectedNodes();
        const nodes = selectedNodes.filter((node) => {
            return !selectedNodes.some((other) => {
                return other !== node && other.isDir && node.path && node.path.startsWith(other.path + '/');
            });
        });
        if (nodes.length === 0) return;
        const skipped = selectedNodes.length - nodes.length;
        const confirmed = confirm('确认删除已选 ' + nodes.length + ' 项？' + (skipped > 0 ? '\n已自动跳过 ' + skipped + ' 个位于已选目录内的子项。' : '') + '\n\n该操作会调用夸克网盘删除接口。');
        if (!confirmed) return;

        const expandedPaths = getExpandedPaths();
        const fids = nodes.map((node) => node.fid);
        const batchDeleteButton = document.getElementById('batchDeleteButton');
        const oldText = batchDeleteButton ? batchDeleteButton.textContent : '';
        if (batchDeleteButton) {
            batchDeleteButton.disabled = true;
            batchDeleteButton.textContent = '删除中';
        }
        try {
            await deleteQuarkNodes(nodes);
            if (currentResult && currentResult[0]) {
                fids.forEach((fid) => removeNodeByFid(currentResult[0], fid));
                removeSelectedFids(fids);
                recalculateNode(currentResult[0]);
                renderTreeView(currentResult, { expandedPaths, clearDeletedSelection: true });
            }
            updateProgress('已批量删除 ' + fids.length + ' 项');
        } catch (error) {
            if (batchDeleteButton) {
                batchDeleteButton.disabled = false;
                batchDeleteButton.textContent = oldText;
            }
            alert('批量删除失败: ' + error.message);
        }
    }

    function createTreeNode(node, depth) {
        const children = getSortedChildren(node);
        const hasChildren = children.length > 0;
        const item = document.createElement('div');
        item.className = 'quark-tree-item';
        item.dataset.name = String(node.name || '').toLowerCase();
        item.dataset.path = node.path || node.name || '';
        item.dataset.size = String(node.value || 0);

        const row = document.createElement('div');
        row.className = 'quark-tree-row';
        row.style.paddingLeft = (depth * 18 + 10) + 'px';

        const selectCell = document.createElement('span');
        selectCell.className = 'quark-tree-select-cell';
        if (node.fid && node.fid !== '0') {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'quark-tree-select';
            checkbox.dataset.fid = node.fid;
            checkbox.checked = selectedFids.has(node.fid);
            checkbox.title = '勾选用于批量删除';
            checkbox.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            checkbox.addEventListener('change', function() {
                if (checkbox.checked) {
                    selectedFids.add(node.fid);
                } else {
                    selectedFids.delete(node.fid);
                }
                updateSelectionUI();
            });
            selectCell.appendChild(checkbox);
        }
        row.appendChild(selectCell);

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'quark-tree-toggle';
        toggle.textContent = hasChildren ? 'v' : '';
        toggle.title = hasChildren ? '展开/折叠' : '';
        row.appendChild(toggle);

        const icon = document.createElement('span');
        icon.className = 'quark-tree-icon';
        icon.textContent = node.isDir ? '[D]' : '[F]';
        row.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'quark-tree-name';
        name.textContent = node.name || '未命名';
        name.title = node.path || node.name || '';
        row.appendChild(name);

        const count = document.createElement('span');
        count.className = 'quark-tree-count';
        count.textContent = node.isDir ? (node.file_count || 0) + ' 个文件' : '文件';
        row.appendChild(count);

        const size = document.createElement('span');
        size.className = 'quark-tree-size';
        size.textContent = formatSize(node.value || 0);
        row.appendChild(size);

        const modified = document.createElement('span');
        modified.className = 'quark-tree-modified';
        modified.textContent = formatModifiedTime(node.modifiedAt);
        row.appendChild(modified);

        const copyPathButton = document.createElement('button');
        copyPathButton.type = 'button';
        copyPathButton.className = 'quark-tree-copy';
        copyPathButton.textContent = '复制';
        copyPathButton.title = '复制路径';
        copyPathButton.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            await copyText(node.path || node.name || '');
            copyPathButton.textContent = '已复制';
            setTimeout(() => { copyPathButton.textContent = '复制'; }, 1200);
        });
        row.appendChild(copyPathButton);

        if (node.fid && node.fid !== '0') {
            const deleteFolderButton = document.createElement('button');
            deleteFolderButton.type = 'button';
            deleteFolderButton.className = 'quark-tree-delete';
            deleteFolderButton.textContent = '删除';
            deleteFolderButton.title = node.isDir ? '删除该目录' : '删除该文件';
            deleteFolderButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteNode(node, deleteFolderButton);
            });
            row.appendChild(deleteFolderButton);
        } else {
            const deletePlaceholder = document.createElement('span');
            deletePlaceholder.className = 'quark-tree-delete-placeholder';
            row.appendChild(deletePlaceholder);
        }

        item.appendChild(row);

        if (hasChildren) {
            const childContainer = document.createElement('div');
            childContainer.className = 'quark-tree-children';
            children.forEach(function(child) {
                childContainer.appendChild(createTreeNode(child, depth + 1));
            });
            item.appendChild(childContainer);

            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                item.classList.toggle('collapsed');
                toggle.textContent = item.classList.contains('collapsed') ? '>' : 'v';
            });
            const expandedPaths = currentRenderOptions.expandedPaths;
            const shouldRestoreExpanded = expandedPaths && expandedPaths.has(node.path);
            if (depth > 0 && !shouldRestoreExpanded) {
                item.classList.add('collapsed');
                toggle.textContent = '>';
            }
        }

        return item;
    }

    async function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }
        const input = document.createElement('textarea');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
    }

    function createPanelShell(titleText, options = {}) {
        removeElement('chartcontainer');
        const container = document.createElement('div');
        container.id = 'chartcontainer';
        container.innerHTML = '<div id="diskusage"><div class="quark-panel-body"></div></div>';
        document.body.prepend(container);

        const diskUsage = document.getElementById('diskusage');
        const panelBody = diskUsage.querySelector('.quark-panel-body');

        const toolbar = document.createElement('div');
        toolbar.className = 'quark-tree-toolbar';

        const title = document.createElement('div');
        title.className = 'quark-tree-title';
        title.textContent = titleText;
        toolbar.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'quark-tree-actions';

        const manualScanButton = document.createElement('button');
        manualScanButton.type = 'button';
        manualScanButton.id = 'manualScanButton';
        manualScanButton.textContent = '手动扫描';
        manualScanButton.addEventListener('click', function() {
            startScan(true);
        });
        actions.appendChild(manualScanButton);

        const minimizeButton = document.createElement('button');
        minimizeButton.type = 'button';
        minimizeButton.id = 'minimizeButton';
        minimizeButton.textContent = '最小化';
        minimizeButton.addEventListener('click', function() {
            container.classList.toggle('minimize');
            minimizeButton.textContent = container.classList.contains('minimize') ? '还原' : '最小化';
        });
        actions.appendChild(minimizeButton);

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.id = 'closeButton';
        closeButton.textContent = '关闭';
        closeButton.addEventListener('click', function() {
            processing = false;
            removeElement('chartcontainer');
            removeElement('process_text_container');
        });
        actions.appendChild(closeButton);

        const maximizeButton = document.createElement('button');
        maximizeButton.type = 'button';
        maximizeButton.textContent = '最大化';
        maximizeButton.addEventListener('click', function() {
            container.classList.toggle('maximize');
            maximizeButton.textContent = container.classList.contains('maximize') ? '还原' : '最大化';
        });
        actions.appendChild(maximizeButton);

        toolbar.appendChild(actions);
        diskUsage.insertBefore(toolbar, panelBody);

        return { container, diskUsage, panelBody, actions };
    }

    function renderEmptyPanel(pathInfo, message) {
        currentResult = null;
        currentRenderOptions = {};
        selectedFids.clear();
        const shell = createPanelShell((pathInfo ? pathInfo.name : '当前目录') + ' 的空间占用');

        const empty = document.createElement('div');
        empty.className = 'quark-tree-empty';
        empty.innerHTML = '<div class="quark-tree-empty-title">' + (message || '当前目录没有缓存。') + '</div><div class="quark-tree-empty-subtitle">点击“手动扫描”后才会重新扫描；需要保留结果时再点击“保存缓存”。</div>';
        shell.panelBody.appendChild(empty);
    }

    function openAnalyzerPanel() {
        activePathInfo = getCurrentPathInfo();
        selectedFids.clear();
        const cached = loadCachedResult(activePathInfo);
        if (cached && cached.result) {
            renderTreeView(cached.result, { fromCache: true, savedAt: cached.savedAt });
            return;
        }
        renderEmptyPanel(activePathInfo, '当前目录没有缓存。');
    }

    function addTreeActions(actions, result, options) {
        const expandAllButton = document.createElement('button');
        expandAllButton.type = 'button';
        expandAllButton.textContent = '全部展开';
        expandAllButton.addEventListener('click', function() {
            document.querySelectorAll('.quark-tree-item.collapsed').forEach((el) => {
                el.classList.remove('collapsed');
                const toggle = el.querySelector(':scope > .quark-tree-row .quark-tree-toggle');
                if (toggle) toggle.textContent = 'v';
            });
        });
        actions.appendChild(expandAllButton);

        const collapseAllButton = document.createElement('button');
        collapseAllButton.type = 'button';
        collapseAllButton.textContent = '全部折叠';
        collapseAllButton.addEventListener('click', function() {
            document.querySelectorAll('.quark-tree-item').forEach((el) => {
                if (el.querySelector(':scope > .quark-tree-children')) {
                    el.classList.add('collapsed');
                    const toggle = el.querySelector(':scope > .quark-tree-row .quark-tree-toggle');
                    if (toggle) toggle.textContent = '>';
                }
            });
        });
        actions.appendChild(collapseAllButton);

        const saveCacheButton = document.createElement('button');
        saveCacheButton.type = 'button';
        saveCacheButton.id = 'saveCacheButton';
        saveCacheButton.textContent = '保存缓存';
        saveCacheButton.addEventListener('click', handleSaveCache);
        actions.appendChild(saveCacheButton);

        const loadCacheButton = document.createElement('button');
        loadCacheButton.type = 'button';
        loadCacheButton.id = 'loadCacheButton';
        loadCacheButton.textContent = '读取缓存';
        loadCacheButton.addEventListener('click', handleLoadCache);
        actions.appendChild(loadCacheButton);

        const selectedCountLabel = document.createElement('span');
        selectedCountLabel.id = 'selectedCountLabel';
        selectedCountLabel.className = 'quark-tree-selected-count';
        selectedCountLabel.textContent = '已选 ' + selectedFids.size + ' 项';
        actions.appendChild(selectedCountLabel);

        const selectVisibleButton = document.createElement('button');
        selectVisibleButton.type = 'button';
        selectVisibleButton.id = 'selectVisibleButton';
        selectVisibleButton.textContent = '选择可见';
        selectVisibleButton.addEventListener('click', function() {
            document.querySelectorAll('.quark-tree-item').forEach((item) => {
                if (item.style.display === 'none' || item.getClientRects().length === 0) return;
                const checkbox = item.querySelector(':scope > .quark-tree-row .quark-tree-select');
                if (checkbox && checkbox.dataset.fid) selectedFids.add(checkbox.dataset.fid);
            });
            updateSelectionUI();
        });
        actions.appendChild(selectVisibleButton);

        const clearSelectionButton = document.createElement('button');
        clearSelectionButton.type = 'button';
        clearSelectionButton.id = 'clearSelectionButton';
        clearSelectionButton.textContent = '清空选择';
        clearSelectionButton.addEventListener('click', function() {
            selectedFids.clear();
            updateSelectionUI();
        });
        actions.appendChild(clearSelectionButton);

        const batchDeleteButton = document.createElement('button');
        batchDeleteButton.type = 'button';
        batchDeleteButton.id = 'batchDeleteButton';
        batchDeleteButton.textContent = '删除已选';
        batchDeleteButton.disabled = selectedFids.size === 0;
        batchDeleteButton.addEventListener('click', handleBatchDelete);
        actions.appendChild(batchDeleteButton);

        const downloadButton = document.createElement('button');
        downloadButton.type = 'button';
        downloadButton.textContent = '下载列表';
        downloadButton.addEventListener('click', function() {
            download("夸克网盘 " + result[0].name + " 的目录树文件列表 " + parseTime(new Date()) + ".json", result);
        });
        actions.appendChild(downloadButton);

        const retryFailedButton = document.createElement('button');
        retryFailedButton.type = 'button';
        retryFailedButton.textContent = '重试失败(' + failedDirs.length + ')';
        retryFailedButton.disabled = failedDirs.length === 0;
        retryFailedButton.addEventListener('click', retryFailedDirectories);
        actions.appendChild(retryFailedButton);
    }

    function renderTreeView(result, options = {}) {
        if (!result || result.length === 0) {
            updateProgress('扫描结果为空，请重试！');
            return;
        }

        currentResult = result;
        currentRenderOptions = options;
        selectedFids = new Set(Array.from(selectedFids).filter((fid) => findNodeByFid(result[0], fid)));

        const root = result[0];
        const shell = createPanelShell(root.name + ' 的空间占用', options);
        const panelBody = shell.panelBody;
        addTreeActions(shell.actions, result, options);


        const filters = document.createElement('div');
        filters.className = 'quark-tree-filters';

        const searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.placeholder = '搜索名称或路径';
        filters.appendChild(searchInput);

        const minSizeInput = document.createElement('input');
        minSizeInput.type = 'text';
        minSizeInput.placeholder = '最小大小: 500MB';
        filters.appendChild(minSizeInput);

        const sortSelect = document.createElement('select');
        sortSelect.innerHTML = '<option value="size-desc">按大小降序</option><option value="updated-desc">按修改日期降序</option><option value="updated-asc">按修改日期升序</option><option value="name-asc">按名称升序</option><option value="count-desc">按文件数降序</option>';
        sortSelect.value = currentSort;
        filters.appendChild(sortSelect);

        panelBody.appendChild(filters);

        const summary = document.createElement('div');
        summary.className = 'quark-tree-summary';
        const cacheText = options.fromCache ? ' / 缓存时间 ' + parseTime(options.savedAt) : '';
        summary.textContent = '共 ' + (root.file_count || 0) + ' 个文件，占用 ' + formatSize(root.value || 0) + cacheText;
        panelBody.appendChild(summary);

        const tree = document.createElement('div');
        tree.className = 'quark-tree';
        panelBody.appendChild(tree);

        function rebuildTree() {
            tree.innerHTML = '';
            tree.appendChild(createTreeNode(root, 0));
            applyTreeFilters(searchInput.value, minSizeInput.value);
            updateSelectionUI();
        }

        searchInput.addEventListener('input', function() {
            applyTreeFilters(searchInput.value, minSizeInput.value);
        });
        minSizeInput.addEventListener('input', function() {
            applyTreeFilters(searchInput.value, minSizeInput.value);
        });
        sortSelect.addEventListener('change', function() {
            currentSort = sortSelect.value;
            rebuildTree();
        });

        rebuildTree();
    }

    function applyTreeFilters(searchText, minSizeText) {
        const query = String(searchText || '').trim().toLowerCase();
        const minSize = parseSize(minSizeText);

        function visit(item) {
            const children = Array.from(item.querySelectorAll(':scope > .quark-tree-children > .quark-tree-item'));
            const ownMatch = (!query || item.dataset.name.includes(query) || item.dataset.path.toLowerCase().includes(query)) &&
                (!minSize || Number(item.dataset.size || 0) >= minSize);
            const childMatch = children.map(visit).some(Boolean);
            const visible = ownMatch || childMatch;
            item.style.display = visible ? '' : 'none';
            return visible;
        }

        document.querySelectorAll('.quark-tree > .quark-tree-item').forEach(visit);
    }

    function ensureProgressPanel() {
        let panel = document.getElementById('process_text_container');
        if (panel) return panel;
        panel = document.createElement('div');
        panel.id = 'process_text_container';
        panel.innerHTML = '<div id="process_text"></div><div id="process_text_file"></div><div id="process_stop">点我中断扫描</div>';
        document.body.prepend(panel);
        document.getElementById('process_stop').addEventListener('click', function() {
            processing = false;
            updateProgress('已请求中断扫描，正在等待当前请求结束...');
        });
        return panel;
    }

    async function startScan(forceRefresh) {
        if (processing) {
            updateProgress('分析中，待结束后重试...');
            return;
        }

        activePathInfo = getCurrentPathInfo();
        selectedFids.clear();

        removeElement('chartcontainer');
        ensureProgressPanel();
        progressState = createProgressState();
        processing = true;
        updateProgress('开始分析: "' + activePathInfo.name + '"');

        const result = [];
        try {
            await collectFiles(activePathInfo.fid, activePathInfo.name, result, activePathInfo.fullPath, true);
            processing = false;
            renderTreeView(result);
            updateProgress('已完成对目录: "' + activePathInfo.fullPath + '" 的扫描！');
        } catch (error) {
            processing = false;
            updateProgress('扫描失败: ' + error.message);
            renderEmptyPanel(activePathInfo, '扫描失败: ' + error.message);
            console.error(error);
        }
    }

    function initButtonEvent() {
        openAnalyzerPanel();
    }

    function removeElement(id) {
        const node = document.getElementById(id);
        if (node && node.parentNode) node.parentNode.removeChild(node);
    }

    function insertButton(referenceElement) {
        const btn = createButton();
        referenceElement.parentNode.insertBefore(btn, referenceElement.nextSibling);
    }

    function appendButton(container) {
        const btn = createButton();
        container.appendChild(btn);
    }

    function addFloatingButton() {
        if (buttonAdded || document.getElementById('analyze_button')) return;
        const btn = createButton();
        btn.classList.add('quark-floating-analyze');
        document.body.appendChild(btn);
        buttonAdded = true;
    }

    function createButton() {
        const btn = document.createElement('button');
        btn.id = 'analyze_button';
        btn.title = '分析当前目录的空间占用情况';
        btn.className = 'u-button nd-file-list-toolbar-action-item is-need-left-sep u-button--success u-button--default u-button--small is-has-icon';
        btn.innerHTML = '<span>分析空间占用</span>';
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            initButtonEvent();
        });
        return btn;
    }

    function start() {
        if (buttonAdded || document.getElementById('analyze_button')) return true;
        const createFolderBtn = document.querySelector('.btn-create-folder');
        const anyBtn = document.querySelector('.btn-file');
        const toolbar = document.querySelector('.header-toolbar');
        const btnContainer = document.querySelector('.ant-space');

        try {
            if (createFolderBtn) {
                insertButton(createFolderBtn);
                buttonAdded = true;
                return true;
            }
            if (anyBtn) {
                insertButton(anyBtn);
                buttonAdded = true;
                return true;
            }
            if (toolbar) {
                appendButton(toolbar);
                buttonAdded = true;
                return true;
            }
            if (btnContainer) {
                appendButton(btnContainer);
                buttonAdded = true;
                return true;
            }
        } catch (error) {
            console.error('添加分析按钮失败:', error);
        }

        return false;
    }

    GM_addStyle(`
    #chartcontainer {
        width: 820px;
        height: 580px;
        position: fixed;
        right: 0;
        top: 120px;
        z-index: 99999;
        background: #fff;
        box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        border: 1px solid #d8dde6;
        border-radius: 6px;
        overflow: hidden;
    }
    #chartcontainer.maximize {
        right: 0;
        top: 0;
        width: 100%;
        height: 100%;
        border-radius: 0;
    }
    #chartcontainer.minimize {
        width: 520px;
        height: 54px;
    }
    #chartcontainer.minimize .quark-panel-body {
        display: none;
    }
    #diskusage {
        width: 100%;
        height: 100%;
        background: #f7f9fc;
        color: #1f2937;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px;
    }
    .quark-panel-body {
        min-height: 0;
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
    }
    .quark-tree-toolbar, .quark-tree-filters {
        flex: 0 0 auto;
        padding: 8px 10px;
        background: #fff;
        border-bottom: 1px solid #d8dde6;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .quark-tree-toolbar {
        justify-content: space-between;
        align-items: flex-start;
    }
    .quark-tree-title {
        min-width: 0;
        font-size: 15px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .quark-tree-actions {
        flex: 1 1 auto;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
        min-width: 0;
    }
    .quark-tree-actions button, .quark-tree-copy, .quark-tree-delete {
        height: 28px;
        padding: 0 9px;
        border: 1px solid #c9d2df;
        border-radius: 4px;
        background: #fff;
        color: #1f2937;
        cursor: pointer;
    }
    .quark-tree-actions button:hover, .quark-tree-copy:hover {
        background: #eef5ff;
        border-color: #8ebcf0;
    }
    .quark-tree-actions button:disabled {
        color: #94a3b8;
        cursor: not-allowed;
        background: #f8fafc;
    }
    .quark-tree-filters input, .quark-tree-filters select {
        height: 30px;
        border: 1px solid #c9d2df;
        border-radius: 4px;
        padding: 0 8px;
        min-width: 150px;
    }
    .quark-tree-filters input[type="search"] {
        flex: 1 1 auto;
        min-width: 220px;
    }
    .quark-tree-summary {
        flex: 0 0 auto;
        padding: 8px 12px;
        color: #4b5563;
        background: #f1f5f9;
        border-bottom: 1px solid #d8dde6;
    }
    .quark-tree-empty {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: #64748b;
        background: #fff;
        text-align: center;
        padding: 32px;
    }
    .quark-tree-empty-title {
        color: #1f2937;
        font-size: 16px;
        font-weight: 600;
    }
    .quark-tree-empty-subtitle {
        font-size: 13px;
    }
    .quark-tree {
        flex: 1 1 auto;
        overflow: auto;
        background: #fff;
    }
    .quark-tree-row {
        min-height: 32px;
        display: grid;
        grid-template-columns: 24px 22px 34px minmax(180px, 1fr) 96px 100px 152px 56px 56px;
        align-items: center;
        column-gap: 8px;
        border-bottom: 1px solid #edf1f7;
    }
    .quark-tree-row:hover {
        background: #f4f8ff;
    }
    .quark-tree-toggle {
        width: 20px;
        height: 20px;
        border: none;
        background: transparent;
        color: #475569;
        cursor: pointer;
        padding: 0;
        line-height: 20px;
    }
    .quark-tree-select-cell {
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .quark-tree-select {
        width: 16px;
        height: 16px;
        cursor: pointer;
    }
    .quark-tree-icon {
        color: #64748b;
        font-family: Consolas, monospace;
        font-size: 12px;
    }
    .quark-tree-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .quark-tree-count {
        color: #64748b;
        text-align: right;
        white-space: nowrap;
    }
    .quark-tree-size {
        color: #0f766e;
        font-weight: 600;
        text-align: right;
        white-space: nowrap;
    }
    .quark-tree-modified {
        color: #64748b;
        text-align: right;
        white-space: nowrap;
        font-size: 12px;
    }
    .quark-tree-copy, .quark-tree-delete {
        height: 24px;
        padding: 0 6px;
    }
    .quark-tree-delete {
        color: #b91c1c;
        border-color: #fecaca;
        margin-right: 8px;
    }
    .quark-tree-delete:hover {
        background: #fef2f2;
        border-color: #fca5a5;
    }
    .quark-tree-selected-count {
        height: 28px;
        display: inline-flex;
        align-items: center;
        padding: 0 6px;
        color: #475569;
        white-space: nowrap;
    }
    #batchDeleteButton {
        color: #b91c1c;
        border-color: #fecaca;
    }
    #batchDeleteButton:not(:disabled):hover {
        background: #fef2f2;
        border-color: #fca5a5;
    }
    .quark-tree-delete-placeholder {
        display: block;
        width: 1px;
        height: 1px;
    }
    .quark-tree-item.collapsed > .quark-tree-children {
        display: none;
    }
    #process_text_container {
        z-index: 9999;
        width: 680px;
        word-wrap: break-word;
        position: fixed;
        right: 0;
        bottom: 0;
        background-color: #7f1d1d;
        font-size: 13px;
        color: white;
    }
    #process_text {
        padding: 10px;
    }
    #process_text_file {
        background-color: #166534;
        padding: 10px;
    }
    #process_stop {
        background-color: #f59e0b;
        text-align: center;
        cursor: pointer;
        padding: 10px;
        color: #111827;
    }
    #analyze_button {
        display: inline-flex;
        align-items: center;
        margin-left: 8px;
        padding: 0 12px;
        height: 32px;
        background: #09aaff;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.3s;
    }
    #analyze_button:hover {
        background: #0099ee;
    }
    .quark-floating-analyze {
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 9999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    `);

    const observer = new MutationObserver(function() {
        if (!buttonAdded) start();
    });

    sleep(1500).then(function() {
        const success = start();
        if (!success) {
            observer.observe(document.body, { childList: true, subtree: true });
            sleep(10000).then(function() {
                if (!buttonAdded) {
                    addFloatingButton();
                    observer.disconnect();
                }
            });
        } else {
            observer.disconnect();
        }
    });
})();
