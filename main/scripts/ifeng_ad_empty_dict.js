// 凤凰新闻 广告配置清空
// 适用接口: nine.ifeng.com/adPreload, nine.ifeng.com/advideopatchconfig
// 保留正常字段结构，仅清空广告数据，避免 APP 报错

let body = $response.body;

try {
  let json = JSON.parse(body);

  // 清空 adPreload 的预加载 ID 列表
  if (json.data && json.data.preloadIds) {
    json.data.preloadIds = [];
  }

  // 清空 advideopatchconfig 的广告配置（通常是顶层数组或 data 字段）
  if (Array.isArray(json)) {
    $done({ body: "[]" });
    return;
  }
  if (json.data && Array.isArray(json.data)) {
    json.data = [];
  }

  $done({ body: JSON.stringify(json) });
} catch (e) {
  // 解析失败时返回通用空字典
  $done({ body: '{"code":0,"msg":"OK","data":{}}' });
}
