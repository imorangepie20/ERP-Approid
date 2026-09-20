package com.erpapproid.core.common.seq;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 도메인 번호 생성. db-schema.md 4:
 * 패턴 {PREFIX}-{yyMM}-{seq3}, IVT 는 {seq4}.
 * {yyMM} 은 KST 기준. 중복 방지는 DB 유니크 제약 + 재시도가 담당하므로
 * 여기서는 월별 시퀀스 값만 발급한다.
 *
 * 시드 정합: 이미 DB 에 존재하는 해당 월의 최대 번호에서 이어 발급한다.
 * (V7 시드 데이터와의 충돌 방지)
 */
@Component
public class DomainNumberGenerator {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final JdbcTemplate jdbc;
    private final Map<String, AtomicLong> counters = new ConcurrentHashMap<>();

    public DomainNumberGenerator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String next(Prefix prefix) {
        return next(prefix, 3);
    }

    public String next(Prefix prefix, int pad) {
        String month = currentMonth();
        String key = prefix.name() + ":" + month;
        long seq = counters.computeIfAbsent(key, k -> new AtomicLong(seedFromDb(prefix, month)))
                .incrementAndGet();
        String pattern = "%s-%s-%0" + pad + "d";
        return pattern.formatted(prefix.code(), month, seq);
    }

    private long seedFromDb(Prefix prefix, String month) {
        try {
            Long max = jdbc.query(
                    "SELECT coalesce(max(to_number(substring(" + prefix.column()
                            + " from '[0-9]+$'), '999999999')), 0) FROM " + prefix.table()
                            + " WHERE " + prefix.column() + " LIKE ?",
                    (rs, rowNum) -> rs.getLong(1),
                    prefix.code() + "-" + month + "-%")
                    .stream()
                    .findFirst()
                    .orElse(0L);
            return max == null ? 0L : max;
        } catch (Exception ex) {
            return 0L;
        }
    }

    private String currentMonth() {
        LocalDate now = LocalDate.now(KST);
        return "%02d%02d".formatted(now.getYear() % 100, now.getMonthValue());
    }

    public enum Prefix {
        QUOTATION("QT", "quotations", "quotation_no"),
        SALES_ORDER("SO", "sales_orders", "sales_order_no"),
        SHIPMENT("SH", "shipments", "shipment_no"),
        RECEIVABLE("RV", "receivables", "receivable_no"),
        PLAN("PL", "production_plans", "plan_no"),
        WORK_ORDER("WO", "work_orders", "work_order_no"),
        PURCHASE_ORDER("PO", "purchase_orders", "purchase_order_no"),
        RECEIVING("RC", "receivings", "receiving_no"),
        LOT("LOT", "lots", "lot_no"),
        INVENTORY_TXN("IVT", "inventory_transactions", "txn_no");

        private final String code;
        private final String table;
        private final String column;

        Prefix(String code, String table, String column) {
            this.code = code;
            this.table = table;
            this.column = column;
        }

        public String code() {
            return code;
        }

        String table() {
            return table;
        }

        String column() {
            return column;
        }
    }
}
