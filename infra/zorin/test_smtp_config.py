"""Closest tests for opt-in SMTP deployment configuration; no network or credentials."""
import unittest
from unittest.mock import patch

import manage


class SmtpComposeTest(unittest.TestCase):
    @patch('manage.subprocess.run')
    def test_original_command_without_override(self, run):
        with patch('manage.Path.is_file', return_value=False):
            manage.compose('ps', capture_output=True)
        command = run.call_args.args[0]
        self.assertEqual(command.count('-f'), 1)
        self.assertEqual(command[-1], 'ps')
        self.assertTrue(run.call_args.kwargs['check'])

    @patch('manage.subprocess.run')
    def test_existing_override_is_preserved_for_management_operations(self, run):
        with patch('manage.Path.is_file', return_value=True):
            manage.compose('exec', '-T', 'postgres', 'pg_isready')
        command = run.call_args.args[0]
        self.assertEqual(command.count('-f'), 2)
        self.assertIn(str(manage.ROOT / 'deploy/smtp.override.yml'), command)
        self.assertEqual(command[-4:], ['exec', '-T', 'postgres', 'pg_isready'])


if __name__ == '__main__':
    unittest.main()
