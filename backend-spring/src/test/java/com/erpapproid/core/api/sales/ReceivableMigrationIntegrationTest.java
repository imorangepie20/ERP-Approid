package com.erpapproid.core.api.sales;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import java.util.Properties;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import com.erpapproid.core.support.IntegrationTestSupport;

class ReceivableMigrationIntegrationTest extends IntegrationTestSupport {
    @Test void upgrades_v15_without_fabricating_historical_collections_and_validates_constraints() {
        String schema = "collection_migration_" + UUID.randomUUID().toString().replace("-", "");
        var root = new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        var jdbc = new JdbcTemplate(root);
        try {
            Flyway.configure().dataSource(root).schemas(schema).defaultSchema(schema).target("15").load().migrate();
            var connection = new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
            var properties = new Properties(); properties.setProperty("currentSchema", schema); connection.setConnectionProperties(properties);
            var legacy = new JdbcTemplate(connection);
            long paid = legacy.queryForObject("insert into receivables(receivable_no,customer_id,amount,due_date,status) values('MIG-PAID',1,1000,'2025-01-02','수납완료') returning id", Long.class);
            long open = legacy.queryForObject("insert into receivables(receivable_no,customer_id,amount,due_date,status) values('MIG-OPEN',1,2000,'2025-01-03','미수') returning id", Long.class);
            var migrate = Flyway.configure().dataSource(root).schemas(schema).defaultSchema(schema).target("18").load();
            assertThat(migrate.migrate().migrationsExecuted).isEqualTo(3); migrate.validate();
            assertThat(legacy.queryForObject("select opening_collected_amount from receivables where id=?", Long.class, paid)).isEqualTo(1000);
            assertThat(legacy.queryForObject("select collected_amount from receivables where id=?", Long.class, paid)).isEqualTo(1000);
            assertThat(legacy.queryForObject("select collected_amount from receivables where id=?", Long.class, open)).isZero();
            assertThat(legacy.queryForObject("select due_date::text from receivables where id=?", String.class, paid)).isEqualTo("2025-01-02");
            assertThat(legacy.queryForObject("select amount from receivables where id=?", Long.class, open)).isEqualTo(2000);
            assertThat(legacy.queryForObject("select count(*) from receivable_collections", Long.class)).isZero();
            assertThatThrownBy(() -> legacy.update("update receivables set collected_amount=2001 where id=?", open)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThatThrownBy(() -> legacy.update("update receivables set status='수납완료' where id=?", open)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThat(migrate.migrate().migrationsExecuted).isZero();
        } finally {
            if (!schema.matches("collection_migration_[a-f0-9]{32}")) throw new IllegalStateException("Unsafe test schema");
            jdbc.execute("drop schema if exists " + schema + " cascade");
        }
    }
}
