// ==UserScript==
// @name         夸克网盘空间占用目录树
// @name:en      Quark Cloud Disk Space Tree Analyzer
// @version      1.1
// @description  分析夸克网盘当前目录空间占用，并使用可展开目录树展示。
// @description:en Analyze Quark Cloud Disk space usage and display with an expandable directory tree.
// @license      LGPL-3.0
// @author       Augenstern-O
// @namespace    https://github.com/Augenstern-O
// @homepage     https://github.com/Augenstern-O/userscripts/夸克网盘空间占用分析
// @supportURL   https://github.com/Augenstern-O/userscripts/夸克网盘空间占用分析/issues
// @icon         https://pan.quark.cn/favicon.ico
// @match        https://pan.quark.cn/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @require      https://code.jquery.com/jquery-latest.js
// @original     百度网盘空间占用分析优化版 by wiix
// @originalURL  https://greasyfork.org/zh-CN/scripts/466286
// @downloadURL  https://raw.githubusercontent.com/hahapkpk/js/main/quark-disk-space-tree.user.js
// @updateURL    https://raw.githubusercontent.com/hahapkpk/js/main/quark-disk-space-tree.user.js
// ==/UserScript==

(function(){
    'use strict';

    // 延迟执行
    let sleep = function (time) {
        return new Promise((resolve) => setTimeout(resolve, time));
    };

    // 确保 jQuery 已加载
    function waitForJQuery() {
        return new Promise((resolve) => {
            if (typeof $ !== 'undefined' && typeof jQuery !== 'undefined') {
                resolve();
            } else {
                let checkInterval = setInterval(() => {
                    if (typeof $ !== 'undefined' && typeof jQuery !== 'undefined') {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            }
        });
    }

    // 将字节大小格式化为可读格式
    function formatSize(value) {
        if (!value || value === 0) return "0B";
        let size = value + "B"
        if (value < 1024 * 1024) {
            size = (value / 1024).toFixed(2) + "KB"
        }
        else if (value < 1024 * 1024 * 1024) {
            size = (value / 1024 / 1024).toFixed(2) + 'MB'
        }
        else if (value < 1024 * 1024 * 1024 * 1024) {
            size = (value / 1024 / 1024 / 1024).toFixed(2) + 'GB'
        }
        else if (value < 1024 * 1024 * 1024 * 1024 * 1024) {
            size = (value / 1024 / 1024 / 1024 / 1024).toFixed(2) + 'TB'
        }
        return size;
    }

    function parseTime(time, cFormat) {
        if (arguments.length === 0 || !time) {
            return null
        }
        const format = cFormat || '{y}-{m}-{d} {h}:{i}:{s}'
        let date
        if (typeof time === 'object') {
            date = time
        } else {
            if ((typeof time === 'string')) {
                if ((/^[0-9]+$/.test(time))) {
                    time = parseInt(time)
                } else {
                    time = time.replace(new RegExp(/-/gm), '/')
                }
            }

            if ((typeof time === 'number') && (time.toString().length === 10)) {
                time = time * 1000
            }
            date = new Date(time)
        }
        const formatObj = {
            y: date.getFullYear(),
            m: date.getMonth() + 1,
            d: date.getDate(),
            h: date.getHours(),
            i: date.getMinutes(),
            s: date.getSeconds(),
            a: date.getDay()
        }
        const time_str = format.replace(/{([ymdhisa])+}/g, (result, key) => {
            const value = formatObj[key]
            if (key === 'a') { return ['日', '一', '二', '三', '四', '五', '六'][value ] }
            return value.toString().padStart(2, '0')
        })
        return time_str
    }

    // 下载文件
    function download(filename, result) {
        console.log("下载文件列表")
        var text = JSON.stringify(result, null, 4);
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    // 获取当前文件夹 ID
    // 获取当前路径信息（包括 FID 和路径名称）
    function getCurrentPathInfo() {
        let hash = window.location.hash;

        if (hash && hash.includes('/list/')) {
            let parts = hash.split('/');

            // 如果有 fid，返回 fid 和路径，否则返回根目录
            if (parts.length > 3 && parts[3] && parts[3] !== 'all') {
                // 提取 fid 和路径
                let pathParts = [];
                for (let i = 3; i < parts.length; i++) {
                    let part = parts[i];
                    // 解析格式：fid-名称
                    if (part.includes('-')) {
                        let dashIndex = part.indexOf('-');
                        if (dashIndex === 32) {
                            // 标准 fid 格式（32位十六进制）
                            let fid = part.substring(0, 32);
                            let name = decodeURIComponent(part.substring(33));
                            pathParts.push({fid: fid, name: name});
                        } else {
                            // 可能是纯名称
                            pathParts.push({fid: '', name: decodeURIComponent(part)});
                        }
                    }
                }

                if (pathParts.length > 0) {
                    let lastPart = pathParts[pathParts.length - 1];
                    let pathStr = pathParts.map(p => p.name).join('/');
                    return {
                        fid: lastPart.fid,
                        name: lastPart.name,
                        fullPath: '/' + pathStr
                    };
                }
            }
        }

        return {
            fid: '0',
            name: '根目录',
            fullPath: '/'
        };
    }

    // 获取文件列表
    async function listFile(fid, page = 1, pageSize = 100) {
        try {
            let url = `https://drive-pc.quark.cn/1/clouddrive/file/sort`;

            let params = {
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

            let response = await fetch(url + '?' + new URLSearchParams(params), {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('API 请求失败:', response.status, response.statusText);
                return [];
            }

            let data = await response.json();

            if (data.status === 200 && data.data && data.data.list) {
                return data.data.list;
            } else {
                console.error('API 返回格式异常:', data);
            }

            return [];
        } catch (error) {
            console.error('获取文件列表失败:', error);
            return [];
        }
    }

    // 递归收集文件信息
    async function collectFiles(fid, name, result, currentPath = "", isRoot = false) {
        if (!processing) {
            return {size: 0, file_count: 0};
        }

        // 构建当前路径
        let fullPath;
        if (isRoot) {
            // 根调用，使用传入的路径
            fullPath = currentPath;
        } else {
            // 递归调用，追加当前文件夹名
            fullPath = currentPath + "/" + name;
        }

        $("#process_text").text("目录:" + fullPath)
        console.log("扫描:"+fullPath)

        let dir_size = 0;
        let dir_file_count = 0;
        let children = [];

        // 获取文件列表（支持分页）
        let page = 1;
        let pageSize = 100;
        let allFiles = [];

        while (true) {
            if (!processing) break;

            let files = await listFile(fid, page, pageSize);

            if (files.length === 0) break;

            allFiles = allFiles.concat(files);

            // 如果返回的数量少于 pageSize，说明已经是最后一页
            if (files.length < pageSize) break;

            page++;
        }

        if (allFiles.length > 500) {
            console.log("大文件夹:\""+fullPath+"\" ,文件数量:"+allFiles.length)
        }

        for (let index = 0; index < allFiles.length; index++) {
            if (!processing) break;

            let file = allFiles[index];

            // 根据夸克网盘的实际字段
            // file_type: 0=文件夹, 1=文件
            // dir: true=文件夹, false=文件
            let isDir = file.file_type === 0 || file.dir === true;
            let fileName = file.file_name;
            let fileSize = parseInt(file.size) || 0;
            let fileFid = file.fid;

            if (!isDir) {
                // 只在处理文件时更新第二行显示
                $("#process_text_file").text((index + 1)+"/"+allFiles.length+" 文件名: \""+fileName+"\" ,大小:"+formatSize(fileSize))

                // 文件
                children.push({
                    name: fileName,
                    fid: fileFid,
                    value: fileSize,
                    file_count: 1
                });
                dir_size += fileSize;
                dir_file_count++;
            } else {
                // 文件夹 - 递归
                let re = await collectFiles(fileFid, fileName, children, fullPath, false);
                dir_size += re.size;
                dir_file_count += re.file_count;
            }
        }

        result.push({
            name: name,
            fid: fid,
            children: children,
            value: dir_size,
            file_count: dir_file_count
        });

        return {size: dir_size, file_count: dir_file_count};
    }

    function getNodeFileCount(node) {
        if (typeof node.file_count === 'number') {
            return node.file_count;
        }
        if (!Array.isArray(node.children)) {
            return 0;
        }
        return node.children.reduce(function(sum, child) {
            return sum + getNodeFileCount(child);
        }, 0);
    }

    function getNodeChildren(node) {
        if (!Array.isArray(node.children)) {
            return [];
        }
        return node.children.slice().sort(function(a, b) {
            let aChildren = Array.isArray(a.children) && a.children.length > 0;
            let bChildren = Array.isArray(b.children) && b.children.length > 0;
            if (aChildren !== bChildren) {
                return aChildren ? -1 : 1;
            }
            return (b.value || 0) - (a.value || 0);
        });
    }

    function createTreeNode(node, depth) {
        let children = getNodeChildren(node);
        let hasChildren = children.length > 0;
        let item = document.createElement('div');
        item.className = 'quark-tree-item';
        item.dataset.depth = String(depth);

        let row = document.createElement('div');
        row.className = 'quark-tree-row';
        row.style.paddingLeft = (depth * 18 + 10) + 'px';

        let toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'quark-tree-toggle';
        toggle.textContent = hasChildren ? '▾' : '';
        toggle.title = hasChildren ? '展开/折叠' : '';
        row.appendChild(toggle);

        let name = document.createElement('span');
        name.className = 'quark-tree-name';
        name.textContent = node.name || '未命名';
        name.title = node.path || node.name || '';
        row.appendChild(name);

        let count = document.createElement('span');
        count.className = 'quark-tree-count';
        count.textContent = getNodeFileCount(node) + ' 个文件';
        row.appendChild(count);

        let size = document.createElement('span');
        size.className = 'quark-tree-size';
        size.textContent = formatSize(node.value || 0);
        row.appendChild(size);

        item.appendChild(row);

        if (hasChildren) {
            let childContainer = document.createElement('div');
            childContainer.className = 'quark-tree-children';
            children.forEach(function(child) {
                childContainer.appendChild(createTreeNode(child, depth + 1));
            });
            item.appendChild(childContainer);

            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                item.classList.toggle('collapsed');
                toggle.textContent = item.classList.contains('collapsed') ? '▸' : '▾';
            });
        }

        return item;
    }

    // 显示目录树
    function renderTreeView(result) {
        if (result.length === 0) {
            console.log("扫描结果为空，请重试！");
            $("#process_text_file").text("扫描结果为空，请重试！");
            return;
        }

        console.log("显示目录树...")

        if ($("#chartcontainer").length === 0) {
            $("body").prepend(`
            <div id='chartcontainer' style='z-index:99999;background-color: #eee;' >
                <div id='diskusage'></div>
            </div>
            `)
        }

        let root = result[0];
        let diskUsage = document.getElementById("diskusage");
        diskUsage.innerHTML = '';

        let toolbar = document.createElement('div');
        toolbar.className = 'quark-tree-toolbar';

        let title = document.createElement('div');
        title.className = 'quark-tree-title';
        title.textContent = root.name + " 的空间占用";
        toolbar.appendChild(title);

        let actions = document.createElement('div');
        actions.className = 'quark-tree-actions';

        let downloadButton = document.createElement('button');
        downloadButton.type = 'button';
        downloadButton.textContent = '下载列表';
        downloadButton.addEventListener('click', function() {
            download("夸克网盘 " + result[0].name + " 的目录树文件列表 " + parseTime(new Date()) + ".json", result);
        });
        actions.appendChild(downloadButton);

        let maximizeButton = document.createElement('button');
        maximizeButton.type = 'button';
        maximizeButton.textContent = '最大化';
        maximizeButton.addEventListener('click', function() {
            $("#chartcontainer").toggleClass('maximize');
            maximizeButton.textContent = $("#chartcontainer").hasClass('maximize') ? '还原' : '最大化';
        });
        actions.appendChild(maximizeButton);

        let closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = '关闭';
        closeButton.addEventListener('click', function() {
            processing = false;
            $("#chartcontainer").remove();
            $("#process_text_container").remove();
        });
        actions.appendChild(closeButton);

        toolbar.appendChild(actions);
        diskUsage.appendChild(toolbar);

        let summary = document.createElement('div');
        summary.className = 'quark-tree-summary';
        summary.textContent = "共 " + getNodeFileCount(root) + " 个文件，占用 " + formatSize(root.value || 0);
        diskUsage.appendChild(summary);

        let tree = document.createElement('div');
        tree.className = 'quark-tree';
        tree.appendChild(createTreeNode(root, 0));
        diskUsage.appendChild(tree);
    }

    // 初始化按钮事件
    let initButtonEvent = function () {
        if (processing) {
            console.log("分析中,待结束后重试...")
            return;
        }

        $("#chartcontainer").remove()

        if ($("#process_text_container").length === 0) {
            $("body").prepend(`
            <div id='process_text_container'
            style='z-index:9999;width:600px;word-wrap:break-word;position:fixed;right:0;bottom:0;background-color:#990000;font-size:1em;color:white;'>
                <div id='process_text' style='padding:10px;'></div>
                <div id='process_text_file' style='background-color: #009900;padding:10px;'></div>
                <div id='process_stop' style='background-color: #fac858;text-align:center;cursor:pointer;padding:10px;'>点我中断扫描</div>
            </div>
            `)
        }

        $("#process_stop").click(function() {
            processing = false;
        });

        // 获取当前路径信息
        let pathInfo = getCurrentPathInfo();
        let fid = pathInfo.fid;
        let name = pathInfo.name;
        let fullPath = pathInfo.fullPath;

        console.log("开始分析:\""+name+"\"")

        let result = []
        processing = true;
        $('#process_stop').show();

        collectFiles(fid, name, result, fullPath, true).then(function() {
            processing = false;
            $('#process_stop').hide();
            // 显示完成信息，显示完整路径
            $("#process_text").text("已完成对目录: \"" + fullPath + "\" 的扫描！")
            renderTreeView(result)
        });
    };

    // 添加样式
    GM_addStyle(`
    #chartcontainer {
        width: 700px;
        height: 500px;
        position: fixed;
        right: 0px;
        top: 150px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        border: 1px solid #d8dde6;
        border-radius: 6px;
        overflow: hidden;
    }
    #chartcontainer.maximize {
        position: fixed;
        right: 0px;
        top: 0px;
        width: 100%;
        height: 100%;
        border-radius: 0;
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
    .quark-tree-toolbar {
        flex: 0 0 auto;
        min-height: 44px;
        padding: 8px 10px;
        background: #ffffff;
        border-bottom: 1px solid #d8dde6;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
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
        flex: 0 0 auto;
        display: flex;
        gap: 6px;
    }
    .quark-tree-actions button {
        height: 28px;
        padding: 0 10px;
        border: 1px solid #c9d2df;
        border-radius: 4px;
        background: #fff;
        color: #1f2937;
        cursor: pointer;
    }
    .quark-tree-actions button:hover {
        background: #eef5ff;
        border-color: #8ebcf0;
    }
    .quark-tree-summary {
        flex: 0 0 auto;
        padding: 8px 12px;
        color: #4b5563;
        background: #f1f5f9;
        border-bottom: 1px solid #d8dde6;
    }
    .quark-tree {
        flex: 1 1 auto;
        overflow: auto;
        background: #ffffff;
    }
    .quark-tree-row {
        min-height: 30px;
        display: grid;
        grid-template-columns: 22px minmax(160px, 1fr) 92px 96px;
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
        padding-right: 10px;
    }
    .quark-tree-item.collapsed > .quark-tree-children {
        display: none;
    }
    /* 按钮样式 */
    #analyze_button {
        display: inline-flex;
        align-items: center;
        margin-left: 8px;
        padding: 0 12px 0 32px;
        height: 32px;
        background: url(data:image/png;base64,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) 8px center no-repeat;
        background-color: #09AAFF;
        background-size: 16px 16px;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.3s;
    }
    #analyze_button:hover {
        background-color: #0099ee;
        background-image: url(data:image/png;base64,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);
    }
    `);

    let processing = false;
    let buttonAdded = false;

    // 创建并添加按钮
    let start = function () {
        // 检查按钮是否已存在
        if (buttonAdded || document.getElementById('analyze_button')) {
            return true;
        }

        // 多种方式查找按钮容器
        let createFolderBtn = document.querySelector('.btn-create-folder');
        let anyBtn = document.querySelector('.btn-file');
        let toolbar = document.querySelector('.header-toolbar');
        let btnContainer = document.querySelector('.ant-space');

        // 优先尝试插入到新建文件夹按钮旁边
        if (createFolderBtn) {
            try {
                insertButton(createFolderBtn);
                buttonAdded = true;
                return true;
            } catch (e) {
                console.error('插入按钮失败:', e);
            }
        }

        // 尝试查找其他可能的按钮
        if (anyBtn) {
            try {
                insertButton(anyBtn);
                buttonAdded = true;
                return true;
            } catch (e) {
                console.error('插入按钮失败:', e);
            }
        }

        // 尝试查找工具栏容器
        if (toolbar) {
            try {
                appendButton(toolbar);
                buttonAdded = true;
                return true;
            } catch (e) {
                console.error('追加按钮失败:', e);
            }
        }

        if (btnContainer) {
            try {
                appendButton(btnContainer);
                buttonAdded = true;
                return true;
            } catch (e) {
                console.error('追加按钮失败:', e);
            }
        }

        return false;
    };

    // 插入按钮到指定元素后面
    function insertButton(referenceElement) {
        let btn = createButton();
        referenceElement.parentNode.insertBefore(btn, referenceElement.nextSibling);
    }

    // 追加按钮到容器
    function appendButton(container) {
        let btn = createButton();
        container.appendChild(btn);
    }

    // 创建悬浮按钮
    function addFloatingButton() {
        if (buttonAdded || document.getElementById('analyze_button')) {
            return;
        }
        let btn = createButton();
        btn.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 9999;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(btn);
        buttonAdded = true;
    }

    // 创建按钮元素
    function createButton() {
        let btn = document.createElement('button');
        btn.id = 'analyze_button';
        btn.title = '分析当前目录的空间占用情况';
        btn.className = 'u-button nd-file-list-toolbar-action-item is-need-left-sep u-button--success u-button--default u-button--small is-has-icon';
        btn.style.cssText = 'margin-left: 8px; cursor: pointer;';

        // 使用和百度网盘一样的按钮结构，但用 CSS 显示图标
        btn.innerHTML = `<span>分析空间占用</span>`;

        // 绑定点击事件
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            // 检查依赖
            if (typeof $ === 'undefined') {
                alert('jQuery 未加载，请刷新页面重试');
                return;
            }
            try {
                initButtonEvent();
            } catch (error) {
                console.error('执行出错:', error);
                alert('执行出错: ' + error.message);
            }
        });

        return btn;
    }

    // 使用 MutationObserver 监听 DOM 变化
    let observer = new MutationObserver(function(mutations) {
        if (!buttonAdded) {
            start();
        }
    });

    // 等待 jQuery 和页面加载
    Promise.all([
        waitForJQuery(),
        sleep(2000)
    ]).then(() => {
        let success = start();

        if (!success) {
            // 监听整个 body 的变化
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // 10 秒后如果还没成功，添加悬浮按钮
            sleep(10000).then(() => {
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
