package com.erpapproid.core.domain.analytics;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import static com.erpapproid.core.domain.analytics.MrpCalculator.*;

class MrpCalculatorTest {
    private final MrpCalculator calculator = new MrpCalculator();
    private final LocalDate today = LocalDate.of(2026, 10, 4);
    private BigDecimal d(String s) { return new BigDecimal(s); }
    private Item item(long id, String type, String stock, String held, String safety, int lead) {
        return new Item(id, "ITEM-" + id, "품목 " + id, type, type.equals("자재") ? "kg" : "EA", 100, d(stock), d(held), d(safety), lead);
    }
    private Row row(List<Row> rows, long id) { return rows.stream().filter(r -> r.itemId() == id).findFirst().orElseThrow(); }

    @Test
    void nets_shared_multilevel_components_once_after_stock_open_orders_and_scheduled_production() {
        var items = List.of(item(1, "제품", "0", "0", "0", 1), item(2, "반제품", "5", "0", "2", 2), item(3, "자재", "10", "2", "2", 4));
        var edges = List.of(new Edge(1, 2, d("2"), d("10")), new Edge(1, 3, d("1"), d("0")), new Edge(2, 3, d("3"), d("5")));
        var works = List.of(new Work(1, d("10"), d("0"), today.plusDays(10), today.plusDays(15)),
                new Work(2, d("4"), d("1"), today.plusDays(3), today.plusDays(5)));
        var supply = List.of(new Supply(2, d("3"), today.plusDays(20)), new Supply(3, d("6"), today.plusDays(20)));
        var rows = calculator.calculate(items, edges, works, supply, today, today.plusDays(90));
        assertThat(row(rows, 2).grossRequirement()).isEqualByComparingTo("22");
        assertThat(row(rows, 2).scheduledProduction()).isEqualByComparingTo("3");
        assertThat(row(rows, 2).suggestedProductionQty()).isEqualByComparingTo("13");
        var material = row(rows, 3);
        assertThat(material.grossRequirement()).isEqualByComparingTo("63.55");
        assertThat(material.usableStock()).isEqualByComparingTo("8");
        assertThat(material.suggestedPurchaseQty()).isEqualByComparingTo("51.55");
        assertThat(material.lateSupplyQty()).isEqualByComparingTo("6");
        assertThat(material.requiredBy()).isEqualTo(today.plusDays(3));
        assertThat(material.orderBy()).isEqualTo(today.minusDays(1));
        assertThat(material.unit()).isEqualTo("kg"); assertThat(row(rows, 2).unit()).isEqualTo("EA");
        assertThat(material.urgent()).isTrue();
        var afterPo = calculator.calculate(items, edges, works, List.of(supply.get(0), supply.get(1), new Supply(3, d("51.55"), today.plusDays(20))), today, today.plusDays(90));
        assertThat(row(afterPo, 3).suggestedPurchaseQty()).isZero(); assertThat(row(afterPo, 3).action()).isEqualTo("EXPEDITE");
    }

    @Test
    void rounds_each_bom_expansion_up_to_four_places_and_treats_loss_as_additional_allowance() {
        var rows = calculator.calculate(List.of(item(1, "제품", "0", "0", "0", 0), item(2, "자재", "0", "0", "0", 0)),
                List.of(new Edge(1, 2, d("0.0001"), d("100"))), List.of(new Work(1, d("0.0001"), d("0"), today, today)), List.of(), today, today);
        assertThat(row(rows, 2).suggestedPurchaseQty()).isEqualByComparingTo("0.0001");
    }

    @Test
    void retains_missing_bom_as_an_explicit_blocked_row_and_respects_master_safety_stock() {
        var rows = calculator.calculate(List.of(item(1, "제품", "0", "0", "0", 0), item(2, "자재", "3", "0", "5", 2)), List.of(),
                List.of(new Work(1, d("10"), d("0"), today, today)), List.of(), today, today.plusDays(90));
        assertThat(row(rows, 1).action()).isEqualTo("MISSING_BOM");
        assertThat(row(rows, 2).suggestedPurchaseQty()).isEqualByComparingTo("2");
        assertThat(row(rows, 2).requiredBy()).isEqualTo(today.plusDays(90));
    }

    @Test
    void rejects_cycles_invalid_bom_and_quantity_overflow_without_partial_suggestions() {
        var items = List.of(item(1, "제품", "0", "0", "0", 0), item(2, "반제품", "0", "0", "0", 0));
        assertThatThrownBy(() -> calculator.calculate(items, List.of(new Edge(1, 2, d("1"), d("0")), new Edge(2, 1, d("1"), d("0"))), List.of(), List.of(), today, today))
                .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.BOM_CYCLE));
        assertThatThrownBy(() -> calculator.calculate(items, List.of(new Edge(1, 2, d("1"), d("101"))), List.of(), List.of(), today, today)).isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> calculator.calculate(items, List.of(new Edge(1, 2, d("100000000000000"), d("0"))),
                List.of(new Work(1, d("10"), d("0"), today, today)), List.of(), today, today)).isInstanceOf(DomainException.class);
    }
}
