package com.erpapproid.core.api.sales;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.erpapproid.core.api.sales.ShipmentDto.ConfirmResult;
import com.erpapproid.core.api.sales.ShipmentDto.Request;
import com.erpapproid.core.api.sales.ShipmentDto.Response;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.common.seq.DomainNumberGenerator;
import com.erpapproid.core.common.seq.DomainNumberGenerator.Prefix;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.inventory.InventoryTransactionEntity;
import com.erpapproid.core.domain.inventory.InventoryTransactionRepository;
import com.erpapproid.core.domain.partner.PartnerEntity;
import com.erpapproid.core.domain.sales.ReceivableEntity;
import com.erpapproid.core.domain.sales.ReceivableRepository;
import com.erpapproid.core.domain.sales.SalesOrderEntity;
import com.erpapproid.core.domain.sales.SalesOrderRepository;
import com.erpapproid.core.domain.sales.ShipmentEntity;
import com.erpapproid.core.domain.sales.ShipmentRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "shipments", description = "출하")
@RestController
@RequestMapping("/api/core/shipments")
@RequiredArgsConstructor
public class ShipmentController {

    private final ShipmentRepository shipmentRepository;
    private final SalesOrderRepository salesOrderRepository;
    private final ReceivableRepository receivableRepository;
    private final InventoryTransactionRepository inventoryTransactionRepository;
    private final DomainNumberGenerator numberGenerator;
    private final AuditService auditService;

