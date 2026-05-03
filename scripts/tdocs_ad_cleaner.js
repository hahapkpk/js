// tdocs_ad_cleaner.js
// Target: https://docs.qq.com/api/advertise/tianshu/getads
// Clears ad list for all posIds while keeping response shape.

let body = $response.body;

try {
  const obj = JSON.parse(body);
  const mapAds = obj && obj.data ? obj.data.mapAds : null;

  if (mapAds && typeof mapAds === 'object') {
    for (const posId of Object.keys(mapAds)) {
      const slot = mapAds[posId];
      if (slot && Array.isArray(slot.lst)) slot.lst = [];
      if (slot && typeof slot.count === 'number') slot.count = 0;
      if (slot && typeof slot.total === 'number') slot.total = 0;
    }
  }

  body = JSON.stringify(obj);
} catch (e) {}

$done({ body });
