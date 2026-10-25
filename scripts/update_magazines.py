#!/usr/bin/env python3
"""Index source metadata only; never download magazine binaries."""
import argparse
from collections import defaultdict
from datetime import date, datetime
import json
import os
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    dict(id='economist', name='📗 经济学人 · The Economist', repo='hehonghui/awesome-english-ebooks', branch='master', prefix='01_economist/'),
    dict(id='time', name='📕 时代 · TIME', repo='Monkfishare/TIME_magazine', branch='main', prefix='TM/'),
]


def api(path):
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'magazine-link-catalog'}
    if os.environ.get('GITHUB_TOKEN'):
        headers['Authorization'] = 'Bearer ' + os.environ['GITHUB_TOKEN']
    for attempt in range(3):
        try:
            with urlopen(Request('https://api.github.com/' + path, headers=headers), timeout=60) as response:
                return json.load(response)
        except (HTTPError, URLError, TimeoutError) as exc:
            if isinstance(exc, HTTPError) and exc.code not in (429, 500, 502, 503, 504):
                raise
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def fetch_tree(source):
    base = 'repos/' + source['repo'] + '/git/trees/'
    result = api(base + source['branch'] + '?recursive=1')
    if not result.get('truncated'):
        return result
    # A truncated recursive response cannot safely replace the existing catalog.
    # Walk non-recursive subtrees instead, using immutable tree SHAs.
    entries = []
    def walk(ref, prefix=''):
        node = api(base + ref)
        if node.get('truncated'):
            raise RuntimeError('Source tree remains truncated: ' + source['repo'])
        for item in node['tree']:
            path = prefix + item['path']
            if item['type'] == 'tree':
                if source['prefix'].startswith(path + '/') or path.startswith(source['prefix']):
                    walk(item['sha'], path + '/')
            else:
                entries.append({**item, 'path': path})
    walk(result['sha'])
    return {'tree': entries, 'truncated': False}


def parse_source(source, tree):
    if tree.get('truncated'):
        raise ValueError('Refusing incomplete source metadata')
    issues = {}
    def priority(item):
        path = item['path']
        dates = re.findall(r'20\d{2}[.-]\d{2}[.-]\d{2}', path)
        matching = len(dates) >= 2 and dates[-1].replace('.', '-') == dates[-2].replace('.', '-')
        return (not matching, len(path.split('/')), path)
    for item in sorted(tree['tree'], key=priority):
        path = item['path']
        ext = path.rsplit('.', 1)[-1].lower()
        if item['type'] != 'blob' or not path.startswith(source['prefix']) or ext not in ('pdf', 'epub'):
            continue
        match = re.search(r'(?<!\d)(20\d{2})[.-](\d{2})[.-](\d{2})(?!\d)', path.rsplit('/', 1)[-1])
        if not match:
            continue
        issue_date = date(*map(int, match.groups())).isoformat()
        issue = issues.setdefault(issue_date, {'date': issue_date, 'files': {}})
        if ext in issue['files']:
            continue  # Prefer matching directory/file dates, then the shortest canonical path.
        issue['files'][ext] = {
            'url': 'https://raw.githubusercontent.com/' + source['repo'] + '/' + source['branch'] + '/' + quote(path, safe='/'),
            'source_url': 'https://github.com/' + source['repo'] + '/blob/' + source['branch'] + '/' + quote(path, safe='/'),
            'sha': item['sha'], 'size': item.get('size', 0),
        }
    if not issues:
        raise ValueError('No issues found; preserving existing catalog: ' + source['repo'])
    return {**source, 'issues': sorted(issues.values(), key=lambda row: row['date'], reverse=True)}


def download(issue, ext):
    file = issue['files'].get(ext)
    return f"[下载 {ext.upper()}]({file['url']})" if file else '未提供'


