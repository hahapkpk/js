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
assertContains('saveCacheButton', 'cache saving should be manual');
assertContains('loadCacheButton', 'cache loading should be manual');
assertContains('handleSaveCache', 'manual cache save handler should exist');
assertContains('handleLoadCache', 'manual cache load handler should exist');
assertContains('retryFailedButton', 'UI should allow retrying failed directories');
assertContains('expandAllButton', 'tree UI should include expand all');
assertContains('collapseAllButton', 'tree UI should include collapse all');
assertContains('searchInput', 'tree UI should include search');
assertContains('minSizeInput', 'tree UI should include minimum size filtering');
assertContains('sortSelect', 'tree UI should include sort control');
assertContains('modifiedAt', 'tree nodes should retain modified time');
assertContains('quark-tree-modified', 'tree should display modified time');
assertContains('updated-desc', 'sort control should support modified date descending');
assertContains('updated-asc', 'sort control should support modified date ascending');
assertContains('copyPathButton', 'tree UI should allow copying paths');
assertContains('quark-tree-icon', 'tree should show file and folder icons');
assertContains('deleteFolderButton', 'folder rows should expose delete action');
assertContains('deleteQuarkNode', 'script should call Quark delete API for files and folders');
assertContains('handleDeleteNode', 'script should handle delete action for files and folders');
assertContains('deleteQuarkNodes', 'script should support batch delete API calls');
assertContains('handleBatchDelete', 'script should handle selected-node batch delete');
assertContains('selectedFids', 'script should track selected nodes');
assertContains('quark-tree-select', 'tree rows should expose selection checkboxes');
assertContains('selectedCountLabel', 'UI should display selected count');
assertContains('selectVisibleButton', 'UI should allow selecting visible rows');
assertContains('clearSelectionButton', 'UI should allow clearing selection');
assertContains('batchDeleteButton', 'UI should expose batch delete action');
assertContains('getExpandedPaths', 'script should capture expanded folders before rerendering');
assertContains('expandedPaths', 'script should restore expanded folders after rerendering');
assertContains('renderTreeView(currentResult, { expandedPaths })', 'single delete should preserve expansion state');
assertContains('renderTreeView(currentResult, { expandedPaths, clearDeletedSelection: true })', 'batch delete should preserve expansion state');
assertContains('/1/clouddrive/file/delete', 'delete action should use Quark delete endpoint');
assertContains('action_type: 2', 'delete action should move items through Quark delete semantics');
assertContains('filelist: [node.fid]', 'delete action should pass fid list expected by Quark delete API');
assertContains('filelist: fids', 'batch delete action should pass selected fid list');
assertContains('确认删除', 'delete action should require explicit confirmation');
assertContains("item.classList.add('collapsed')", 'folder tree should be collapsed by default');
assertNotContains('prompt(', 'delete action should not require second typed confirmation');
assertNotContains('deleteQuarkFolder', 'delete action should no longer be folder-only');
assertNotContains('handleDeleteFolder', 'delete handler should no longer be folder-only');
assertNotContains('!node || !node.isDir', 'delete action should not exclude files');
assertNotContains('type: "treemap"', 'script should not use the old ECharts treemap renderer');
assertNotContains('echarts.init', 'script should not initialize ECharts for the main view');
assertNotContains('GM_xmlhttpRequest', 'script should not request unused GM_xmlhttpRequest permission');
assertNotContains('jquery-latest.js', 'script should not depend on jQuery CDN');
assertNotContains('waitForJQuery', 'script should not wait for jQuery');
assertNotContains('$(', 'script should not depend on jQuery helpers');
assertNotContains('const cached = !forceRefresh ? loadCachedResult(activePathInfo) : null;', 'scan should not auto-load cache');
assertNotContains('cacheScanResult(activePathInfo, result);', 'scan should not auto-save cache after scanning');

console.log('quark tree userscript validation passed');
