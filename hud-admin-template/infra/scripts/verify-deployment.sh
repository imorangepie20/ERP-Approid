#!/bin/sh
set -eu

verify_url() {
  label=$1
  url=$2
  result=$(curl --location --fail --silent --show-error --max-time 10 --retry 2 \
    --output /dev/null --write-out '%{http_code}|%{url_effective}' "$url")
  status=${result%%|*}
  final_url=${result#*|}
  printf '%-14s status=%s final=%s\n' "$label" "$status" "$final_url"
}

verify_url "local app" "http://127.0.0.1:9080/"
verify_url "public app" "https://hud.approid.team/"
