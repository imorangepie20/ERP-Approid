# ============================================
# HUD Admin Template - Zorin OS 배포 스크립트
# Windows PowerShell에서 실행
# 사용법: powershell -ExecutionPolicy Bypass -File deploy-to-zorin.ps1
# ============================================

# ── 설정 (사용 환경에 맞게 수정) ─────────────
$SERVER_IP   = "YOUR_SERVER_IP"        # Zorin OS 서버 IP (예: 192.168.1.100)
$SERVER_USER = "YOUR_USERNAME"         # SSH 사용자명
$REMOTE_DIR  = "/home/$SERVER_USER/hud-admin-template"  # 서버 프로젝트 경로
$SSH_KEY     = ""                      # SSH 키 경로 (비워두면 비밀번호 방식)
# ─────────────────────────────────────────────

# 색상 출력 함수
function Write-Step {
    param([string]$emoji, [string]$message)
    Write-Host ""
    Write-Host "  $emoji $message" -ForegroundColor Cyan
    Write-Host "  $('-' * 50)" -ForegroundColor DarkGray
}

function Write-Success {
    param([string]$message)
    Write-Host "  ✅ $message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$message)
    Write-Host "  ❌ $message" -ForegroundColor Red
}

# SSH/SCP 옵션 구성
$SSH_OPTS = @("-o", "StrictHostKeyChecking=no")
if ($SSH_KEY -ne "") {
    $SSH_OPTS += @("-i", $SSH_KEY)
}
$SSH_TARGET = "${SERVER_USER}@${SERVER_IP}"

# ── 설정 값 검증 ─────────────────────────────
if ($SERVER_IP -eq "YOUR_SERVER_IP" -or $SERVER_USER -eq "YOUR_USERNAME") {
    Write-Fail "deploy-to-zorin.ps1 상단의 설정 값을 먼저 수정해주세요!"
    Write-Host ""
    Write-Host '  $SERVER_IP   = "YOUR_SERVER_IP"   → 서버 IP 주소' -ForegroundColor Yellow
    Write-Host '  $SERVER_USER = "YOUR_USERNAME"     → SSH 사용자명' -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║   🚀 HUD Admin → Zorin OS 배포 시작         ║" -ForegroundColor Magenta
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host "  서버: $SSH_TARGET" -ForegroundColor DarkGray
Write-Host "  경로: $REMOTE_DIR" -ForegroundColor DarkGray

# ── Step 1: 프로덕션 빌드 ────────────────────
Write-Step "🔨" "Step 1/4 — 프로덕션 빌드"

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Fail "빌드 실패! 에러를 확인하세요."
    exit 1
}
Write-Success "빌드 완료 (dist/ 생성)"

# ── Step 2: dist 폴더 존재 확인 ──────────────
Write-Step "📁" "Step 2/4 — dist 폴더 확인"

if (-not (Test-Path "dist")) {
    Write-Fail "dist/ 폴더를 찾을 수 없습니다."
    exit 1
}

$fileCount = (Get-ChildItem -Recurse "dist" -File).Count
Write-Success "dist/ 폴더 확인 ($fileCount 파일)"

# ── Step 3: 서버에 dist 전송 ─────────────────
Write-Step "📤" "Step 3/4 — 서버에 파일 전송 (SCP)"

# 원격 디렉토리 생성
ssh @SSH_OPTS $SSH_TARGET "mkdir -p $REMOTE_DIR/dist"
if ($LASTEXITCODE -ne 0) {
    Write-Fail "SSH 접속 실패! 서버 설정을 확인하세요."
    exit 1
}

# 기존 dist 내용 제거 후 새 파일 전송
ssh @SSH_OPTS $SSH_TARGET "rm -rf $REMOTE_DIR/dist/*"
scp @SSH_OPTS -r dist/* "${SSH_TARGET}:${REMOTE_DIR}/dist/"
if ($LASTEXITCODE -ne 0) {
    Write-Fail "파일 전송 실패!"
    exit 1
}
Write-Success "파일 전송 완료"

# ── Step 4: Docker Compose 재시작 ────────────
Write-Step "🐳" "Step 4/4 — Docker Compose app 서비스 재시작"

ssh @SSH_OPTS $SSH_TARGET "cd $REMOTE_DIR/infra && docker compose --env-file secrets/compose.env -f compose.zorin.yml restart app"
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Docker Compose 재시작 실패!"
    exit 1
}
Write-Success "app 컨테이너 재시작 완료"

# ── 완료 ─────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║   ✅ 배포 완료!                              ║" -ForegroundColor Green
Write-Host "  ╠══════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "  ║   🌐 내부: http://${SERVER_IP}:9080          ║" -ForegroundColor Green
Write-Host "  ║   🌍 외부: https://hud.approid.team          ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
