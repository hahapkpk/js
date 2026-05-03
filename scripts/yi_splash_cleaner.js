// yi_splash_cleaner.js
// Target: https://gw.xiaoyi.com/cms/v*/banner/getPopupWindow
// Removes splash/top banners/popups delivered by this endpoint.

let body = $response.body;

try {
  const obj = JSON.parse(body);
  const d = obj && obj.data ? obj.data : null;

  if (d) {
    if (Array.isArray(d.screen)) d.screen = [];
    if (Array.isArray(d.topBanner)) d.topBanner = [];
    if (Array.isArray(d.bottomBanner)) d.bottomBanner = [];

    if (Array.isArray(d.window)) d.window = [];
    if (Array.isArray(d.newWindow)) d.newWindow = [];
    if (Array.isArray(d.popupWindow)) d.popupWindow = [];

    if (Array.isArray(d.interstitial)) d.interstitial = [];
    if (Array.isArray(d.rewardedAds)) d.rewardedAds = [];
    if (Array.isArray(d.videoAdvertise)) d.videoAdvertise = [];
  }

  body = JSON.stringify(obj);
} catch (e) {}

$done({ body });
