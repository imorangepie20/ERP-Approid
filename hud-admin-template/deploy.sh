#!/usr/bin/env bash
# HUD Admin Template - Zorin OS 서버 초기 설정 & 서비스 관리
#
# 사용:
#   bash deploy.sh setup     # 첫 설치 (Docker Compose up)
#   bash deploy.sh up        # 서비스 시작 (tunnel 포함)
#   bash deploy.sh down      # 서비스 중지
#   bash deploy.sh restart   # app 재시작 (배포 후)
#   bash deploy.sh status    # 상태 확인
#   bash deploy.sh logs      # 로그 보기
set -euo pipefail
cd "$(dirname "$0")"

INFRA_DIR="./infra"
COMPOSE_FILE="$INFRA_DIR/compose.zorin.yml"
ENV_FILE="$INFRA_DIR/secrets/compose.env"
TUNNEL_ENV="$INFRA_DIR/secrets/tunnel.env"

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { printf "${CYAN}▶ %s${NC}\n" "$1"; }
ok()   { printf "${GREEN}✅ %s${NC}\n" "$1"; }
fail() { printf "${RED}❌ %s${NC}\n" "$1" >&2; exit 1; }

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

cmd_setup() {
  log "초기 설정 시작..."

  # compose.env 생성
  if [ ! -f "$ENV_FILE" ]; then
    log "compose.env 생성..."
    cp "$INFRA_DIR/secrets/compose.env.example" "$ENV_FILE"
    ok "compose.env 생성 완료"
  fi

  # tunnel.env 확인
  if [ ! -f "$TUNNEL_ENV" ]; then
    log "tunnel.env가 없습니다. 토큰을 설정하세요:"
    echo "  bash infra/scripts/set-tunnel-token.sh"
    echo ""
    echo "토큰 없이 app만 먼저 시작합니다..."
    compose up -d
    ok "app 시작 완료 (터널 미포함)"
    echo "터널 시작: bash deploy.sh up"
    return
  fi

  # 전체 시작 (tunnel 포함)
  compose --profile tunnel up -d
  ok "전체 서비스 시작 완료 (app + tunnel)"
}

cmd_up() {
  log "서비스 시작..."
  if [ -f "$TUNNEL_ENV" ] && grep -q 'TUNNEL_TOKEN=.\+' "$TUNNEL_ENV"; then
    compose --profile tunnel up -d
    ok "app + tunnel 시작 완료"
  else
    compose up -d
    ok "app 시작 완료 (터널 토큰 미설정)"
    echo "  터널 설정: bash infra/scripts/set-tunnel-token.sh"
  fi
}

cmd_down() {
  log "서비스 중지..."
  compose --profile tunnel down
  ok "서비스 중지 완료"
}

cmd_restart() {
  log "app 재시작..."
  compose restart app
  ok "app 재시작 완료"
}

cmd_status() {
  compose ps -a
  echo ""
  log "검증 스크립트 실행..."
  bash "$INFRA_DIR/scripts/verify-deployment.sh" || true
}

cmd_logs() {
  compose --profile tunnel logs -f --tail=50
}

# ── 메인 ─────────────────────────────────────
case "${1:-help}" in
  setup)  cmd_setup  ;;
  up)     cmd_up     ;;
  down)   cmd_down   ;;
  restart) cmd_restart ;;
  status) cmd_status ;;
  logs)   cmd_logs   ;;
  *)
    echo ""
    echo "  HUD Admin Template - 서버 관리 스크립트"
    echo ""
    echo "  사용: bash deploy.sh <command>"
    echo ""
    echo "  Commands:"
    echo "    setup     첫 설치 (Docker Compose up)"
    echo "    up        서비스 시작 (tunnel 포함)"
    echo "    down      서비스 중지"
    echo "    restart   app 재시작 (배포 후)"
    echo "    status    상태 확인"
    echo "    logs      로그 보기"
    echo ""
    ;;
esac
