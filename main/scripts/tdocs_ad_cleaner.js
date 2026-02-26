let body = $response.body;

try {
  const obj = JSON.parse(body);
  const mapAds = obj?.data?.mapAds;

  if (mapAds && typeof mapAds === "object") {
    for (const posId of Object.keys(mapAds)) {
      if (Array.isArray(mapAds[posId]?.lst)) mapAds[posId].lst = [];
      if (typeof mapAds[posId]?.count === "number") mapAds[posId].count = 0;
      if (typeof mapAds[posId]?.total === "number") mapAds[posId].total = 0;
    }
  }

  body = JSON.stringify(obj);
} catch (e) {}

$done({ body });
