package com.erpapproid.core.api.item;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogEntity;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.domain.inventory.InventoryTransactionEntity;
import com.erpapproid.core.domain.inventory.InventoryTransactionRepository;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

class ItemCrudIntegrationTest extends IntegrationTestSupport {

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private InventoryTransactionRepository inventoryTransactionRepository;

    @Test
    void admin_can_create_partially_update_and_delete_with_sensitive_audit_history() {
        String token = loginAdmin();

        ResponseEntity<JsonNode> created = rest.exchange(
                "/api/core/items", HttpMethod.POST,
                authEntity(token, validCreateBody("T-CRUD-001"), "item-create-trace"),
                JsonNode.class);

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody()).isNotNull();
        long id = created.getBody().get("id").asLong();
        assertThat(created.getBody().get("stock").decimalValue()).isZero();
        assertAudit("item-create-trace", "CREATE", "T-CRUD-001", false, true);

        ResponseEntity<JsonNode> updated = rest.exchange(
                "/api/core/items/" + id, HttpMethod.PATCH,
                authEntity(token, body(
                        "price", 12500,
                        "safetyStock", 25.5,
                        "leadTimeDays", 4), "item-update-trace"),
                JsonNode.class);

        assertThat(updated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(updated.getBody()).isNotNull();
        assertThat(updated.getBody().get("itemNo").asText()).isEqualTo("T-CRUD-001");
        assertThat(updated.getBody().get("name").asText()).isEqualTo("통합 테스트 품목");
        assertThat(updated.getBody().get("price").asLong()).isEqualTo(12500);
        assertThat(updated.getBody().get("safetyStock").decimalValue()).isEqualByComparingTo("25.5");
        assertThat(updated.getBody().get("leadTimeDays").asInt()).isEqualTo(4);
        assertAudit("item-update-trace", "UPDATE", "T-CRUD-001", true, true);

        ResponseEntity<JsonNode> deleted = rest.exchange(
                "/api/core/items/" + id, HttpMethod.DELETE,
                authEntity(token, null, "item-delete-trace"), JsonNode.class);

        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(itemRepository.findById(id)).isEmpty();
        assertAudit("item-delete-trace", "DELETE", "T-CRUD-001", true, false);
    }

    @Test
    void non_admin_cannot_create_update_or_delete_items() {
        createUser("items-sales-writer", "password123", "SALES");
        String token = login("items-sales-writer", "password123");
        ItemEntity item = itemRepository.findByItemNo("M-S001").orElseThrow();

        assertForbidden(rest.exchange(
                "/api/core/items", HttpMethod.POST,
                authEntity(token, validCreateBody("T-FORBIDDEN-001")), JsonNode.class));
        assertForbidden(rest.exchange(
                "/api/core/items/" + item.getId(), HttpMethod.PATCH,
                authEntity(token, body("price", 1)), JsonNode.class));
        assertForbidden(rest.exchange(
                "/api/core/items/" + item.getId(), HttpMethod.DELETE,
                authEntity(token, null), JsonNode.class));
    }

    @Test
    void duplicate_item_number_returns_the_documented_domain_error() {
        ResponseEntity<JsonNode> response = post(
                "/api/core/items", loginAdmin(), validCreateBody("M-S001"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("code").asText()).isEqualTo("ITEM_NO_DUPLICATE");
    }

    @Test
    void referenced_item_cannot_be_deleted() {
        ItemEntity item = itemRepository.findByItemNo("M-S001").orElseThrow();

        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/items/" + item.getId(), HttpMethod.DELETE,
                authEntity(loginAdmin(), null), JsonNode.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("code").asText()).isEqualTo("ITEM_IN_USE");
    }

