// tdocs_ad_cleaner.js
// 目标：清空腾讯文档 /api/advertise/tianshu/getads 的广告列表
let body = $response.body;

try {
  const obj = JSON.parse(body);
  const mapAds = obj?.data?.mapAds;

  if (mapAds && typeof mapAds === "object") {
    for (const posId of Object.keys(mapAds)) {
      const slot = mapAds[posId];
      if (slot && Array.isArray(slot.lst)) slot.lst = [];
      if (slot && typeof slot.count === "number") slot.count = 0;
      if (slot && typeof slot.total === "number") slot.total = 0;
    }
  }

  body = JSON.stringify(obj);
} catch (e) {}

$done({ body });
