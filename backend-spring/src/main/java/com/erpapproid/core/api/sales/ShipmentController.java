package com.erpapproid.core.api.sales;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import com.erpapproid.core.api.sales.ShipmentDto.*;
import com.erpapproid.core.common.api.MasterListQuery;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.common.seq.DomainNumberGenerator;
import com.erpapproid.core.common.seq.DomainNumberGenerator.Prefix;
import com.erpapproid.core.domain.audit.*;
import com.erpapproid.core.domain.inventory.*;
import com.erpapproid.core.domain.item.*;
import com.erpapproid.core.domain.sales.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "shipments", description = "Lot 출하 및 매출/미수")
@RestController @RequestMapping("/api/core/shipments") @RequiredArgsConstructor
public class ShipmentController {
    private final ShipmentRepository shipments;
    private final SalesOrderRepository orders;
    private final ItemRepository items;
    private final LotRepository lots;
    private final InventoryTransactionRepository transactions;
    private final ReceivableRepository receivables;
    private final DomainNumberGenerator numbers;
    private final AuditService audits;
    private static final Set<String> STATUSES = Set.of("지시", "배차", "출발", "출하완료", "매출반영", "취소");

    @GetMapping @PreAuthorize("isAuthenticated()") @Transactional(readOnly = true)
    @Operation(summary = "출하 목록: 검색/상태/고객/수주/품목/페이지/정렬")
    public ResponseEntity<Page<Response>> list(@RequestParam(required = false) String status,
            @RequestParam(required = false) Long customerId, @RequestParam(required = false) Long salesOrderId,
            @RequestParam(required = false) Long itemId, @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "shipmentNo,desc") String sort) {
        MasterListQuery.positiveId(salesOrderId); MasterListQuery.positiveId(itemId);
        var pageable = MasterListQuery.pageable(page, size, sort, Set.of("shipmentNo", "salesOrder.salesOrderNo",
                "customer.name", "item.itemNo", "qty", "amount", "deliveryDate", "status"), "shipmentNo");
        var spec = SalesDocumentRules.<ShipmentEntity>filter("shipmentNo", status, customerId, keyword, STATUSES);
        if (salesOrderId != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("salesOrder").get("id"), salesOrderId));
        if (itemId != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("item").get("id"), itemId));
        return ResponseEntity.ok(shipments.findAll(spec, pageable).map(this::response));
    }

    @GetMapping("/{id}") @PreAuthorize("isAuthenticated()") @Transactional(readOnly = true)
    public ResponseEntity<Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(response(shipments.findById(id).orElseThrow(() -> missing(id))));
    }

    @PostMapping @PreAuthorize("hasAnyRole('ADMIN','SALES')") @Transactional
    @Operation(summary = "출하 지시: 한 Lot씩 명시적 선택, 수주 누적량 초과 차단, 재고 예약 없음")
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        var order = order(request.getSalesOrderId());
        openOrder(order); allocation(order, null, request.getQty());
        var item = item(order.getItem().getId()); var lot = lot(request.getLotId());
        available(item, lot, request.getQty());
        var shipment = shipments.save(ShipmentEntity.builder().shipmentNo(numbers.next(Prefix.SHIPMENT))
                .salesOrder(order).customer(order.getCustomer()).item(item).lot(lot).qty(request.getQty())
                .amount(SalesDocumentRules.amount(request.getQty(), order.getUnitPrice()))
                .deliveryDate(request.getDeliveryDate()).vehicle(request.getVehicle()).trackingNo(request.getTrackingNo())
                .status(Constants.DISPATCH).build());
        audits.record(AuditEvent.sensitiveCreated("SHIPMENT", shipment.getShipmentNo(), response(shipment)));
        return ResponseEntity.status(201).body(response(shipment));
    }

    @PatchMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','SALES')") @Transactional
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody UpdateRequest request) {
        if (!request.hasChanges()) throw MasterListQuery.invalid("수정할 값을 입력하세요.");
        var shipment = shipment(id); editable(shipment);
        var order = order(shipment.getSalesOrder().getId()); openOrder(order);
        BigDecimal qty = request.getQty() == null ? shipment.getQty() : request.getQty(); allocation(order, id, qty);
        var item = item(shipment.getItem().getId());
        Long lotId = request.getLotId() == null ? (shipment.getLot() == null ? null : shipment.getLot().getId()) : request.getLotId();
        if (lotId == null) throw MasterListQuery.invalid("실제 출하 Lot을 선택하세요.");
        var lot = lot(lotId); available(item, lot, qty);
        var before = response(shipment);
        shipment.setLot(lot); shipment.setQty(qty); shipment.setAmount(SalesDocumentRules.amount(qty, order.getUnitPrice()));
        if (request.getDeliveryDate() != null) shipment.setDeliveryDate(request.getDeliveryDate());
        if (request.getVehicle() != null) shipment.setVehicle(request.getVehicle());
        if (request.getTrackingNo() != null) shipment.setTrackingNo(request.getTrackingNo());
        audits.record(AuditEvent.sensitiveChange("UPDATE", "SHIPMENT", shipment.getShipmentNo(), before, response(shipment)));
        return ResponseEntity.ok(response(shipment));
    }

    @PostMapping("/{id}/dispatch") @PreAuthorize("hasAnyRole('ADMIN','SALES')") @Transactional
    public ResponseEntity<Response> dispatch(@PathVariable Long id) { return transition(id, "지시", "배차", "DISPATCH"); }

    @PostMapping("/{id}/depart") @PreAuthorize("hasAnyRole('ADMIN','SALES')") @Transactional
    public ResponseEntity<Response> depart(@PathVariable Long id) { return transition(id, "배차", "출발", "DEPART"); }

    private ResponseEntity<Response> transition(Long id, String from, String to, String action) {
        var shipment = shipment(id); state(from.equals(shipment.getStatus()), "허용되지 않는 출하 상태 전이입니다.");
        var order = order(shipment.getSalesOrder().getId()); openOrder(order);
        state(shipment.getLot() != null, "과거 출하: 실제 Lot을 선택한 후 진행하세요.");
        var before = response(shipment); shipment.setStatus(to);
        if ("출발".equals(to)) shipment.setDepartedDate(today());
        audits.record(AuditEvent.sensitiveChange(action, "SHIPMENT", shipment.getShipmentNo(), before, response(shipment)));
        return ResponseEntity.ok(response(shipment));
    }

    @PostMapping("/{id}/cancel") @PreAuthorize("hasAnyRole('ADMIN','SALES')") @Transactional
    @Operation(summary = "재고 이동 전 지시/배차 출하 취소, 확정 후 보상은 미지원")
    public ResponseEntity<Response> cancel(@PathVariable Long id) {
        var shipment = shipment(id); editable(shipment);
        order(shipment.getSalesOrder().getId());
        var before = response(shipment); shipment.setStatus(Constants.CANCELLED);
        audits.record(AuditEvent.sensitiveChange("CANCEL", "SHIPMENT", shipment.getShipmentNo(), before, response(shipment)));
        return ResponseEntity.ok(response(shipment));
    }

    @DeleteMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','SALES')") @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        shipment(id); throw new DomainException(ErrorCode.IN_USE, "출하 이력은 삭제할 수 없습니다. 취소를 사용하세요.");
    }

    @PostMapping("/{id}/confirm") @PreAuthorize("hasAnyRole('ADMIN','SALES')") @Transactional
    @Operation(summary = "Lot/현재고 차감·부분/완료 수주·미수 생성: 단일 트랜잭션")
    public ResponseEntity<ConfirmResult> confirm(@PathVariable Long id) {
        var shipment = shipment(id);
        state(Set.of("배차", "출발").contains(shipment.getStatus()), "배차/출발 상태만 확정할 수 있습니다.");
        state(shipment.getInventoryTransaction() == null && shipment.getReceivable() == null, "이미 반영된 출하입니다.");
        var order = order(shipment.getSalesOrder().getId()); openOrder(order);
        var confirmedQty = shipments.confirmedQty(order.getId()).add(shipment.getQty());
        if (confirmedQty.compareTo(order.getQty()) > 0) throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION, "수주량을 초과한 출하입니다.");
        if (shipment.getLot() == null) throw new DomainException(ErrorCode.IN_USE, "과거 출하는 실제 Lot 연결 확인 후 확정하세요.");
        // Lock order -> item -> Lot before initializing stock-bearing lazy associations.
        var item = item(shipment.getItem().getId()); var lot = lot(shipment.getLot().getId()); available(item, lot, shipment.getQty());
        var before = response(shipment); var orderBefore = orderSnapshot(order);
        var itemBefore = stockSnapshot(item); var lotBefore = lotSnapshot(lot);
        boolean full = confirmedQty.compareTo(order.getQty()) == 0;
        long amount = full ? order.getAmount() - shipments.confirmedAmount(order.getId())
                : SalesDocumentRules.amount(shipment.getQty(), order.getUnitPrice());
        if (amount < 0 || amount > 9007199254740991L) throw MasterListQuery.invalid("과거 매출 금액 정합성을 확인하세요.");
        shipment.setAmount(amount); shipment.setStatus(Constants.SHIPPED); shipment.setConfirmedDate(today());
        if (full) order.setStatus(Constants.SHIPPED);
        item.setStock(item.getStock().subtract(shipment.getQty())); lot.setQty(lot.getQty().subtract(shipment.getQty()));
        var txn = transactions.save(InventoryTransactionEntity.builder().txnNo(numbers.next(Prefix.INVENTORY_TXN, 4))
                .item(item).lot(lot).warehouse(lot.getWarehouse()).txnType(Constants.TXN_SHIP).qty(shipment.getQty().negate())
                .refType("SHIPMENT").refNo(shipment.getShipmentNo()).txnDate(today()).build());
        var receivable = receivables.save(ReceivableEntity.builder().receivableNo(numbers.next(Prefix.RECEIVABLE))
                .customer(order.getCustomer()).salesOrder(order).amount(amount).dueDate(today().plusDays(order.getPaymentTerms()))
                .overdueDays(0).status(Constants.OPEN).build());
        shipment.setInventoryTransaction(txn); shipment.setReceivable(receivable);
        audits.record(AuditEvent.sensitiveChange("CONFIRM", "SHIPMENT", shipment.getShipmentNo(), before, response(shipment)));
        audits.record(AuditEvent.changed("SHIP", "SALES_ORDER", order.getSalesOrderNo(), orderBefore, orderSnapshot(order)));
        audits.record(AuditEvent.changed("SHIP", "ITEM", item.getItemNo(), itemBefore, stockSnapshot(item)));
        audits.record(AuditEvent.changed("SHIP", "LOT", lot.getLotNo(), lotBefore, lotSnapshot(lot)));
        audits.record(AuditEvent.created("INVENTORY_TRANSACTION", txn.getTxnNo(), Map.of("txnNo", txn.getTxnNo(), "itemId", item.getId(), "lotId", lot.getId(), "qty", txn.getQty())));
        audits.record(AuditEvent.sensitiveCreated("RECEIVABLE", receivable.getReceivableNo(), Map.of("receivableNo", receivable.getReceivableNo(), "salesOrderId", order.getId(), "amount", amount, "dueDate", receivable.getDueDate(), "status", receivable.getStatus())));
        return ResponseEntity.ok(ConfirmResult.builder().shipment(response(shipment)).receivableNo(receivable.getReceivableNo()).inventoryTxnNo(txn.getTxnNo()).build());
    }

    private void allocation(SalesOrderEntity order, Long excludeId, BigDecimal qty) {
        if (shipments.allocatedQty(order.getId(), excludeId).add(qty).compareTo(order.getQty()) > 0)
            throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION, "취소되지 않은 출하의 누적 지시량이 수주량을 초과합니다.");
    }
    private void available(ItemEntity item, LotEntity lot, BigDecimal qty) {
        if (!lot.getItem().getId().equals(item.getId())) throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION, "품목과 Lot이 다릅니다.");
        if (!Set.of(Constants.LOT_OK, Constants.LOT_EXPIRING).contains(lot.getStatus()) || (lot.getExpiry() != null && lot.getExpiry().isBefore(today())))
            throw new DomainException(ErrorCode.IN_USE, "보류/폐기/만료 Lot은 출하할 수 없습니다.");
        if (item.getStock().compareTo(qty) < 0 || lot.getQty().compareTo(qty) < 0)
            throw new DomainException(ErrorCode.INSUFFICIENT_STOCK, "품목 현재고 또는 선택 Lot 잔량이 부족합니다.");
    }
    private void openOrder(SalesOrderEntity order) { state(Set.of(Constants.CONFIRMED, Constants.IN_PRODUCTION).contains(order.getStatus()), "확정/생산중 수주만 출하할 수 있습니다."); }
    private void editable(ShipmentEntity shipment) { state(Set.of("지시", "배차").contains(shipment.getStatus()), "지시/배차만 수정·취소할 수 있습니다."); }
    private void state(boolean valid, String message) { if (!valid) throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION, message); }
    private ShipmentEntity shipment(Long id) { return shipments.findForUpdate(id).orElseThrow(() -> missing(id)); }
    private DomainException missing(Long id) { return new DomainException(ErrorCode.SHIPMENT_NOT_FOUND, "출하를 찾을 수 없습니다: " + id); }
    private SalesOrderEntity order(Long id) { return orders.findForUpdate(id).orElseThrow(() -> new DomainException(ErrorCode.SALES_ORDER_NOT_FOUND, "수주를 찾을 수 없습니다.")); }
    private ItemEntity item(Long id) { return items.findForUpdate(id).orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND, "품목을 찾을 수 없습니다.")); }
    private LotEntity lot(Long id) { return lots.findForUpdate(id).orElseThrow(() -> new DomainException(ErrorCode.LOT_NOT_FOUND, "Lot을 찾을 수 없습니다.")); }
    private LocalDate today() { return LocalDate.now(ZoneId.of("Asia/Seoul")); }
    private Map<String, Object> stockSnapshot(ItemEntity i) { return Map.of("id", i.getId(), "stock", i.getStock()); }
    private Map<String, Object> lotSnapshot(LotEntity l) { return Map.of("id", l.getId(), "qty", l.getQty(), "status", l.getStatus()); }
    private Map<String, Object> orderSnapshot(SalesOrderEntity o) { return Map.of("id", o.getId(), "status", o.getStatus()); }
    private Response response(ShipmentEntity s) {
        return Response.builder().id(s.getId()).shipmentNo(s.getShipmentNo()).salesOrderId(s.getSalesOrder().getId())
                .salesOrderNo(s.getSalesOrder().getSalesOrderNo()).customerId(s.getCustomer().getId()).customerName(s.getCustomer().getName())
                .itemId(s.getItem().getId()).itemNo(s.getItem().getItemNo()).itemName(s.getItem().getName()).qty(s.getQty()).amount(s.getAmount())
                .deliveryDate(s.getDeliveryDate()).vehicle(s.getVehicle()).trackingNo(s.getTrackingNo()).status(s.getStatus())
                .lotId(s.getLot() == null ? null : s.getLot().getId()).lotNo(s.getLot() == null ? null : s.getLot().getLotNo())
                .inventoryTxnNo(s.getInventoryTransaction() == null ? null : s.getInventoryTransaction().getTxnNo())
                .receivableNo(s.getReceivable() == null ? null : s.getReceivable().getReceivableNo())
                .departedDate(s.getDepartedDate()).confirmedDate(s.getConfirmedDate()).build();
    }
}
