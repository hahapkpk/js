// yi_splash_cleaner.js
// 目标：清空小蚁 getPopupWindow 下发的开屏/弹窗/横幅等
let body = $response.body;

try {
  const obj = JSON.parse(body);
  const d = obj && obj.data ? obj.data : null;

  if (d) {
    // 开屏/闪屏
    if (Array.isArray(d.screen)) d.screen = [];

    // 顶部/底部横幅
    if (Array.isArray(d.topBanner)) d.topBanner = [];
    if (Array.isArray(d.bottomBanner)) d.bottomBanner = [];

    // 弹窗/浮窗（不同版本字段可能不同，能清就清）
    if (Array.isArray(d.window)) d.window = [];
    if (Array.isArray(d.newWindow)) d.newWindow = [];
    if (Array.isArray(d.popupWindow)) d.popupWindow = [];

    // 插屏/激励等（有些版本会出现在这个接口）
    if (Array.isArray(d.interstitial)) d.interstitial = [];
    if (Array.isArray(d.rewardedAds)) d.rewardedAds = [];
    if (Array.isArray(d.videoAdvertise)) d.videoAdvertise = [];
  }

  body = JSON.stringify(obj);
} catch (e) {}

$done({ body });
