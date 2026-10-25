import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('catalog', Path(__file__).resolve().parents[1] / 'scripts/update_magazines.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class CatalogTests(unittest.TestCase):
    def fixture(self):
        return {'truncated': False, 'tree': [
            {'path': p, 'type': 'blob', 'sha': 'abc', 'size': 12}
            for p in ['01_economist/te_2026.10.03/TheEconomist.2026.10.03.epub',
                      '01_economist/te_2026.09.26/TheEconomist.2026.09.26.pdf',
                      '05_wired/2026.10.02/wired_2026.10.02.pdf']]}

    def test_formats_dates_scope_and_external_links(self):
        result = m.parse_source(m.SOURCES[0], self.fixture())
        self.assertEqual([x['date'] for x in result['issues']], ['2026-10-03', '2026-09-26'])
        self.assertEqual(m.download(result['issues'][0], 'pdf'), '未提供')
        self.assertIn('raw.githubusercontent.com/hehonghui/', m.download(result['issues'][0], 'epub'))
        with TemporaryDirectory() as tmp:
            out = Path(tmp)
            m.update(out, [result])
            before = {p.name: p.read_bytes() for p in out.iterdir()}
            m.update(out, [result])
            self.assertEqual(before, {p.name: p.read_bytes() for p in out.iterdir()})
            text = (out / 'README.md').read_text()
            self.assertIn('### 2026 年', text)
            self.assertIn('<summary>10 月', text)
            self.assertIn('<details open>', text)

    def test_incomplete_or_empty_metadata_rejected(self):
        with self.assertRaises(ValueError):
            m.parse_source(m.SOURCES[0], {'truncated': True, 'tree': []})
        with self.assertRaises(ValueError):
            m.parse_source(m.SOURCES[0], {'tree': []})

    def test_misfiled_duplicate_uses_filename_date_and_canonical_path(self):
        tree = self.fixture()
        tree['tree'].append(dict(tree['tree'][0], path='01_economist/2026/te_2026.10.10/TheEconomist.2026.10.03.epub'))
        issues = m.parse_source(m.SOURCES[0], tree)['issues']
        self.assertEqual(len(issues), 2)
        self.assertIn('/te_2026.10.03/', issues[0]['files']['epub']['url'])

    def test_added_format_and_deleted_file_are_reflected(self):
        tree = self.fixture()
        before = m.parse_source(m.SOURCES[0], tree)
        added = dict(tree['tree'][0], path=tree['tree'][0]['path'].replace('.epub', '.pdf'))
        tree['tree'] = [tree['tree'][0], added]
        after = m.parse_source(m.SOURCES[0], tree)
        self.assertNotEqual(before, after)
        self.assertEqual(len(after['issues']), 1)
        self.assertEqual(set(after['issues'][0]['files']), {'pdf', 'epub'})

    def test_truncated_tree_falls_back_to_complete_walk(self):
        replies = [
            {'truncated': True, 'sha': 'root', 'tree': []},
            {'tree': [{'path': '01_economist', 'type': 'tree', 'sha': 'sub'}, {'path': '05_wired', 'type': 'tree', 'sha': 'skip'}]},
            {'tree': [{'path': 'te_2026.10.03', 'type': 'tree', 'sha': 'issue'}]},
            {'tree': [{'path': 'TheEconomist.2026.10.03.epub', 'type': 'blob', 'sha': 'file'}]},
        ]
        with patch.object(m, 'api', side_effect=replies) as api:
            tree = m.fetch_tree(m.SOURCES[0])
        self.assertEqual(api.call_count, 4)
        self.assertEqual(m.parse_source(m.SOURCES[0], tree)['issues'][0]['date'], '2026-10-03')


if __name__ == '__main__':
    unittest.main()