    @Test
    void item_with_zero_balance_inventory_history_still_cannot_be_deleted() {
        ResponseEntity<JsonNode> created = post(
                "/api/core/items", loginAdmin(), validCreateBody("T-HISTORY-001"));
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        long itemId = created.getBody().get("id").asLong();
        ItemEntity item = itemRepository.findById(itemId).orElseThrow();
        InventoryTransactionEntity inbound = inventoryTransactionRepository.save(
                InventoryTransactionEntity.builder()
                .txnNo("T-HISTORY-IN")
                .item(item)
                .warehouse("자재창고")
                .txnType("입고")
                .qty(BigDecimal.TEN)
                .refType("TEST")
                .refNo("T-HISTORY-001")
                .txnDate(LocalDate.now())
                .build());
        InventoryTransactionEntity outbound = inventoryTransactionRepository.save(
                InventoryTransactionEntity.builder()
                .txnNo("T-HISTORY-OUT")
                .item(item)
                .warehouse("자재창고")
                .txnType("출고")
                .qty(BigDecimal.TEN.negate())
                .refType("TEST")
                .refNo("T-HISTORY-001")
                .txnDate(LocalDate.now())
                .build());

        try {
            ResponseEntity<JsonNode> response = rest.exchange(
                    "/api/core/items/" + itemId, HttpMethod.DELETE,
                    authEntity(loginAdmin(), null), JsonNode.class);

            assertThat(inventoryTransactionRepository.sumQtyByItemId(itemId)).isZero();
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().get("code").asText()).isEqualTo("ITEM_IN_USE");
            assertThat(itemRepository.findById(itemId)).isPresent();
        } finally {
            inventoryTransactionRepository.deleteAll(List.of(inbound, outbound));
            itemRepository.delete(item);
        }
    }

    @Test
    void create_rejects_invalid_type_and_oversized_database_fields_before_persistence() {
        Map<String, Object> invalidType = validCreateBody("T-INVALID-001");
        invalidType.put("itemType", "서비스");
        ResponseEntity<JsonNode> typeResponse = post("/api/core/items", loginAdmin(), invalidType);

        Map<String, Object> oversized = validCreateBody("X".repeat(33));
        ResponseEntity<JsonNode> lengthResponse = post("/api/core/items", loginAdmin(), oversized);

        assertInvalidInput(typeResponse, "itemType");
        assertInvalidInput(lengthResponse, "itemNo");
    }

    private Map<String, Object> validCreateBody(String itemNo) {
        return body(
                "itemNo", itemNo,
                "name", "통합 테스트 품목",
                "spec", "SPEC-01",
                "category", "테스트",
                "itemType", "자재",
                "unit", "EA",
                "price", 10000,
                "safetyStock", 10,
                "leadTimeDays", 2);
    }

    private void assertAudit(String traceId, String action, String entityNo,
                             boolean hasBefore, boolean hasAfter) {
        assertThat(auditLogRepository.findAllByTraceIdOrderByOccurredAtAsc(traceId))
                .singleElement()
                .satisfies(audit -> {
                    assertThat(audit.getAction()).isEqualTo(action);
                    assertThat(audit.getEntityType()).isEqualTo("ITEM");
                    assertThat(audit.getEntityNo()).isEqualTo(entityNo);
                    assertThat(audit.getActorId()).isNotNull();
                    assertThat(audit.isSensitive()).isTrue();
                    assertSnapshot(audit, hasBefore, hasAfter);
                });
    }

    private void assertSnapshot(AuditLogEntity audit, boolean hasBefore, boolean hasAfter) {
        if (hasBefore) {
            assertThat(audit.getBeforeJson()).contains("T-CRUD-001");
        } else {
            assertThat(audit.getBeforeJson()).isNull();
        }
        if (hasAfter) {
            assertThat(audit.getAfterJson()).contains("T-CRUD-001");
        } else {
            assertThat(audit.getAfterJson()).isNull();
        }
    }

    private void assertForbidden(ResponseEntity<JsonNode> response) {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("code").asText()).isEqualTo("FORBIDDEN");
    }

    private void assertInvalidInput(ResponseEntity<JsonNode> response, String field) {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("code").asText()).isEqualTo("INVALID_INPUT");
        assertThat(response.getBody().get("errors").toString()).contains(field);
    }
}
