/***********************************
 * 微信公众号去广告 - Loon Script
 * 当前处理：
 * 1. masonryfeed 推荐流广告
 * 2. 正文 HTML 中的广告卡片/CPS/短剧推广
 * 3. 评论区广告样式隐藏
 ***********************************/

const url = $request.url || "";
const isRequest = typeof $response === "undefined";

function done(value) {
  try {
    $done(value || {});
  } catch (e) {
    $done({});
  }
}

// masonryfeed 请求参数处理
if (/\/mp\/masonryfeed\?/.test(url)) {
  if (isRequest) {
    let body = $request.body || "";

    body = body
      .replace(/(^|&)is_need_ad=1(?=&|$)/g, "$1is_need_ad=0")
      .replace(/(^|&)can_show_tag=1(?=&|$)/g, "$1can_show_tag=0")
      .replace(/(^|&)tempshow=1(?=&|$)/g, "$1tempshow=0");

    return done({ body });
  }

  let body = $response.body || "";

  try {
    const obj = JSON.parse(body);

    if (Array.isArray(obj.masonry_feed_item_list)) {
      obj.masonry_feed_item_list = obj.masonry_feed_item_list.filter((item) => {
        const text = JSON.stringify(item);

        if (text.includes('"category":"广告创意"')) return false;
        if (/"is_ad"\s*:\s*(1|true)/i.test(text)) return false;
        if (/"ad_info"\s*:/i.test(text)) return false;
        if (/"ad_pos"\s*:/i.test(text)) return false;
        if (/"ads"\s*:/i.test(text)) return false;
        if (/adsmind|gdtimg|wechatad|promotion|promote/i.test(text)) return false;

        if ((/广告|推广|商业推广|营销/.test(text)) &&
            (/masonryfeed|related|recommend|interest/.test(text))) {
          return false;
        }

        return true;
      });
    }

    if (Array.isArray(obj.masonry_feed_item_list) && obj.masonry_feed_item_list.length === 0) {
      obj.continue_flag = 0;
    }

    return done({ body: JSON.stringify(obj) });
  } catch (e) {
    return done({});
  }
}

// 公众号正文 HTML 广告隐藏
if (/https?:\/\/mp\.weixin\.qq\.com\/s\?/.test(url) && !isRequest) {
  let body = $response.body || "";

  if (!body.includes('</body>')) {
    return done({ body });
  }

  const css = `
<style id="wechat-adblock-style">
/* 广告标签 */
.weui-msg__desc,
.wxwcpay_ad_container,
.rich_media_area_extra:has(.adsbygoogle),
.rich_media_area_extra:has([class*=ad]),
.rich_media_area_extra:has([id*=ad]),
[class*="js_ad"],
[id*="js_ad"],
[class*="advert"],
[id*="advert"],
[class*="promotion"],
[id*="promotion"],
[class*="cps"],
[id*="cps"],
[class*="mini_drama"],
[id*="mini_drama"],
section:has(.weui-icon-info),
div:has(> span:contains("广告")),
div:has(> span:contains("推广")) {
    display:none !important;
    visibility:hidden !important;
    height:0 !important;
    min-height:0 !important;
    overflow:hidden !important;
}
</style>
`;

  body = body.replace('</body>', css + '</body>');

  return done({ body });
}

return done({});