    @Operation(summary = "출하 목록")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(
                shipmentRepository.search(status, customerId, keyword, pageable)
                        .map(this::toResponse));
    }

    @Operation(summary = "출하 상세")
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(shipmentRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new DomainException(ErrorCode.SHIPMENT_NOT_FOUND,
                        "출하를 찾을 수 없습니다: " + id)));
    }

    @Operation(summary = "출하 지시 생성")
    @PostMapping
    @PreAuthorize("hasRole('SALES')")
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        SalesOrderEntity order = salesOrderRepository.findById(request.getSalesOrderId())
                .orElseThrow(() -> new DomainException(ErrorCode.SALES_ORDER_NOT_FOUND,
                        "수주를 찾을 수 없습니다: " + request.getSalesOrderId()));
        if (Constants.WAITING.equals(order.getStatus())) {
            throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION,
                    "확정되지 않은 수주는 출하할 수 없습니다: " + order.getSalesOrderNo());
        }
        BigDecimal available = inventoryTransactionRepository.sumQtyByItemId(order.getItem().getId());
        if (available == null || available.compareTo(request.getQty()) < 0) {
            throw new DomainException(ErrorCode.INSUFFICIENT_STOCK,
                    "가용 재고가 부족합니다. 품목: " + order.getItem().getItemNo()
                            + ", 가용: " + (available == null ? "0" : available)
                            + ", 요청: " + request.getQty());
        }
        ShipmentEntity entity = ShipmentEntity.builder()
                .shipmentNo(numberGenerator.next(Prefix.SHIPMENT))
                .salesOrder(order)
                .customer(order.getCustomer())
                .item(order.getItem())
                .qty(request.getQty())
                .amount(order.getUnitPrice() * request.getQty().longValue())
                .deliveryDate(request.getDeliveryDate())
                .vehicle(request.getVehicle())
                .status(Constants.DISPATCH)
                .build();
        ShipmentEntity saved = shipmentRepository.save(entity);
        auditService.record("CREATE", "SHIPMENT", saved.getShipmentNo(), toResponse(saved));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "배차 (지시 → 배차)")
    @PostMapping("/{id}/dispatch")
    @PreAuthorize("hasRole('SALES')")
    public ResponseEntity<Response> dispatch(@PathVariable Long id) {
        ShipmentEntity entity = shipmentRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.SHIPMENT_NOT_FOUND,
                        "출하를 찾을 수 없습니다: " + id));
        if (!Constants.DISPATCH.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "지시 상태의 출하만 배차할 수 있습니다: " + entity.getShipmentNo());
        }
        entity.setStatus(Constants.DISPATCHED);
        ShipmentEntity saved = shipmentRepository.save(entity);
        auditService.record("DISPATCH", "SHIPMENT", saved.getShipmentNo(), toResponse(saved));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "흐름 5: 출하 확정 → 매출/미수 반영")
    @PostMapping("/{id}/confirm")
    @PreAuthorize("hasAnyRole('SALES', 'ADMIN')")
    @Transactional
    public ResponseEntity<ConfirmResult> confirm(@PathVariable Long id) {
        ShipmentEntity shipment = shipmentRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.SHIPMENT_NOT_FOUND,
                        "출하를 찾을 수 없습니다: " + id));
        if (Constants.REVENUE_RECOGNIZED.equals(shipment.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "이미 매출 반영된 출하입니다: " + shipment.getShipmentNo());
        }
        SalesOrderEntity order = shipment.getSalesOrder();
        BigDecimal available = inventoryTransactionRepository.sumQtyByItemId(order.getItem().getId());
        if (available == null || available.compareTo(shipment.getQty()) < 0) {
            throw new DomainException(ErrorCode.INSUFFICIENT_STOCK,
                    "가용 재고가 부족합니다. 품목: " + order.getItem().getItemNo());
        }

        shipment.setStatus(Constants.SHIPPED);
        shipment.setDeliveryDate(LocalDate.now());
        ShipmentEntity savedShipment = shipmentRepository.save(shipment);

        order.setStatus(Constants.SHIPPED);
        salesOrderRepository.save(order);

        InventoryTransactionEntity txn = InventoryTransactionEntity.builder()
                .txnNo(numberGenerator.next(Prefix.INVENTORY_TXN, 4))
                .item(order.getItem())
                .warehouse(Constants.WAREHOUSE_PRODUCT)
                .txnType(Constants.TXN_SHIP)
                .qty(shipment.getQty().negate())
                .refType("SHIPMENT")
                .refNo(savedShipment.getShipmentNo())
                .txnDate(LocalDate.now())
                .build();
        inventoryTransactionRepository.save(txn);

        PartnerEntity customer = order.getCustomer();
        ReceivableEntity receivable = ReceivableEntity.builder()
                .receivableNo(numberGenerator.next(Prefix.RECEIVABLE))
                .customer(customer)
                .salesOrder(order)
                .amount(shipment.getAmount())
                .dueDate(LocalDate.now().plusDays(customer.getPaymentTerms()))
                .overdueDays(0)
                .status(Constants.OPEN)
                .build();
        ReceivableEntity savedReceivable = receivableRepository.save(receivable);

        auditService.record("CONFIRM", "SHIPMENT", savedShipment.getShipmentNo(),
                toResponse(savedShipment));
        auditService.record("CREATE", "RECEIVABLE", savedReceivable.getReceivableNo(), null);
        return ResponseEntity.ok(ConfirmResult.builder()
                .shipment(toResponse(savedShipment))
                .receivableNo(savedReceivable.getReceivableNo())
                .build());
    }

    @Operation(summary = "출하 수정 (지시/배차만)")
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('SALES')")
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody Request request) {
        ShipmentEntity entity = shipmentRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.SHIPMENT_NOT_FOUND,
                        "출하를 찾을 수 없습니다: " + id));
        if (!Constants.DISPATCH.equals(entity.getStatus())
                && !Constants.DISPATCHED.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "지시/배차 상태의 출하만 수정할 수 있습니다: " + entity.getShipmentNo());
        }
        Response before = toResponse(entity);
        if (request.getQty() != null) {
            entity.setQty(request.getQty());
        }
        if (request.getDeliveryDate() != null) {
            entity.setDeliveryDate(request.getDeliveryDate());
        }
        if (request.getVehicle() != null) {
            entity.setVehicle(request.getVehicle());
        }
        ShipmentEntity saved = shipmentRepository.save(entity);
        auditService.record("UPDATE", "SHIPMENT", saved.getShipmentNo(), before, toResponse(saved));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "출하 삭제 (지시만)")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SALES')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        ShipmentEntity entity = shipmentRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.SHIPMENT_NOT_FOUND,
                        "출하를 찾을 수 없습니다: " + id));
        if (!Constants.DISPATCH.equals(entity.getStatus())) {
            throw new DomainException(ErrorCode.INVALID_STATE_TRANSITION,
                    "지시 상태의 출하만 삭제할 수 있습니다: " + entity.getShipmentNo());
        }
        shipmentRepository.delete(entity);
        auditService.record("DELETE", "SHIPMENT", entity.getShipmentNo(), null);
        return ResponseEntity.noContent().build();
    }

    private Response toResponse(ShipmentEntity entity) {
        return Response.builder()
                .id(entity.getId())
                .shipmentNo(entity.getShipmentNo())
                .salesOrderId(entity.getSalesOrder().getId())
                .salesOrderNo(entity.getSalesOrder().getSalesOrderNo())
                .customerId(entity.getCustomer().getId())
                .customerName(entity.getCustomer().getName())
                .itemId(entity.getItem().getId())
                .itemNo(entity.getItem().getItemNo())
                .qty(entity.getQty())
                .amount(entity.getAmount())
                .deliveryDate(entity.getDeliveryDate())
                .vehicle(entity.getVehicle())
                .status(entity.getStatus())
                .build();
    }
}
