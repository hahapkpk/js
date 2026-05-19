/***********************************
 * 微信公众号去广告 - Loon Script
 * 优化版：
 * 1. masonryfeed 推荐流广告过滤
 * 2. 公众号正文广告容器整体删除
 * 3. 修复接口被拦后残留灰色问号框/空广告框
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
        if (/adsmind|gdtimg|wechatad|promotion|promote|mini_drama|cps/i.test(text)) return false;
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

// 公众号正文 HTML：删除广告容器，避免灰色问号框/空白广告框残留
if (/https?:\/\/mp\.weixin\.qq\.com\/s\?/.test(url) && !isRequest) {
  let body = $response.body || "";
  if (!body || !body.includes("</body>")) return done({ body });

  const inject = `
<style id="wechat-mp-adblock-style">
/* 直接隐藏已知广告容器 */
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
[id*="promotion"] {
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

  var KEYWORDS = [
    '广告', '推广', '了解更多', '下载游戏', '领取优惠', '去观看',
    '精品优售', '广告创意', 'adsmind', 'gdtimg', 'getappmsgad',
    'cps_product_info', 'mini_drama_info', 'WxaDramaCoverImage',
    'ads_svp_video', 'wxsmw.wxs.qq.com'
  ];

  function hasAdText(el) {
    if (!el) return false;
    var text = '';
    try { text = (el.innerText || el.textContent || '') + ' ' + (el.innerHTML || ''); } catch (e) {}
    if (!text) return false;
    return KEYWORDS.some(function (k) { return text.indexOf(k) !== -1; });
  }

  function isAdElement(el) {
    if (!el || el.nodeType !== 1) return false;
    var id = el.id || '';
    var cls = el.className || '';
    var html = '';
    try { html = el.outerHTML || ''; } catch (e) {}
    var mark = (id + ' ' + cls + ' ' + html).toLowerCase();

    if (/js_ad|advert|mpad|cps|mini_drama|promotion|adsmind|gdtimg|wxsmw|ads_svp_video/.test(mark)) return true;
    if (hasAdText(el) && /广告|推广|了解更多|下载游戏|领取优惠|去观看|精品优售/.test(el.innerText || el.textContent || '')) return true;
    return false;
  }

  function findCard(el) {
    var cur = el;
    var article = document.getElementById('js_content') || document.body;
    for (var i = 0; cur && cur !== article && i < 8; i++) {
      var r = cur.getBoundingClientRect ? cur.getBoundingClientRect() : { width: 0, height: 0 };
      var text = cur.innerText || cur.textContent || '';
      // 选取完整广告卡片，不要扩大到整篇正文
      if ((r.width > 240 && r.height > 80 && r.height < 900) || /广告|推广|下载游戏|领取优惠|去观看|了解更多/.test(text)) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return el;
  }

  function removeNode(el) {
    if (!el || !el.parentNode) return;
    var card = findCard(el);
    if (card && card.parentNode) {
      card.style.setProperty('display', 'none', 'important');
      card.style.setProperty('height', '0', 'important');
      card.style.setProperty('min-height', '0', 'important');
      card.style.setProperty('margin', '0', 'important');
      card.style.setProperty('padding', '0', 'important');
      card.style.setProperty('overflow', 'hidden', 'important');
      try { card.remove(); } catch (e) { card.parentNode.removeChild(card); }
    }
  }

  function cleanAds() {
    var selectors = [
      '[class*="js_ad"]', '[id*="js_ad"]',
      '[class*="advert"]', '[id*="advert"]',
      '[class*="mpad"]', '[id*="mpad"]',
      '[class*="cps"]', '[id*="cps"]',
      '[class*="mini_drama"]', '[id*="mini_drama"]',
      '[class*="promotion"]', '[id*="promotion"]',
      'iframe[src*="getappmsgad"]', 'iframe[src*="cps_product_info"]',
      'iframe[src*="mini_drama_info"]', 'iframe[src*="ad"]',
      'img[src*="adsmind"]', 'img[src*="gdtimg"]', 'img[src*="WxaDramaCoverImage"]',
      'video[src*="ads_svp_video"]', 'source[src*="ads_svp_video"]'
    ];

    selectors.forEach(function (sel) {
      try {
        document.querySelectorAll(sel).forEach(removeNode);
      } catch (e) {}
    });

    // 处理截图里的“灰色问号广告框”：资源被拦后，容器仍有“广告”角标和按钮文案
    var nodes = document.querySelectorAll('section, div, p, span');
    nodes.forEach(function (el) {
      if (!el || !el.parentNode) return;
      var text = el.innerText || el.textContent || '';
      if (!text) return;
      if (/广告/.test(text) && /下载游戏|领取优惠|去观看|了解更多|精品优售|福利|优惠/.test(text)) {
        removeNode(el);
        return;
      }
      if (/广告/.test(text)) {
        var box = findCard(el);
        var r = box && box.getBoundingClientRect ? box.getBoundingClientRect() : { width: 0, height: 0 };
        if (r.width > 250 && r.height > 80 && r.height < 900) removeNode(box);
      }
    });
  }

  cleanAds();
  document.addEventListener('DOMContentLoaded', cleanAds);
  window.addEventListener('load', cleanAds);
  setTimeout(cleanAds, 500);
  setTimeout(cleanAds, 1500);
  setTimeout(cleanAds, 3000);

  var observer = new MutationObserver(function () { cleanAds(); });
  observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
})();
</script>
`;

  body = body.replace("</body>", inject + "</body>");
  return done({ body });
}

return done({});
