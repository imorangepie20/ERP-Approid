"""Local regression checks; no SSH, HTTP, database or production credentials."""
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

import verify


class DeploymentVerifierTest(unittest.TestCase):
    def test_requests_use_identifiable_user_agent_and_keep_auth_header(self):
        with patch('verify.urllib.request.urlopen') as open_url:
            response = open_url.return_value
            response.status = 200
            response.headers = {'Content-Type': 'application/json'}
            response.read.return_value = b'{}'
            status, _, _ = verify.request('/api/core/auth/me', headers={'Authorization': 'Bearer test-only'})
            request = open_url.call_args.args[0]
            self.assertEqual(request.get_header('User-agent'), verify.USER_AGENT)
            self.assertEqual(request.get_header('Authorization'), 'Bearer test-only')
            self.assertEqual(status, 200)
            self.assertEqual(open_url.call_args.kwargs['timeout'], 30)

    def test_expected_http_failure_is_returned_without_hiding_status(self):
        error = HTTPError(verify.URL + '/api/core/items', 401, 'Unauthorized', {},
                          io.BytesIO(json.dumps({'code': 'UNAUTHORIZED'}).encode()))
        with patch('verify.urllib.request.urlopen', side_effect=error):
            status, _, body = verify.request('/api/core/items')
        self.assertEqual(status, 401)
        self.assertEqual(json.loads(body)['code'], 'UNAUTHORIZED')

    def test_report_defaults_to_current_release_not_first_release(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'deploy').mkdir()
            (root / 'deploy/release.env').write_text('# no secrets\nBACKEND_IMAGE=erp-backend:demo-new\n')
            with patch('verify.ROOT', root):
                self.assertEqual(verify.report_path(), root / 'artifacts/demo-new/verification.json')
                self.assertEqual(verify.report_path('demo-explicit'),
                                 root / 'artifacts/demo-explicit/verification.json')

    def test_release_identifier_cannot_escape_artifact_directory(self):
        for release in ('../secrets', '..', '/tmp', 'C:\\secrets', '', 'a' * 81):
            with self.subTest(release=release), self.assertRaises(ValueError):
                verify.report_path(release)

    def test_same_origin_preflight_does_not_require_cross_origin_header(self):
        verify.same_origin_preflight(200, {})
        verify.same_origin_preflight(200, {'Access-Control-Allow-Origin': verify.URL})
        for status, headers in ((403, {}), (200, {'Access-Control-Allow-Origin': '*'}),
                                (200, {'Access-Control-Allow-Origin': 'https://untrusted.example'})):
            with self.subTest(status=status, headers=headers), self.assertRaises(AssertionError):
                verify.same_origin_preflight(status, headers)

    def test_operations_uses_release_baseline_and_detects_container_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            release = root / 'artifacts/demo-new'
            release.mkdir(parents=True)
            (release / 'existing-containers.txt').write_text('existing-app before-id\n')
            (root / 'deploy').mkdir()
            (root / 'deploy/README.md').write_text('runbook')
            with patch('verify.ROOT', root), patch('verify.recovery'), \
                    patch('verify.subprocess.check_output', return_value='existing-app before-id\nERP new-id\n'):
                self.assertIn('1 prior containers unchanged', verify.operations(release))
            with patch('verify.ROOT', root), patch('verify.recovery'), \
                    patch('verify.subprocess.check_output', return_value='existing-app replaced-id\n'):
                with self.assertRaises(AssertionError):
                    verify.operations(release)


if __name__ == '__main__':
    unittest.main()
