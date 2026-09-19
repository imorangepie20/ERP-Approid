#!/bin/sh
set -eu

[ -t 0 ] || {
  printf '오류: 터미널에서 대화형으로 실행해야 합니다\n' >&2
  exit 1
}

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
secrets_dir="$repo_root/infra/secrets"
target="$secrets_dir/tunnel.env"

fill_initialized_file=false
if [ -e "$target" ]; then
  [ -f "$target" ] || {
    printf '오류: tunnel.env가 일반 파일이 아닙니다.\n' >&2
    exit 1
  }
  [ "$(cat "$target")" = "TUNNEL_TOKEN=" ] || {
    printf '오류: tunnel.env에 이미 값이 있습니다. 기존 토큰을 덮어쓰지 않습니다.\n' >&2
    exit 1
  }
  fill_initialized_file=true
fi

trap 'stty echo 2>/dev/null || true; unset input token' EXIT HUP INT TERM
printf 'Cloudflare Tunnel 토큰 또는 --token을 포함한 Docker 명령을 입력하세요: '
stty -echo
IFS= read -r input
stty echo
printf '\n'

case "$input" in
  *--token*) token=$(printf '%s\n' "$input" | sed -n 's/.*--token[[:space:]]\{1,\}\([^[:space:]]\{1,\}\).*/\1/p') ;;
  *) token=$input ;;
esac

[ "${#token}" -ge 100 ] || {
  printf '오류: 토큰 길이가 너무 짧습니다.\n' >&2
  exit 1
}
case "$token" in
  *[!A-Za-z0-9._=-]*)
    printf '오류: 토큰에 허용되지 않는 문자가 있습니다.\n' >&2
    exit 1
    ;;
esac

mkdir -p "$secrets_dir"
chmod 700 "$secrets_dir"
umask 077
if [ "$fill_initialized_file" = true ]; then
  printf 'TUNNEL_TOKEN=%s\n' "$token" > "$target"
else
  (set -C; printf 'TUNNEL_TOKEN=%s\n' "$token" > "$target") || {
    printf '오류: tunnel.env를 안전하게 생성하지 못했습니다.\n' >&2
    exit 1
  }
fi
chmod 600 "$target"
printf 'tunnel.env를 생성했습니다. 토큰 값은 출력하지 않았습니다.\n'
