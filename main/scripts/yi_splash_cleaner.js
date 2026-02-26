let body = $response.body;

try {
  const obj = JSON.parse(body);
  const d = obj && obj.data ? obj.data : null;

  if (d) {
    // 开屏/闪屏
    if (Array.isArray(d.screen)) d.screen = [];

    // 首页横幅/弹窗/插屏等（按需清空）
    if (Array.isArray(d.topBanner)) d.topBanner = [];
    if (Array.isArray(d.bottomBanner)) d.bottomBanner = [];
    if (Array.isArray(d.window)) d.window = [];
    if (Array.isArray(d.newWindow)) d.newWindow = [];
    if (Array.isArray(d.interstitial)) d.interstitial = [];
    if (Array.isArray(d.videoAdvertise)) d.videoAdvertise = [];
    if (Array.isArray(d.rewardedAds)) d.rewardedAds = [];

    // 其它信息流/入口（看你需求，可保留或清空）
    // d.information = [];
  }

  body = JSON.stringify(obj);
} catch (e) {}

$done({ body });
