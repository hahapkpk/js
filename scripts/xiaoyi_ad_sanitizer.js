// xiaoyi_ad_sanitizer.js (lightweight)
// Targets:
// - https://gw.xiaoyi.com/v*/app/config
// - https://gw.xiaoyi.com/vas/v*/equipment/play/bannerList02
// Purpose: remove/disable ads & promo payloads while keeping config shape.

let body = $response.body;

function isObject(x) { return x && typeof x === "object"; }

const AD_KEYWORDS = [
  "ad","ads","advert","advertise","banner","splash","startup",
  "promotion","prom","activity","activities","card","coupon",
  "pop","popup","float","notice","campaign","marketing"
];

function looksLikeAdKey(k) {
  k = String(k).toLowerCase();
  return AD_KEYWORDS.some(w => k.includes(w));
}

function looksLikeAdItem(obj) {
  if (!isObject(obj) || Array.isArray(obj)) return false;
  const keys = Object.keys(obj).map(k => k.toLowerCase());
  const hitStrong = keys.some(k => k.includes("adtype") || k.includes("adtext") || k.includes("adstatus") || k.includes("adtitle"));
  const hitCommon = keys.includes("img") || keys.includes("image") || keys.includes("url") || keys.some(k => k.includes("banner"));
  return hitStrong || (hitCommon && keys.some(looksLikeAdKey));
}

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

  // Known toggles seen in logs
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

  node.adFree = "1";
  node.ad_interval_time = 999999;
}

try {
  const obj = JSON.parse(body);
  sanitize(obj);
  body = JSON.stringify(obj);
} catch (e) {}

$done({ body });
