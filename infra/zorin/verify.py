"""Run the seven deployment acceptance checks without logging secrets/tokens."""
import argparse
import json
import re
import stat
import subprocess
import urllib.error
import urllib.request
from pathlib import Path
from manage import ROOT, compose, sql, recovery

URL = 'https://erp.approid.team'
USER_AGENT = 'ERP-Approid-Deployment-Verify/1.0'
results = []


def request(path, data=None, headers=None, method=None):
    req = urllib.request.Request(URL + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Content-Type': 'application/json', 'User-Agent': USER_AGENT,
                                          **(headers or {})}, method=method)
    try:
        response = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.headers, response.read()


def inspect(service):
    identity = compose('ps', '-q', service, capture_output=True, text=True).stdout.strip()
    assert identity, service
    return json.loads(subprocess.check_output(['docker', 'inspect', identity]))[0]


def check(name, function):
    try:
        evidence = function()
        results.append({'check': name, 'status': 'PASS', 'evidence': evidence})
    except Exception as error:
        # Do not include raw HTTP bodies, subprocess stderr or credentials in errors.
        results.append({'check': name, 'status': 'FAIL', 'evidence': type(error).__name__})
    print(json.dumps(results[-1], ensure_ascii=False), flush=True)


def host():
    assert 'Zorin OS 18.1' in Path('/etc/os-release').read_text()
    subprocess.run(['docker', 'compose', 'version'], check=True, stdout=subprocess.DEVNULL)
    return 'SSH execution on Zorin OS 18.1; Docker Compose available'


def security():
    compose('config', '--quiet')
    backend = inspect('backend-spring')
    env = dict(pair.split('=', 1) for pair in backend['Config']['Env'])
    assert env['SPRING_PROFILES_ACTIVE'] == 'prod'
    assert env['CORS_ALLOWED_ORIGINS'] == URL
    assert len({env['JWT_SECRET'], env['INTERNAL_KEY'], env['DB_PASSWORD']}) == 3
    assert all(len(env[key]) >= 64 for key in ('JWT_SECRET', 'INTERNAL_KEY', 'DB_PASSWORD'))
    assert backend['Config']['User'] == 'app'
    for service in ('postgres', 'backend-spring', 'tunnel'):
        assert not inspect(service)['HostConfig']['PortBindings']
    bindings = inspect('frontend')['HostConfig']['PortBindings']['80/tcp']
    assert bindings == [{'HostIp': '127.0.0.1', 'HostPort': '9082'}]
    for name in ('production.env', 'initial-admin.json', 'tunnel.json'):
        assert stat.S_IMODE((ROOT / 'secrets' / name).stat().st_mode) == 0o600
    assert sql("SELECT count(*) FROM users WHERE username='admin' OR "
               "password_hash=crypt('admin123',password_hash);") == '0'
    return 'prod; three distinct 64-char secrets; mode 600; no seed password; only loopback 9082 published'


def deployment():
    for service in ('postgres', 'backend-spring', 'frontend'):
        assert inspect(service)['State']['Health']['Status'] == 'healthy', service
    assert sql('SELECT count(*) FROM flyway_schema_history WHERE success;') == '15'
    assert sql('SELECT count(*) FROM flyway_schema_history WHERE NOT success;') == '0'
    counts = sql("SELECT (SELECT count(*) FROM items)||','||(SELECT count(*) FROM lots);")
    assert all(int(value) > 0 for value in counts.split(','))
    assert sql("SELECT count(*) FROM users WHERE username='approid';") == '1'
    return f'3 healthy application services; Flyway V1-V15 success; item,Lot counts={counts}; administrator count=1'


def tunnel():
    assert inspect('tunnel')['State']['Running']
    compose('exec', '-T', 'backend-spring', 'curl', '-fsS', 'http://tunnel:2000/ready',
            stdout=subprocess.DEVNULL)
    status, headers, _ = request('/')
    assert status == 200 and headers.get('CF-Ray')
    return f'Tunnel readiness 200; DNS resolves; Cloudflare CF-Ray={headers["CF-Ray"]}'


