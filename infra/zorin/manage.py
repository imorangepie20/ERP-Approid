"""Server-side deployment helpers. Never print credentials or authenticated responses."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import time

ROOT = Path('/home/approid/erp-approid')


def compose(*args, **kwargs):
    command = [
        'docker', 'compose', '--env-file', str(ROOT / 'secrets/production.env'),
        '--env-file', str(ROOT / 'deploy/release.env'), '-f', str(ROOT / 'deploy/compose.yml'),
    ]
    smtp_override = ROOT / 'deploy/smtp.override.yml'
    if smtp_override.is_file():
        command.extend(['-f', str(smtp_override)])
    return subprocess.run(command + list(args), cwd=ROOT, check=True, **kwargs)


def sql(statement, database='erp_demo'):
    return compose('exec', '-T', 'postgres', 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
                   '-U', 'erp', '-d', database, '-At', input=statement,
                   text=True, capture_output=True).stdout.strip()


def secure_file(path, value):
    # Exclusive creation prevents silently replacing secrets in a later deployment.
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8') as handle:
        handle.write(value)


def init():
    directory = ROOT / 'secrets'
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    env = directory / 'production.env'
    admin = directory / 'initial-admin.json'
    if env.exists() or admin.exists():
        raise RuntimeError('Initial secrets already exist; reuse them, never overwrite')
    secure_file(env, ''.join(f'{name}={secrets.token_hex(32)}\n'
                            for name in ('DB_PASSWORD', 'JWT_SECRET', 'INTERNAL_KEY')))
    secure_file(admin, json.dumps({'username': 'approid', 'password': secrets.token_urlsafe(24)}))
    print('Generated independent production secrets and administrator handoff (mode 600)')


def bootstrap_admin():
    # Only an untouched, freshly migrated demo can use this one-time bootstrap.
    if (ROOT / 'secrets/admin-bootstrapped').exists():
        raise RuntimeError('Administrator bootstrap already completed')
    identity = json.loads((ROOT / 'secrets/initial-admin.json').read_text())
    if sql("SELECT username FROM users ORDER BY id;") != 'admin':
        raise RuntimeError('Refusing to alter an existing/non-seed user database')
    if sql("SELECT count(*) FROM flyway_schema_history WHERE success;") != '19':
        raise RuntimeError('Expected complete V1-V19 migrations')
    # Generated token_urlsafe text contains no SQL metacharacters. Do not accept user-supplied SQL.
    password = identity['password']
    if not all(char.isalnum() or char in '-_' for char in password):
        raise RuntimeError('Invalid generated credential')
    sql("CREATE EXTENSION IF NOT EXISTS pgcrypto;\n"
        "BEGIN;\n"
        "UPDATE users SET username='approid', name='Approid Demo Admin', email=NULL, "
        f"password_hash=crypt('{password}', gen_salt('bf', 10)) WHERE username='admin';\n"
        "COMMIT;")
    secure_file(ROOT / 'secrets/admin-bootstrapped', 'Initial seed credential replaced before exposure\n')
    print('Replaced seed administrator credential; no business seed records altered')


def backup():
    directory = ROOT / 'backups'
    directory.mkdir(mode=0o700, exist_ok=True)
    target = directory / (time.strftime('erp_demo-%Y%m%d-%H%M%S') + '.dump')
    with target.open('xb') as handle:
        compose('exec', '-T', 'postgres', 'pg_dump', '-U', 'erp', '-d', 'erp_demo',
                '--format=custom', '--no-owner', '--no-privileges', stdout=handle)
    os.chmod(target, 0o600)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    secure_file(Path(str(target) + '.sha256'), f'{digest}  {target.name}\n')
    if target.stat().st_size == 0:
        raise RuntimeError('Empty backup')
    print(f'Backup {target.name}: {target.stat().st_size} bytes, SHA256 {digest}')
    return target


def recovery():
    target = backup()
    expected = Path(str(target) + '.sha256').read_text().split()[0]
    assert hashlib.sha256(target.read_bytes()).hexdigest() == expected
    name = 'erp_recovery_' + secrets.token_hex(4)
    original = sql("SELECT (SELECT count(*) FROM items)||','||(SELECT count(*) FROM lots)||','||"
                   "(SELECT count(*) FROM flyway_schema_history WHERE success);")
    sql(f'CREATE DATABASE {name};', 'postgres')
    try:
        with target.open('rb') as handle:
            compose('exec', '-T', 'postgres', 'pg_restore', '-U', 'erp', '-d', name,
                    '--single-transaction', '--no-owner', '--no-privileges', stdin=handle,
                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        restored = sql("SELECT (SELECT count(*) FROM items)||','||(SELECT count(*) FROM lots)||','||"
                       "(SELECT count(*) FROM flyway_schema_history WHERE success);", name)
        assert original == restored, (original, restored)
        assert sql("SELECT count(*) FROM users WHERE username='approid';", name) == '1'
        print(f'Recovery PASS: source/restored item,Lot,migration counts={restored}; admin=1')
    finally:
        # A generated temporary database only; never drop erp_demo or any existing database.
        sql(f'DROP DATABASE {name};', 'postgres')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['init', 'bootstrap-admin', 'backup', 'recovery'])
    command = parser.parse_args().command
    {'init': init, 'bootstrap-admin': bootstrap_admin, 'backup': backup, 'recovery': recovery}[command]()
