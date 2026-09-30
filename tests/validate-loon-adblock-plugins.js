const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const repoRoot = path.resolve(__dirname, "..");
const plugins = new Map([
  ["Yi_TencentDocs_AdBlock.plugin", 3],
  ["main/iFengNews_AdBlock.plugin", 2],
  ["main/TencentDocs_AdBlock.plugin", 1],
  ["main/myadblock.plugin", 3],
  ["main/YiHome_AdBlock.plugin", 2],
]);
const rawPrefix = "https://raw.githubusercontent.com/hahapkpk/js/main/";

function scriptLines(source) {
  let section = "";
  const result = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      section = header[1];
      continue;
    }
    if (section === "Script" && line && !line.startsWith("#")) result.push(line);
  }

  return result;
}

for (const [relativePath, expectedCount] of plugins) {
  const fullPath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(fullPath, "utf8");

  if (/script-response-body/.test(source) || /^\s*\w+\s*=\s*type=http-/m.test(source)) {
    throw new Error(`${relativePath}: still contains non-Loon script alias syntax`);
  }

  const entries = scriptLines(source);
  if (entries.length !== expectedCount) {
    throw new Error(`${relativePath}: expected ${expectedCount} script entries, got ${entries.length}`);
  }

  const seenPatterns = new Set();
  for (const entry of entries) {
    const match = entry.match(
      /^response if \$\{url\} ~= \/(.+)\/ then script\("(https:\/\/[^" ]+\.js)"\) with requires_body=true, timeout=(\d+), tag="([^"]+)"$/,
    );
    if (!match) throw new Error(`${relativePath}: invalid Loon script entry: ${entry}`);

    const [, escapedPattern, scriptUrl, timeout, tag] = match;
    if (Number(timeout) <= 0 || !tag.trim()) {
      throw new Error(`${relativePath}: timeout and tag must be valid`);
    }
    if (seenPatterns.has(escapedPattern)) {
      throw new Error(`${relativePath}: duplicate response pattern: ${escapedPattern}`);
    }
    seenPatterns.add(escapedPattern);

    // Loon regexes escape URL slashes; JavaScript RegExp accepts the unescaped equivalent.
    new RegExp(escapedPattern.replaceAll("\\/", "/"), "i");

    if (!scriptUrl.startsWith(rawPrefix)) {
      throw new Error(`${relativePath}: unexpected script host or branch: ${scriptUrl}`);
    }
    const localScript = path.join(repoRoot, decodeURIComponent(scriptUrl.slice(rawPrefix.length)));
    if (!fs.existsSync(localScript)) {
      throw new Error(`${relativePath}: script target does not exist: ${localScript}`);
    }
    new vm.Script(fs.readFileSync(localScript, "utf8"), { filename: localScript });
  }
}

function runResponseScript(relativePath, body) {
  let result;
  const context = {
    $response: { body },
    $done(value) {
      result = value;
    },
  };
  const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  new vm.Script(source, { filename: relativePath }).runInNewContext(context);
  assert.notEqual(result, undefined, `${relativePath}: $done was not called`);
  return result;
}

const xiaoyi = JSON.parse(
  runResponseScript("scripts/xiaoyi_ad_sanitizer.js", '{"data":{"banner":[1],"normal":"ok"}}').body,
);
assert.deepEqual(xiaoyi.data.banner, []);
assert.equal(xiaoyi.data.normal, "ok");

const splash = JSON.parse(
  runResponseScript("scripts/yi_splash_cleaner.js", '{"data":{"screen":[1],"topBanner":[2]}}').body,
);
assert.deepEqual(splash.data.screen, []);
assert.deepEqual(splash.data.topBanner, []);

const tdocs = JSON.parse(
  runResponseScript(
    "scripts/tdocs_ad_cleaner.js",
    '{"data":{"mapAds":{"slot":{"lst":[1],"count":1,"total":1}}}}',
  ).body,
);
assert.deepEqual(tdocs.data.mapAds.slot, { lst: [], count: 0, total: 0 });

assert.equal(runResponseScript("main/scripts/ifeng_splash_cleaner.js", "{}").body, "[]");
assert.equal(
  JSON.stringify(runResponseScript("main/scripts/ifeng_splash_cleaner.js", "not-json")),
  "{}",
);

const ifengConfig = JSON.parse(
  runResponseScript("main/scripts/ifeng_ad_empty_dict.js", '{"data":{"preloadIds":[1]}}').body,
);
assert.deepEqual(ifengConfig.data.preloadIds, []);

console.log(
  `Validated ${plugins.size} Loon plugins, all referenced JavaScript files, and representative response rewrites.`,
);
