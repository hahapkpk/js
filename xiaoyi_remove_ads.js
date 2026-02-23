// xiaoyi_remove_ads.js
// 目标：去首页活动入口/横幅，关闭三方广告开关
// 适配接口：https://gw.xiaoyi.com/v5/app/config

let body = $response.body;

try {
  const obj = JSON.parse(body);
  const d = obj && obj.data ? obj.data : null;

  if (d) {
    // 1) 顶部活动入口（日志里 prom_activities 下发）
    if (d.prom_activities) {
      d.prom_activities.market_activities_flag = "0";
      d.prom_activities.market_activities_icon = "";
      d.prom_activities.market_activities_lottery_address = "";
    }

    // 2) 首页 banner / 卡片 / 动画
    d.ad_card = {};        // 首页横幅卡片
    d.ad_animation = {};   // 背景/动画
    d.adsUrl = {};         // 广告 URL 集合（有些版本会用）

    // 3) 三方广告开关（关掉 is_show）
    if (d["3rdparty_ads"]) {
      if (d["3rdparty_ads"].is_show) {
        d["3rdparty_ads"].is_show.mi = false;
        d["3rdparty_ads"].is_show.tencent = false;
      }
      d["3rdparty_ads"].backgroundSwitch = "0";
      d["3rdparty_ads"].distribution = { mi: 0, tencent: 0 };
    }

    // 4) 标记免广告（有些版本会读 adFree）
    d.adFree = "1";

    // 5) 广告展示间隔（防止“兜底再弹”）
    d.ad_interval_time = 999999;
  }

  body = JSON.stringify(obj);
} catch (e) {
  // 解析失败就原样返回
}

$done({ body });