def render(catalog):
    lines = ['# 英文杂志下载目录', '', '按杂志、年份、月份分类，刊期从新到旧排列。点击下载直达原仓库；本仓库仅保存链接。', '',
             f"目录最后更新：{catalog['updated_at']}（北京时间；链接或源文件发生变化时更新）", '',
             '[查看最近检查记录 / 手动刷新](https://github.com/hahapkpk/js/actions/workflows/update-magazines.yml)', '',
             '[经济学人](#economist) · [TIME 时代](#time)', '', '## 最新刊期', '',
             '| 杂志 | 刊期 | PDF | EPUB |', '|---|---|---|---|']
    for source in catalog['sources']:
        latest = source['issues'][0]
        lines.append(f"| {source['name']} | {latest['date']} | {download(latest, 'pdf')} | {download(latest, 'epub')} |")
    for source in catalog['sources']:
        lines += ['', f'<a id="{source["id"]}"></a>', '', f"## {source['name']}", '',
                  f"来源：[{source['repo']}](https://github.com/{source['repo']}) · 共 {len(source['issues'])} 期", '']
        years = defaultdict(lambda: defaultdict(list))
        for issue in source['issues']:
            years[issue['date'][:4]][issue['date'][5:7]].append(issue)
        latest_month = source['issues'][0]['date'][:7]
        for year, months in sorted(years.items(), reverse=True):
            lines += [f'### {year} 年', '']
            for month, issues in sorted(months.items(), reverse=True):
                opened = ' open' if f'{year}-{month}' == latest_month else ''
                lines += [f'<details{opened}>', f'<summary>{int(month)} 月 · {len(issues)} 期</summary>', '',
                          '| 刊期 | PDF | EPUB | 原目录 |', '|---|---|---|---|']
                for issue in issues:
                    file = next(iter(issue['files'].values()))
                    directory = file['source_url'].rsplit('/', 1)[0].replace('/blob/', '/tree/', 1)
                    lines.append(f"| {issue['date']} | {download(issue, 'pdf')} | {download(issue, 'epub')} | [查看]({directory}) |")
                lines += ['', '</details>', '']
    lines += ['## 更新说明', '',
              '- 每天北京时间 08:25、20:25 自动检查（GitHub 调度可能延迟）；也可在 Actions 中手动运行。',
              '- 仅收录源仓库实际存在的 PDF、EPUB；没有的格式显示“未提供”，不做转换。',
              '- 收录全部当前可见刊期，刊期可能晚于当天日期，以源仓库发布内容为准。',
              '- 每次重新核对完整文件清单，补充后来发布的格式，并移除源仓库已删除的链接。',
              '- 任一来源检查失败则本次不更新目录，保留上次结果；检查状态见 Actions。',
              '- 文件由来源仓库维护，点击后浏览器可能直接预览，可用浏览器的下载或保存功能。',
              '- 更新脚本：[`scripts/update_magazines.py`](../scripts/update_magazines.py)；机器可读清单：[`catalog.json`](catalog.json)。', '']
    return '\n'.join(lines)


def update(output, sources):
    catalog_path = output / 'catalog.json'
    old = json.loads(catalog_path.read_text()) if catalog_path.exists() else {}
    changed = old.get('sources') != sources
    catalog = {'updated_at': datetime.now(ZoneInfo('Asia/Shanghai')).strftime('%Y-%m-%d %H:%M:%S'), 'sources': sources} if changed else old
    output.mkdir(parents=True, exist_ok=True)
    if changed:
        catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    markdown = render(catalog)
    readme = output / 'README.md'
    if not readme.exists() or readme.read_text(encoding='utf-8') != markdown:
        readme.write_text(markdown, encoding='utf-8')
    print('Catalog updated' if changed else 'No source changes')
    for source in sources:
        print(source['id'], len(source['issues']), 'issues; latest:', source['issues'][0]['date'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshots', type=Path, help='Read local metadata fixtures instead of the network')
    args = parser.parse_args()
    sources = []
    for source in SOURCES:
        tree = json.loads((args.snapshots / (source['id'] + '.json')).read_text()) if args.snapshots else fetch_tree(source)
        sources.append(parse_source(source, tree))
    # All sources must succeed before touching either output file.
    update(ROOT / 'magazines', sources)


if __name__ == '__main__':
    main()
