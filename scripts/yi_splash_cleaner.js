// YI Home iOS CMS 广告清理（7.0.6 抓包验证）
// 处理 getPopupWindow（各页面广告位）和 homePagePosition/valid（首页运营入口）
// 保留 JSON 原始外层结构；首页仅保留“多分屏”快捷入口。

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
  } else if (Array.isArray(data) &&
             /\/cms\/v\d+\/homePagePosition\/valid(?:[?#]|$)/.test($request.url || "")) {
    // 仅保留首页“多分屏”。抓包确认 id=28，nameEn=MultiScree；
    // 云回放、智能报警、双11促销和未来新增的推广入口都不会下发到首页。
    // 只过滤 CMS 的快捷入口列表，不影响设备、录像或报警接口。
    obj.data = data.filter(item => {
      if (!item || typeof item !== "object") return false;
      const cn = typeof item.nameCn === "string" ? item.nameCn.trim() : "";
      const en = typeof item.nameEn === "string" ? item.nameEn.trim() : "";
      return Number(item.id) === 28 || cn === "多分屏" || /^MultiScree(n)?$/i.test(en);
    });
  }

  body = JSON.stringify(obj);
} catch (e) {
  // 非 JSON、接口变更或异常时原样放行，避免误伤设备控制。
}

$done({ body });
