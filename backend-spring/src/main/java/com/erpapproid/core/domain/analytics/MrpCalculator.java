package com.erpapproid.core.domain.analytics;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import io.swagger.v3.oas.annotations.media.Schema;

/** Quantity netting in each item's master unit; no statistical demand forecasts or stock writes. */
public final class MrpCalculator {
    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private static final BigDecimal MAX_QTY = new BigDecimal("100000000000000");
    public record Item(long id, String itemNo, String name, String type, String unit, long price,
                       BigDecimal onHand, BigDecimal unavailable, BigDecimal safety, int leadDays) {}
    public record Edge(long parentId, long childId, BigDecimal qty, BigDecimal lossRate) {}
    public record Work(long itemId, BigDecimal qty, BigDecimal defectQty, LocalDate start, LocalDate due) {}
    public record Supply(long itemId, BigDecimal remaining, LocalDate due) {}
    @Schema(name = "MrpRow")
    public record Row(long itemId, String itemNo, String itemName, String itemType, String unit, long price,
                      BigDecimal grossRequirement, BigDecimal onHand, BigDecimal usableStock, BigDecimal safetyStock,
                      BigDecimal onOrder, BigDecimal scheduledProduction, BigDecimal lateSupplyQty,
                      BigDecimal netRequirement, BigDecimal suggestedPurchaseQty, BigDecimal suggestedProductionQty,
                      int leadTimeDays, LocalDate requiredBy, LocalDate orderBy, boolean urgent, String action) {}

    public List<Row> calculate(List<Item> items, List<Edge> edges, List<Work> works, List<Supply> supplies,
                               LocalDate today, LocalDate through) {
        Map<Long, Item> masters = new HashMap<>();
        Map<Long, List<Edge>> children = new HashMap<>();
        Map<Long, Integer> incoming = new HashMap<>();
        for (Item i : items) { masters.put(i.id(), i); incoming.put(i.id(), 0); }
        for (Edge e : edges) {
            if (!masters.containsKey(e.parentId()) || !masters.containsKey(e.childId()) || e.qty().signum() <= 0
                    || e.lossRate().signum() < 0 || e.lossRate().compareTo(new BigDecimal("100")) > 0
                    || masters.get(e.parentId()).type().equals("자재")) {
                throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION, "MRP 계산에 사용할 수 없는 BOM입니다.");
            }
            children.computeIfAbsent(e.parentId(), key -> new ArrayList<>()).add(e);
            incoming.merge(e.childId(), 1, Integer::sum);
        }
        PriorityQueue<Long> ready = new PriorityQueue<>(Comparator.comparing(id -> masters.get(id).itemNo()));
        incoming.forEach((id, degree) -> { if (degree == 0) ready.add(id); });
        List<Long> order = new ArrayList<>();
        while (!ready.isEmpty()) {
            long id = ready.remove(); order.add(id);
            for (Edge e : children.getOrDefault(id, List.of())) if (incoming.merge(e.childId(), -1, Integer::sum) == 0) ready.add(e.childId());
        }
        if (order.size() != items.size()) throw new DomainException(ErrorCode.BOM_CYCLE, "순환 BOM이 있어 MRP를 계산할 수 없습니다.");
        Map<Long, BigDecimal> gross = new HashMap<>(), scheduled = new HashMap<>(), purchased = new HashMap<>();
        Map<Long, List<Work>> workByItem = new HashMap<>();
        Map<Long, List<Supply>> supplyByItem = new HashMap<>();
        Map<Long, LocalDate> dates = new HashMap<>();
        Set<Long> missing = new HashSet<>();
        for (Work w : works) {
            workByItem.computeIfAbsent(w.itemId(), key -> new ArrayList<>()).add(w);
            // Production actuals do not yet issue components: reserve the whole active order, not a guessed residual.
            scheduled.merge(w.itemId(), w.qty().subtract(w.defectQty()).max(ZERO), BigDecimal::add);
            List<Edge> bom = children.getOrDefault(w.itemId(), List.of());
            if (bom.isEmpty()) missing.add(w.itemId());
            explode(bom, w.qty(), w.start(), gross, dates);
        }
        for (Supply s : supplies) {
            purchased.merge(s.itemId(), s.remaining().max(ZERO), BigDecimal::add);
            supplyByItem.computeIfAbsent(s.itemId(), key -> new ArrayList<>()).add(s);
        }
        List<Row> rows = new ArrayList<>();
        for (long id : order) {
            Item i = masters.get(id);
            BigDecimal need = quantity(gross.getOrDefault(id, ZERO));
            BigDecimal production = quantity(scheduled.getOrDefault(id, ZERO));
            BigDecimal onOrder = quantity(purchased.getOrDefault(id, ZERO));
            BigDecimal usable = i.onHand().subtract(i.unavailable()).max(ZERO);
            BigDecimal net = quantity(need.add(i.safety()).subtract(usable).subtract(onOrder).subtract(production).max(ZERO));
            LocalDate by = dates.getOrDefault(id, through), orderBy = by.minusDays(i.leadDays());
            BigDecimal late = ZERO;
            for (Supply s : supplyByItem.getOrDefault(id, List.of())) if (s.due().isAfter(by)) late = late.add(s.remaining().max(ZERO));
            for (Work w : workByItem.getOrDefault(id, List.of())) if (w.due().isAfter(by)) late = late.add(w.qty().subtract(w.defectQty()).max(ZERO));
            boolean material = i.type().equals("자재"), hasBom = !children.getOrDefault(id, List.of()).isEmpty();
            String action = net.signum() > 0 ? material ? "PURCHASE" : hasBom ? "PRODUCE" : "MISSING_BOM"
                    : late.signum() > 0 && usable.add(onOrder).add(production).subtract(late).compareTo(need.add(i.safety())) < 0 ? "EXPEDITE" : "COVERED";
            if (missing.contains(id)) action = "MISSING_BOM";
            BigDecimal make = !material && hasBom ? net : ZERO;
            if (make.signum() > 0) explode(children.get(id), make, orderBy, gross, dates);
            if (need.signum() > 0 || net.signum() > 0 || production.signum() > 0) {
                rows.add(new Row(id, i.itemNo(), i.name(), i.type(), i.unit(), i.price(), need, i.onHand(), usable,
                        i.safety(), onOrder, production, quantity(late), net, material ? net : ZERO, make,
                        i.leadDays(), by, orderBy, orderBy.isBefore(today), action));
            }
        }
        rows.sort(Comparator.comparing(Row::requiredBy).thenComparing(Row::itemNo));
        return rows;
    }
    private void explode(List<Edge> edges, BigDecimal qty, LocalDate date, Map<Long, BigDecimal> gross, Map<Long, LocalDate> dates) {
        for (Edge e : edges) {
            BigDecimal amount = quantity(qty.multiply(e.qty()).multiply(BigDecimal.ONE.add(e.lossRate().movePointLeft(2))));
            gross.merge(e.childId(), amount, BigDecimal::add);
            dates.merge(e.childId(), date, (a, b) -> a.isBefore(b) ? a : b);
        }
    }
    private BigDecimal quantity(BigDecimal qty) {
        BigDecimal rounded = qty.setScale(4, RoundingMode.CEILING);
        if (rounded.compareTo(MAX_QTY) >= 0) throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION, "MRP 소요량이 수량 저장 범위를 초과했습니다.");
        return rounded;
    }
}
