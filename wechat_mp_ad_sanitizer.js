/***********************************
 * 微信公众号去广告 - Loon Script
 * 作用：
 * 1. 请求阶段：将 /mp/masonryfeed 请求体中的 is_need_ad=1 改为 0
 * 2. 响应阶段：过滤 masonry_feed_item_list 中疑似广告项
 ***********************************/

const url = $request.url || "";
const isRequest = typeof $response === "undefined";

function done(value) {
  try { $done(value || {}); } catch (e) { $done({}); }
}

if (!/\/mp\/masonryfeed\?/.test(url)) {
  done();
} else if (isRequest) {
  let body = $request.body || "";
  if (body) {
    body = body
      .replace(/(^|&)is_need_ad=1(?=&|$)/g, "$1is_need_ad=0")
      .replace(/(^|&)can_show_tag=1(?=&|$)/g, "$1can_show_tag=0");
    done({ body });
  } else {
    done();
  }
} else {
  let body = $response.body || "";
  if (!body) done();

  try {
    const obj = JSON.parse(body);

    if (Array.isArray(obj.masonry_feed_item_list)) {
      obj.masonry_feed_item_list = obj.masonry_feed_item_list.filter((item) => {
        const text = JSON.stringify({
          mp_item_profile: item.mp_item_profile || {},
          rec_info: item.rec_info || "",
          exp_type: item.exp_type || "",
          feed_type: item.feed_type,
          item_show_type: item.item_show_type,
          title: item.title || "",
          nick_name: item.nick_name || ""
        });

        // 日志中出现 mp_item_profile.category = 广告创意，且来自 masonryfeed_interest。
        // 只过滤明确广告/商业推广特征，避免误杀普通公众号文章。
        if (/广告|商业推广|推广|营销/.test(text) && /masonryfeed|interest|related|recommend/.test(text)) return false;
        if (/"is_ad"\s*:\s*(1|true)/i.test(text)) return false;
        if (/"ad_info"\s*:/.test(text)) return false;
        return true;
      });
    }

    // 降低继续拉取广告/推荐的概率，保留正常结构。
    if (typeof obj.continue_flag !== "undefined" && obj.masonry_feed_item_list && obj.masonry_feed_item_list.length === 0) {
      obj.continue_flag = 0;
    }

    done({ body: JSON.stringify(obj) });
  } catch (e) {
    done();
  }
}
