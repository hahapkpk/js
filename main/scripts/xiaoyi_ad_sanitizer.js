// xiaoyi_ad_sanitizer.js (增强版)
// 目标：清空广告/运营下发包，但尽量不破坏非广告配置
// 已针对：/v*/app/config、/vas/v*/equipment/play/bannerList02、/cms/v*/banner/getPopupWindow

let body = $response.body;

function isObject(x) {
  return x && typeof x === "object";
}

// 命中这些关键词的 key，我们倾向认为是广告/运营字段
const AD_KEYWORDS = [
  "ad", "ads", "advert", "advertise", "banner", "splash", "startup",
  "promotion", "prom", "activity", "activities", "card", "coupon",
  "pop", "popup", "float", "notice", "campaign", "marketing"
];

function looksLikeAdKey(k) {
  k = String(k).toLowerCase();
  return AD_KEYWORDS.some(w => k.includes(w));
}

// 判断一个对象是否“很像广告条目”
function looksLikeAdItem(obj) {
  if (!isObject(obj) || Array.isArray(obj)) return false;
  const keys = Object.keys(obj).map(k => k.toLowerCase());

  const hitStrong =
    keys.some(k => k.includes("adtype")) ||
    keys.some(k => k.includes("adtext")) ||
    keys.some(k => k.includes("adstatus")) ||
    keys.some(k => k.includes("adtitle"));

  const hitCommon =
    keys.includes("img") ||
    keys.includes("image") ||
    keys.includes("url") ||
    keys.some(k => k.includes("banner")) ||
    keys.some(k => k.includes("popup"));

  if (hitStrong) return true;
  return hitCommon && keys.some(looksLikeAdKey);
}

// 递归净化：
// - 数组中若元素像广告条目：直接移除（最干净）
// - 对象中若 key 像广告字段：清空值（减少副作用）
function sanitize(node) {
  if (!isObject(node)) return;

  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      const v = node[i];
      if (looksLikeAdItem(v)) {
        node.splice(i, 1);
        continue;
      }
      if (isObject(v)) sanitize(v);
    }
    return;
  }

  for (const k of Object.keys(node)) {
    const v = node[k];

    if (looksLikeAdKey(k)) {
      if (typeof v === "string") node[k] = "";
      else if (typeof v === "number") node[k] = 0;
      else if (typeof v === "boolean") node[k] = false;
      else if (Array.isArray(v)) node[k] = [];
      else if (isObject(v)) node[k] = {};
      continue;
    }

    if (isObject(v)) sanitize(v);
  }

  // 针对已知字段额外强制关闭
  if (node.prom_activities) {
    node.prom_activities.market_activities_flag = "0";
    node.prom_activities.market_activities_icon = "";
    node.prom_activities.market_activities_lottery_address = "";
  }

  if (node["3rdparty_ads"]) {
    const t = node["3rdparty_ads"];
    if (t.is_show) {
      t.is_show.mi = false;
      t.is_show.tencent = false;
    }
    t.backgroundSwitch = "0";
    t.distribution = { mi: 0, tencent: 0 };
  }

  // 兜底：部分版本会读取这些字段
  node.adFree = "1";
  node.ad_interval_time = 999999;
}

try {
  const obj = JSON.parse(body);
  sanitize(obj);
  body = JSON.stringify(obj);
} catch (e) {}

$done({ body });