// YI Home iOS CMS 广告清理（7.0.6 抓包验证）
// 处理 getPopupWindow（各页面广告位）和 homePagePosition/valid（首页运营入口）
// 保留 JSON 原始外层结构及摄像头/回放/报警快捷入口。

let body = $response.body;

try {
  const obj = JSON.parse(body);
  const data = obj && obj.data;

  if (data && !Array.isArray(data) && typeof data === "object") {
    // CMS getPopupWindow。新增的 information/homeMiddleInformation 等
    // 字段是实际抓包下发的广告位，旧版仅清理了其中部分字段。
    const adSlots = [
      "screen", "topBanner", "bottomBanner", "window", "newWindow",
      "popupWindow", "interstitial", "rewardedAds", "videoAdvertise",
      "information", "profileInformation", "alertInformation",
      "alertHideInformation", "liveBelowInformation",
      "playBackBelowInformation", "homeMiddleInformation",
      "livePageInterstitial", "liveInformation",
      "welfareCenterBottomInformation", "topBeansBanner",
      "bottomBeansBanner"
    ];
    for (const key of adSlots) {
      // 只清空已存在的数组，保留 null/对象类型以免影响客户端解析。
      if (Array.isArray(data[key])) data[key] = [];
    }
  } else if (Array.isArray(data)) {
    // cms/v*/homePagePosition/valid。原始返回 4 项，其中双11狂欢是促销；
    // 保留云回放、多分屏、智能报警，不按位置/ID 粗暴拦截。
    const promotion = /(?:双\s*1[12]|618|狂欢|大促|促销|特惠|优惠|折扣|秒杀|满减|领券|优惠券|红包|购物|商城|买.*送|限时|推广|活动|续费礼包|限时福利|crazybuy|promotion|coupon|discount|shopping|flash\s*sale)/i;
    const essential = /^(?:云回放|多分屏|智能报警|cloud|multiscree(?:n)?|alarm)$/i;
    obj.data = data.filter(item => {
      if (!item || typeof item !== "object") return true;
      const cn = typeof item.nameCn === "string" ? item.nameCn.trim() : "";
      const en = typeof item.nameEn === "string" ? item.nameEn.trim() : "";
      if (essential.test(cn) || essential.test(en)) return true;
      return !promotion.test(cn + " " + en);
    });
  }

  body = JSON.stringify(obj);
} catch (e) {
  // 非 JSON、接口变更或异常时原样放行，避免误伤设备控制。
}

$done({ body });
