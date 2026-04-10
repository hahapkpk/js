// 凤凰新闻 开屏广告清除
// 适用接口: nine.ifeng.com/startUpAddAd, nine.ifeng.com/startUpAdPrestrainList
// 将响应体替换为空数组 []，APP 读到"无广告"后直接跳过展示

let body = $response.body;

try {
  // 验证原始响应是 JSON（避免误处理）
  JSON.parse(body);
} catch (e) {
  // 非 JSON 响应，不处理
  $done({});
  return;
}

// 返回空数组，APP 不展示任何广告
$done({ body: "[]" });
