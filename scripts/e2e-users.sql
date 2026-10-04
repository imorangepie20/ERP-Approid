-- Only execute against the isolated E2E database. Public test password: admin123.
DO $$ BEGIN
    IF current_database() <> 'erp_approid_e2e' THEN
        RAISE EXCEPTION 'E2E users may only be installed in erp_approid_e2e';
    END IF;
END $$;
INSERT INTO users (username, password_hash, name, status)
SELECT fixture.username, admin.password_hash, fixture.username, '활성'
FROM users admin CROSS JOIN (VALUES ('e2e-material'), ('e2e-sales'), ('e2e-production')) fixture(username)
WHERE admin.username = 'admin'
ON CONFLICT (username) DO NOTHING;
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = CASE u.username
    WHEN 'e2e-material' THEN 'MATERIAL' WHEN 'e2e-sales' THEN 'SALES' WHEN 'e2e-production' THEN 'PRODUCTION' END
WHERE u.username IN ('e2e-material', 'e2e-sales', 'e2e-production')
ON CONFLICT DO NOTHING;
