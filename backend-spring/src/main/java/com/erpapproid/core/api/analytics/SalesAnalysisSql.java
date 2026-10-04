package com.erpapproid.core.api.analytics;

final class SalesAnalysisSql {
    private SalesAnalysisSql() {}
    // Same recognition boundary for dashboard and sales analysis; historical links are never inferred.
    static final String VERIFIED_SHIPMENTS = """
        select s.* from shipments s where s.status in ('출하완료','매출반영')
        and s.confirmed_date is not null and s.inventory_txn_id is not null and s.receivable_id is not null
        """;
}
