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
assertContains('renderTreeView(result)', 'script should render the scan result as a tree view');
assertContains('createTreeNode(node, depth)', 'script should build expandable tree nodes');
assertContains('quark-tree-toggle', 'tree nodes should expose expand/collapse controls');
assertContains('quark-tree-size', 'tree nodes should show formatted size');
assertContains('quark-tree-count', 'tree nodes should show file count');
assertContains('download("夸克网盘 " + result[0].name + " 的目录树文件列表 "', 'download action should remain available');
assertNotContains('type: "treemap"', 'script should not use the old ECharts treemap renderer');
assertNotContains('echarts.init', 'script should not initialize ECharts for the main view');

console.log('quark tree userscript validation passed');
