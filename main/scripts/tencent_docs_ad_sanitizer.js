// tencent_docs_ad_sanitizer.js
// 目标：清空腾讯文档广告下发接口 /api/advertise/tianshu/getads 的广告数据
// 思路：保留接口结构，只把广告列表清空，减少副作用

let body = $response.body;

function isObject(x) {
  return x && typeof x === "object";
}

function clearAdsInNode(node) {
  if (!isObject(node)) return;

  if (Array.isArray(node)) {
    // 对数组递归处理；如果是广告列表通常会在对象层被直接置空
    for (const item of node) clearAdsInNode(item);
    return;
  }

  for (const key of Object.keys(node)) {
    const val = node[key];

    // 1) 腾讯文档天枢广告常见结构：mapAds -> posId -> lst
    if (key === "lst" && Array.isArray(val)) {
      node[key] = [];
      continue;
    }

    // 2) 常见广告字段兜底（尽量温和处理）
    const k = key.toLowerCase();
    if (
      k.includes("ad") ||
      k.includes("ads") ||
      k.includes("advert") ||
      k.includes("banner") ||
      k.includes("popup") ||
      k.includes("splash")
    ) {
      if (Array.isArray(val)) node[key] = [];
      else if (typeof val === "string") node[key] = "";
      else if (typeof val === "number") node[key] = 0;
      else if (typeof val === "boolean") node[key] = false;
      else if (isObject(val)) clearAdsInNode(val); // 先递归，不直接清空整个对象，减少误伤
      continue;
    }

    if (isObject(val)) clearAdsInNode(val);
  }
}

try {
  const obj = JSON.parse(body);

  // 精准处理：常见返回结构
  // e.g. data.mapAds["1431"].lst = []
  if (obj && obj.data && obj.data.mapAds && isObject(obj.data.mapAds)) {
    for (const posId of Object.keys(obj.data.mapAds)) {
      const slot = obj.data.mapAds[posId];
      if (slot && Array.isArray(slot.lst)) {
        slot.lst = [];
      }
      // 某些版本可能有其它字段
      if (slot && typeof slot === "object") {
        if ("count" in slot && typeof slot.count === "number") slot.count = 0;
        if ("total" in slot && typeof slot.total === "number") slot.total = 0;
      }
    }
  }

  // 通用兜底
  clearAdsInNode(obj);

  body = JSON.stringify(obj);
} catch (e) {
  // 解析失败时原样返回，避免影响功能
}

$done({ body });