/***********************************
 * 微信公众号去广告 - Loon Script
 * 反馈链路增强版：
 * 1. masonryfeed 推荐流广告过滤
 * 2. 公众号正文 /s? /s/ 广告容器整体删除
 * 3. 公众号主页/历史消息页 profile_ext 广告容器删除
 * 4. 利用 feedback.html / feedback_icon / ad_widget 特征删除广告卡片
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

// masonryfeed 请求与响应处理
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
        if (/adsmind|gdtimg|wechatad|promotion|promote|mini_drama|cps|feedback\.html|ad_widget/i.test(text)) return false;
        if ((/广告|推广|商业推广|营销/.test(text)) && /masonryfeed|related|recommend|interest/.test(text)) return false;
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

// 公众号正文页 / 公众号主页历史页 HTML：删除广告容器，避免空白框残留
if (/https?:\/\/mp\.weixin\.qq\.com\/(?:s(?:\/|\?)|mp\/profile_ext\?)/.test(url) && !isRequest) {
  let body = $response.body || "";
  if (!body || !body.includes("</body>")) return done({ body });

  const inject = `
<style id="wechat-mp-adblock-style">
.js_ad_link,
.js_ad_area,
.js_ad_card,
.js_ad_video,
.js_ad_iframe,
.js_ad_box,
.rich_media_ad,
.rich_media_ad_default,
.mpda_bottom_container,
.wxwcpay_ad_container,
[class*="js_ad"],
[id*="js_ad"],
[class*="advert"],
[id*="advert"],
[class*="mpad"],
[id*="mpad"],
[class*="cps"],
[id*="cps"],
[class*="mini_drama"],
[id*="mini_drama"],
[class*="promotion"],
[id*="promotion"],
[class*="ad_area"],
[id*="ad_area"],
[href*="feedback.html"],
[src*="feedback_icon"],
[style*="feedback_icon"],
[data-url*="feedback.html"],
[onclick*="feedback"],
[class*="feedback"],
[id*="feedback"] {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}
</style>
<script id="wechat-mp-adblock-script">
(function () {
  'use strict';

  var BTN_RE = /下载游戏|领取优惠|立即购买|立即下载|去观看|查看|了解更多|点击了解更多|精品优售|福利|优惠|换购|折抵优惠|不感兴趣|与我无关|重复收到多次|内容太差|反馈问题/;
  var AD_RE = /广告|推广|广告创意|adsmind|gdtimg|getappmsgad|cps_product_info|mini_drama_info|WxaDramaCoverImage|ads_svp_video|wxsmw\.wxs\.qq\.com|feedback\.html|feedback_icon|ad_widget/;
  var CLASS_RE = /js_ad|advert|mpad|cps|mini_drama|promotion|adsmind|gdtimg|wxsmw|ads_svp_video|ad_area|ad_card|feedback|ad_widget/i;

  function textOf(el) {
    try { return (el.innerText || el.textContent || '') + ' ' + (el.innerHTML || ''); } catch (e) { return ''; }
  }

  function rectOf(el) {
    try { return el.getBoundingClientRect(); } catch (e) { return { width: 0, height: 0, top: 0 }; }
  }

  function markOf(el) {
    if (!el || el.nodeType !== 1) return '';
    var id = el.id || '';
    var cls = '';
    try { cls = typeof el.className === 'string' ? el.className : ''; } catch (e) {}
    var html = '';
    try { html = el.outerHTML || ''; } catch (e) {}
    return id + ' ' + cls + ' ' + html;
  }

  function hasFeedbackSignal(el) {
    var mark = markOf(el);
    return /feedback\.html|feedback_icon|ad_widget|不感兴趣|与我无关|重复收到多次|内容太差|反馈问题/i.test(mark + ' ' + textOf(el));
  }

  function isProbablyAd(el) {
    if (!el || el.nodeType !== 1) return false;
    var text = textOf(el);
    var mark = markOf(el);
    if (CLASS_RE.test(mark)) return true;
    if (hasFeedbackSignal(el)) return true;
    if (/src=["'][^"']*(adsmind|gdtimg|ads_svp_video|WxaDramaCoverImage|getappmsgad|cps_product_info|mini_drama_info|feedback_icon)/i.test(mark)) return true;
    if (/href=["'][^"']*feedback\.html/i.test(mark)) return true;
    if (AD_RE.test(text) && BTN_RE.test(text)) return true;
    if (/广告/.test(text)) {
      var r = rectOf(el);
      if (r.width > 220 && r.height > 50 && r.height < 1000) return true;
    }
    return false;
  }

  function findBestCard(el) {
    var cur = el;
    var root = document.getElementById('js_content') || document.getElementById('js_profile') || document.body;
    var best = el;
    for (var i = 0; cur && cur !== root && cur !== document.body && i < 12; i++) {
      var r = rectOf(cur);
      var text = textOf(cur);
      var mark = markOf(cur);
      var looksLikeCard = r.width > 240 && r.height > 60 && r.height < 1000;
      var hasAdSignal = /广告|推广/.test(text) || BTN_RE.test(text) || CLASS_RE.test(mark) || /feedback\.html|feedback_icon|ad_widget/.test(mark);
      if (looksLikeCard && hasAdSignal) best = cur;
      if (r.height > 1100 || text.length > 1600) break;
      cur = cur.parentElement;
    }
    return best || el;
  }

  function removeCard(el) {
    if (!el || !el.parentNode) return;
    var card = findBestCard(el);
    if (!card || !card.parentNode) return;
    card.style.setProperty('display', 'none', 'important');
    card.style.setProperty('visibility', 'hidden', 'important');
    card.style.setProperty('height', '0', 'important');
    card.style.setProperty('min-height', '0', 'important');
    card.style.setProperty('margin', '0', 'important');
    card.style.setProperty('padding', '0', 'important');
    card.style.setProperty('overflow', 'hidden', 'important');
    try { card.remove(); } catch (e) { try { card.parentNode.removeChild(card); } catch (e2) {} }
  }

  function cleanBySelectors() {
    var selectors = [
      '[class*="js_ad"]', '[id*="js_ad"]',
      '[class*="advert"]', '[id*="advert"]',
      '[class*="mpad"]', '[id*="mpad"]',
      '[class*="cps"]', '[id*="cps"]',
      '[class*="mini_drama"]', '[id*="mini_drama"]',
      '[class*="promotion"]', '[id*="promotion"]',
      '[class*="ad_area"]', '[id*="ad_area"]',
      '[class*="feedback"]', '[id*="feedback"]',
      'a[href*="feedback.html"]', '[data-url*="feedback.html"]', '[onclick*="feedback"]',
      'img[src*="feedback_icon"]', '[style*="feedback_icon"]',
      'iframe[src*="getappmsgad"]', 'iframe[src*="cps_product_info"]',
      'iframe[src*="mini_drama_info"]', 'iframe[src*="/ad"]',
      'img[src*="adsmind"]', 'img[src*="gdtimg"]', 'img[src*="WxaDramaCoverImage"]',
      'video[src*="ads_svp_video"]', 'source[src*="ads_svp_video"]'
    ];
    selectors.forEach(function (sel) {
      try { document.querySelectorAll(sel).forEach(removeCard); } catch (e) {}
    });
  }

  function cleanByText() {
    var nodes = document.querySelectorAll('section, div, li, article');
    nodes.forEach(function (el) {
      if (!el || !el.parentNode) return;
      if (isProbablyAd(el)) removeCard(el);
    });
  }

  function cleanBrokenAdBoxes() {
    var nodes = document.querySelectorAll('section, div, li');
    nodes.forEach(function (el) {
      if (!el || !el.parentNode) return;
      var text = textOf(el);
      var r = rectOf(el);
      if (r.width > 240 && r.height > 100 && r.height < 1000 && (/广告/.test(text) || hasFeedbackSignal(el))) {
        removeCard(el);
      }
    });
  }

  function cleanAds() {
    cleanBySelectors();
    cleanByText();
    cleanBrokenAdBoxes();
  }

  cleanAds();
  document.addEventListener('DOMContentLoaded', cleanAds);
  window.addEventListener('load', cleanAds);
  [100, 300, 800, 1500, 3000, 5000, 8000, 12000].forEach(function (t) { setTimeout(cleanAds, t); });

  var observer = new MutationObserver(function () { cleanAds(); });
  observer.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'src', 'href'] });
})();
</script>
`;

  body = body.replace("</body>", inject + "</body>");
  return done({ body });
}

return done({});
