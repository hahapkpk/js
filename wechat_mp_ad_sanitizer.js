/***********************************
 * 微信公众号去广告 - Loon Script
 * 增强版：
 * 1. 请求阶段：关闭 masonryfeed 广告请求参数
 * 2. 响应阶段：强过滤 广告创意 / 推广 / GDT 广告项
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

if (!/\/mp\/masonryfeed\?/.test(url)) {
  done();
}

// 请求阶段
if (isRequest) {
  let body = $request.body || "";

  if (body) {
    body = body
      .replace(/(^|&)is_need_ad=1(?=&|$)/g, "$1is_need_ad=0")
      .replace(/(^|&)can_show_tag=1(?=&|$)/g, "$1can_show_tag=0")
      .replace(/(^|&)tempshow=1(?=&|$)/g, "$1tempshow=0");
  }

  return done({ body });
}

// 响应阶段
let body = $response.body || "";
if (!body) done();

try {
  const obj = JSON.parse(body);

  if (Array.isArray(obj.masonry_feed_item_list)) {
    obj.masonry_feed_item_list = obj.masonry_feed_item_list.filter((item) => {
      const text = JSON.stringify(item);

      // 命中日志：mp_item_profile.category = 广告创意
      if (text.includes('"category":"广告创意"')) return false;

      // 明确广告字段
      if (/"is_ad"\s*:\s*(1|true)/i.test(text)) return false;
      if (/"ad_info"\s*:/i.test(text)) return false;
      if (/"ad_pos"\s*:/i.test(text)) return false;
      if (/"ads"\s*:/i.test(text)) return false;

      // 腾讯广告/GDT/商业推广关键词
      if (/adsmind|gdtimg|wechatad|promotion|promote/i.test(text)) return false;

      // 推荐流中的推广内容
      if ((/广告|推广|商业推广|营销/.test(text)) &&
          (/masonryfeed|related|recommend|interest/.test(text))) {
        return false;
      }

      return true;
    });
  }

  // 如果已经清空，则停止继续请求下一页推荐流
  if (Array.isArray(obj.masonry_feed_item_list) && obj.masonry_feed_item_list.length === 0) {
    obj.continue_flag = 0;
  }

  done({ body: JSON.stringify(obj) });
} catch (e) {
  done();
}
