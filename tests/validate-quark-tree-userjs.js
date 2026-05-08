const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, '..', 'quark-disk-space-tree.user.js');
const source = fs.readFileSync(scriptPath, 'utf8');

function assertContains(fragment, message) {
  if (!source.includes(fragment)) {
    throw new Error(message);
  }
}

function assertNotContains(fragment, message) {
  if (source.includes(fragment)) {
    throw new Error(message);
  }
}

assertContains('@name         夸克网盘空间占用目录树', 'userscript name should describe tree view');
assertContains('@match        https://pan.quark.cn/*', 'userscript should target Quark cloud disk');
assertContains('@namespace    https://github.com/hahapkpk/js', 'namespace should point to the maintained repo');
assertContains('@homepage     https://github.com/hahapkpk/js', 'homepage should point to the maintained repo');
assertContains('@supportURL   https://github.com/hahapkpk/js/issues', 'support URL should point to repo issues');
assertContains('renderTreeView(result)', 'script should render the scan result as a tree view');
assertContains('createTreeNode(node, depth)', 'script should build expandable tree nodes');
assertContains('quark-tree-toggle', 'tree nodes should expose expand/collapse controls');
assertContains('quark-tree-size', 'tree nodes should show formatted size');
assertContains('quark-tree-count', 'tree nodes should show file count');
assertContains('download("夸克网盘 " + result[0].name + " 的目录树文件列表 "', 'download action should remain available');
assertContains('MAX_CONCURRENT_REQUESTS', 'scanner should define a controlled concurrency limit');
assertContains('runConcurrentTasks', 'scanner should use a concurrent task queue');
assertContains('updateProgress', 'scanner should expose live progress updates');
assertContains('cacheScanResult', 'scanner should cache completed scan results');
assertContains('loadCachedResult', 'scanner should read cached scan results');
assertContains('retryFailedButton', 'UI should allow retrying failed directories');
assertContains('expandAllButton', 'tree UI should include expand all');
assertContains('collapseAllButton', 'tree UI should include collapse all');
assertContains('searchInput', 'tree UI should include search');
assertContains('minSizeInput', 'tree UI should include minimum size filtering');
assertContains('sortSelect', 'tree UI should include sort control');
assertContains('copyPathButton', 'tree UI should allow copying paths');
assertContains('quark-tree-icon', 'tree should show file and folder icons');
assertNotContains('type: "treemap"', 'script should not use the old ECharts treemap renderer');
assertNotContains('echarts.init', 'script should not initialize ECharts for the main view');
assertNotContains('GM_xmlhttpRequest', 'script should not request unused GM_xmlhttpRequest permission');
assertNotContains('jquery-latest.js', 'script should not depend on jQuery CDN');
assertNotContains('waitForJQuery', 'script should not wait for jQuery');
assertNotContains('$(', 'script should not depend on jQuery helpers');

console.log('quark tree userscript validation passed');