def public():
    status, headers, html = request('/')
    assert status == 200
    assert headers.get('Strict-Transport-Security', '').startswith('max-age=31536000')
    assert "connect-src 'self'" in headers.get('Content-Security-Policy', '')
    match = re.search(rb'src="(/assets/[^" ]+\.js)"', html)
    assert match
    asset = match.group(1).decode()
    status, _, bundle = request(asset)
    assert status == 200
    assert b'https://erp.approid.team/api/core' in bundle
    assert b'http://127.0.0.1:38080' not in bundle
    status, _, body = request('/api/core/items')
    assert status == 401 and json.loads(body)['code'] == 'UNAUTHORIZED'
    return f'TLS-verified HTTPS/SPA and {asset} 200; same-origin API 401; CSP/HSTS present'


def authentication():
    identity = json.loads((ROOT / 'secrets/initial-admin.json').read_text())
    status, _, body = request('/api/core/auth/login', identity)
    assert status == 200
    response = json.loads(body)
    assert response['user']['username'] == 'approid' and 'ADMIN' in response['user']['roles']
    auth = {'Authorization': 'Bearer ' + response['accessToken']}
    for path in ('/api/core/auth/me', '/api/core/items?size=1',
                 '/api/core/boms', '/api/core/routings', '/api/core/lot-traces?size=1',
                 '/api/core/analytics/dashboard'):
        status, _, _ = request(path, headers=auth)
        assert status == 200, path
    status, _, _ = request('/api/core/auth/login', {'username': 'admin', 'password': 'admin123'})
    assert status == 401
    for path in ('/v3/api-docs', '/swagger-ui.html', '/actuator/health', '/api/core/internal/inventory'):
        status, _, _ = request(path, headers=auth)
        assert status == 404, path
    allowed = {'Origin': URL, 'Access-Control-Request-Method': 'GET'}
    status, headers, _ = request('/api/core/items', headers=allowed, method='OPTIONS')
    assert status == 200 and headers.get('Access-Control-Allow-Origin') == URL
    allowed['Origin'] = 'https://untrusted.example'
    status, headers, _ = request('/api/core/items', headers=allowed, method='OPTIONS')
    assert status == 403 and headers.get('Access-Control-Allow-Origin') is None
    # Last: deliberate failed logins may temporarily limit this tunnel origin.
    statuses = [request('/api/core/auth/login', {'username': 'nonexistent', 'password': 'invalid'})[0]
                for _ in range(14)]
    assert 429 in statuses
    return 'Admin login/me/items/BOM/routing/Lot 200; old login 401; private/docs 404; CORS 200/403; login limit 429'


def operations():
    recovery()
    baseline = (ROOT / 'artifacts/demo-20261004-0812/existing-containers.txt').read_text().splitlines()
    current = subprocess.check_output(['docker', 'ps', '--format', '{{.Names}} {{.ID}}'], text=True).splitlines()
    assert set(baseline).issubset(set(current)), 'Existing container identities changed'
    assert (ROOT / 'deploy/README.md').is_file()
    return f'Backup SHA256 and restore drill PASS; {len(baseline)} prior containers unchanged; runbook present'


def report_path(release=None):
    if release is None:
        values = dict(line.split('=', 1) for line in (ROOT / 'deploy/release.env').read_text().splitlines()
                      if line.strip() and not line.lstrip().startswith('#'))
        release = values['BACKEND_IMAGE'].rsplit(':', 1)[-1]
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,79}', release):
        raise ValueError('Invalid release identifier')
    return ROOT / 'artifacts' / release / 'verification.json'


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--release', help='Release artifact directory; defaults to the deployed backend tag')
    target = report_path(parser.parse_args().release)
    target.parent.mkdir(parents=True, exist_ok=True)
    for name, function in [('1-host', host), ('2-security', security), ('3-deployment', deployment),
                           ('4-tunnel-dns', tunnel), ('5-public-https-api', public),
                           ('6-auth-access', authentication), ('7-recovery-runbook', operations)]:
        check(name, function)
    target.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
    raise SystemExit(0 if all(result['status'] == 'PASS' for result in results) else 1)
