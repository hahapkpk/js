// YI Home config 去广告
// 目标接口：https://gw.xiaoyi.com/v5/app/config

let body = $response.body;

try {
  const obj = JSON.parse(body);
  const d = obj && obj.data ? obj.data : null;

  if (d) {
    // 顶部活动入口（运营入口）
    if (d.prom_activities) {
      d.prom_activities.market_activities_flag = "0";
      d.prom_activities.market_activities_icon = "";
      d.prom_activities.market_activities_lottery_address = "";
    }

    // 首页 banner / 卡片 / 动画
    d.ad_card = {};
    d.ad_animation = {};
    d.adsUrl = {};

    // 关三方广告开关
    if (d["3rdparty_ads"]) {
      if (d["3rdparty_ads"].is_show) {
        d["3rdparty_ads"].is_show.mi = false;
        d["3rdparty_ads"].is_show.tencent = false;
      }
      d["3rdparty_ads"].backgroundSwitch = "0";
      d["3rdparty_ads"].distribution = { mi: 0, tencent: 0 };
    }

    // 兜底：标记免广告 & 拉长间隔
    d.adFree = "1";
    d.ad_interval_time = 999999;
  }

  body = JSON.stringify(obj);
} catch (e) {}

$done({ body });
