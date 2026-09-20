-- 시드: 사용자 + 롤 (로그인 필수)
-- db-schema.md 5
-- 기본 비밀번호: admin123 (bcrypt 강도 10). 운영 배포 전 변경 필요.

INSERT INTO users (username, password_hash, name, email, employee_no, status)
VALUES ('admin',
        '$2b$10$ZQdDgoGpSbXrH1iM2OqYme5owz1CekxpgG7JWKIJPzYaebwZhshYa',
        '김대표',
        'admin@erpapproid.local',
        'EMP-001',
        '활성');

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'admin'
  AND r.code = 'ADMIN';
