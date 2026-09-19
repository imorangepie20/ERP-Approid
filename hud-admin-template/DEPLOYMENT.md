# HUD Admin Template — 배포 가이드

## Zorin OS + Docker Compose + Cloudflare Tunnel

**Windows에서 빌드 → SCP 전송 → Docker (Nginx + Cloudflare Tunnel)**

```
[Windows PC]                     [Zorin OS 서버]                    [Cloudflare]
npm run build                    Docker Compose                     hud.approid.team
    ↓ SCP                           ├─ app (Nginx :9080)                ↑
  dist/ ─────────────────────→ dist/ │                                   │
                                    └─ tunnel (cloudflared) ────────────┘
```

> real-es 프로젝트 (`resm.approid.team`)와 동일한 배포 패턴입니다.

---

## 프로젝트 구조

```
infra/
├── compose.zorin.yml          # Docker Compose (app + tunnel)
├── nginx/
│   └── default.conf           # Nginx 설정 (SPA, Gzip, 캐싱)
├── scripts/
│   ├── set-tunnel-token.sh    # Cloudflare 터널 토큰 설정
│   └── verify-deployment.sh   # 배포 검증 (로컬 + 퍼블릭)
└── secrets/
    ├── compose.env.example    # COMPOSE_PROJECT_NAME
    └── tunnel.env.example     # TUNNEL_TOKEN

deploy.sh                      # 서버 관리 스크립트 (setup/up/down/restart/status/logs)
deploy-to-zorin.ps1            # Windows 원클릭 배포 스크립트
```

---

## 1. Zorin OS 서버 사전 준비

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Docker 설치 (공식 문서: https://docs.docker.com/engine/install/ubuntu/)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# SSH 서버 (Windows에서 SCP 접속용)
sudo apt install -y openssh-server
sudo systemctl enable ssh

# 재로그인 (docker 그룹 적용)
newgrp docker

# 서버 IP 확인
ip addr show | grep "inet " | grep -v 127.0.0.1
```

---

## 2. 프로젝트 클론 & 초기 설정

```bash
# 프로젝트 클론
cd ~
git clone https://github.com/imorangepie20/hud-admin-template.git
cd hud-admin-template

# secrets 초기화
cp infra/secrets/compose.env.example infra/secrets/compose.env
```

---

## 3. Cloudflare Tunnel 설정

### 3.1 Cloudflare 대시보드에서 터널 생성

1. [Cloudflare Zero Trust 대시보드](https://one.dash.cloudflare.com/) 접속
2. **Networks → Tunnels → Create a tunnel**
3. **Cloudflared** 선택
4. 터널 이름: `hud-admin`
5. **Public Hostname** 설정:
   - Subdomain: `hud`
   - Domain: `approid.team`
   - Service: `http://app:80`  *(Docker 네트워크 내부에서 Nginx 컨테이너에 접근)*
6. 터널 생성 후 표시되는 **토큰을 복사**

### 3.2 터널 토큰 저장

```bash
# 대화형 토큰 입력 (토큰이 화면에 표시되지 않음)
bash infra/scripts/set-tunnel-token.sh
```

---

## 4. 첫 배포

### 4.1 Windows에서 빌드 & 전송

```powershell
# Windows PowerShell에서
cd C:\Wspace\hud-admin-template
npm run build
scp -r dist/* YOUR_USERNAME@YOUR_SERVER_IP:~/hud-admin-template/dist/
```

### 4.2 서버에서 서비스 시작

```bash
# Zorin OS에서
cd ~/hud-admin-template
bash deploy.sh setup
```

### 4.3 접속 확인

```bash
# 검증 스크립트
bash infra/scripts/verify-deployment.sh
```

| 엔드포인트 | URL |
|-----------|-----|
| 내부 (로컬) | `http://127.0.0.1:9080` |
| 외부 (퍼블릭) | `https://hud.approid.team` |

---

## 5. 이후 배포 (업데이트)

### 방법 A: 원클릭 스크립트 (권장)

```powershell
# deploy-to-zorin.ps1 상단의 $SERVER_IP, $SERVER_USER 수정 후
powershell -ExecutionPolicy Bypass -File deploy-to-zorin.ps1
```

### 방법 B: 수동

```powershell
# Windows
npm run build
scp -r dist/* YOUR_USERNAME@YOUR_SERVER_IP:~/hud-admin-template/dist/

# Zorin OS
ssh YOUR_USERNAME@YOUR_SERVER_IP "cd ~/hud-admin-template && bash deploy.sh restart"
```

---

## 6. 서버 관리 명령어

```bash
bash deploy.sh <command>
```

| 커맨드 | 설명 |
|--------|------|
| `setup` | 첫 설치 (Docker Compose up) |
| `up` | 서비스 시작 (tunnel 포함) |
| `down` | 서비스 중지 |
| `restart` | app 컨테이너 재시작 (배포 후) |
| `status` | 상태 확인 + 검증 |
| `logs` | 로그 실시간 보기 |

---

## 7. 트러블슈팅

### 컨테이너 상태 확인
```bash
docker compose --env-file infra/secrets/compose.env -f infra/compose.zorin.yml ps -a
```

### 502 Bad Gateway (Cloudflare)
```bash
# app 컨테이너 헬스체크 확인
docker inspect --format='{{.State.Health.Status}}' hud-admin-app-1

# app 로그 확인
bash deploy.sh logs
```

### 터널 연결 안 됨
```bash
# 터널 토큰 확인
cat infra/secrets/tunnel.env

# 토큰 재설정
rm infra/secrets/tunnel.env
bash infra/scripts/set-tunnel-token.sh
bash deploy.sh down && bash deploy.sh up
```

### dist 파일 권한 문제
```bash
# Docker 볼륨 마운트이므로 호스트 권한만 확인
ls -la dist/
chmod -R 755 dist/
bash deploy.sh restart
```

---

## 8. 보안 참고사항

- **포트 노출 최소화**: `compose.zorin.yml`에서 9080은 `127.0.0.1:9080:80`으로 바인딩되어 외부에서 직접 접근 불가
- **터널 토큰 보호**: `infra/secrets/tunnel.env`는 `.gitignore`에 포함되어 Git에 커밋되지 않음
- **Cloudflare Tunnel**: 서버의 어떤 포트도 인터넷에 직접 노출하지 않고 Cloudflare 네트워크를 통해서만 접근

---

## (레거시) Ubuntu Server 직접 배포

이전 배포 방식 (Nginx 직접 설치 + 포트 3000)은 아래 참고:

<details>
<summary>레거시 배포 가이드 (클릭하여 펼치기)</summary>

### 사전 요구사항

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git
```

### Nginx 포트 3000 설정

```nginx
server {
    listen 3000;
    server_name _;
    root /var/www/alpha-team/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    error_page 404 /index.html;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/alpha-team /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo ufw allow 3000/tcp
```

접속: `http://서버IP:3000`

</details>
