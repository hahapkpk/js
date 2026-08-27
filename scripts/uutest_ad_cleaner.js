// 测网速（UUSpeedTest）广告响应清理
// 抓包确认接口：http://uapi.uutest.cn/ads/index
// 已确认：
//   ad_type=11 -> iOS启动页广告
//   ad_type=12 -> iOS底部Banner广告
//   ad_type=09 -> iOS内购开关（非广告，必须保留）
//
// 设计目标：只移除真正的广告条目，不破坏其它开关/配置。

let body = $response.body;

try {
  const obj = JSON.parse(body);
  const rows = obj && obj.data && Array.isArray(obj.data.rows)
    ? obj.data.rows
    : null;

  if (rows) {
    obj.data.rows = rows.filter(item => {
      if (!item || typeof item !== "object") return true;

      const name = String(item.name || "").toLowerCase();
      const id = String(item.id || "");

      // 抓包中已确认的两个广告 ID。
      if (id === "10031" || id === "10030") return false;

      // 兼容服务端以后更换 ID，但广告名称仍带这些特征。
      if (/广告|banner|splash|开屏|启动页|插屏/.test(name)) return false;

      return true;
    });
  }

  body = JSON.stringify(obj);
} catch (e) {
  // 非 JSON / 结构变化时原样放行，避免影响测速核心功能。
}

$done({ body });
