package com.erpapproid.core.flow;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import com.fasterxml.jackson.databind.JsonNode;
import com.erpapproid.core.domain.audit.AuditLogRepository;
import com.erpapproid.core.domain.sales.SalesOrderRepository;
import com.erpapproid.core.support.IntegrationTestSupport;

/**
 * desc.md 4절 / spec 9.3 검증: 5개 도메인 흐름 + 공통 오류 응답.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class FlowIntegrationTest extends IntegrationTestSupport {

    private static final long QUOTATION_SENT = 3L;
    private static final long QUOTATION_DRAFT = 4L;
    private static final long SALES_ORDER_SHIPPED = 5L;
    private static final long SALES_ORDER_FOR_SHIPMENT = 6L;
    private static final long PURCHASE_ORDER_OPEN = 4L;
    private static final long PURCHASE_ORDER_FOR_VALIDATION = 5L;
    private static final long WORK_ORDER_OPEN = 4L;
    private static final long SHIPMENT_TO_CONFIRM = 4L;
    private static final String RECEIVING_TRACE_ID = "flow-receiving-trace";

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private SalesOrderRepository salesOrderRepository;

    private String adminToken;
    private String salesToken;
    private long createdSalesOrderId;

    @BeforeAll
    void prepareFixtures() {
        createUser("sales", "sales123", "SALES");
        adminToken = loginAdmin();
        salesToken = login("sales", "sales123");
    }

    @Test
    @Order(1)
    void flow1_quotation_to_sales_order() {
        ResponseEntity<JsonNode> response = post(
                "/api/core/sales-orders/from-quotation/" + QUOTATION_SENT, salesToken, body());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode result = response.getBody();
        assertThat(result).isNotNull();
        assertThat(result.get("salesOrderNo").asText()).startsWith("SO-");
        assertThat(result.get("status").asText()).isEqualTo("대기");
        assertThat(result.get("quotationNo").asText()).isEqualTo("QT-2609-003");
        createdSalesOrderId = result.get("id").asLong();

        Long salesUserId = userRepository.findByUsername("sales").orElseThrow().getId();
        assertThat(salesOrderRepository.findById(createdSalesOrderId).orElseThrow().getCreatedBy())
                .isEqualTo(salesUserId);

        JsonNode quotation = get("/api/core/quotations/" + QUOTATION_SENT, adminToken).getBody();
        assertThat(quotation.get("status").asText()).isEqualTo("수주완료");
    }

    @Test
    @Order(2)
    void flow2_confirm_sales_order_creates_work_order() {
        ResponseEntity<JsonNode> response = post(
                "/api/core/sales-orders/" + createdSalesOrderId + "/confirm", salesToken, body());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode result = response.getBody();
        assertThat(result).isNotNull();
        assertThat(result.get("workOrderNo").asText()).startsWith("WO-");
        assertThat(result.get("salesOrder").get("status").asText()).isEqualTo("확정");
        var createdOrders = get("/api/core/work-orders?keyword=" + result.get("workOrderNo").asText(), adminToken);
        assertThat(createdOrders.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode workOrder = createdOrders.getBody().path("content").get(0);
        assertThat(workOrder.path("routingSteps")).isNotEmpty();
        assertThat(workOrder.path("routingSteps").get(0).path("seq").asInt()).isEqualTo(10);
        assertThat(workOrder.path("plannedTimeHours").decimalValue()).isPositive();
    }

    @Test
    @Order(3)
    void flow3_purchase_order_to_receiving() {
        ResponseEntity<JsonNode> response = post("/api/core/receivings", adminToken,
                body("purchaseOrderId", PURCHASE_ORDER_OPEN,
                        "receivedQty", 600, "defectQty", 0), RECEIVING_TRACE_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getFirst("X-Trace-Id")).isEqualTo(RECEIVING_TRACE_ID);
        JsonNode result = response.getBody();
        assertThat(result).isNotNull();
        assertThat(result.get("receiving").get("status").asText()).isEqualTo("합격");
        assertThat(result.get("receiving").get("receivedQty").decimalValue())
                .isEqualByComparingTo(BigDecimal.valueOf(600));
        assertThat(result.get("lotNo").asText()).startsWith("LOT-");
        assertThat(result.get("inventoryTxnNo").asText()).startsWith("IVT-");

        JsonNode purchaseOrder = get("/api/core/purchase-orders/" + PURCHASE_ORDER_OPEN, adminToken).getBody();
        assertThat(purchaseOrder.get("status").asText()).isEqualTo("입고완료");
        assertThat(purchaseOrder.get("receivedQty").decimalValue())
                .isEqualByComparingTo(BigDecimal.valueOf(600));

        assertThat(auditLogRepository.findAllByTraceIdOrderByOccurredAtAsc(RECEIVING_TRACE_ID))
                .hasSize(4)
                .allSatisfy(log -> {
                    assertThat(log.getActorId()).isNotNull();
                    assertThat(log.getAfterJson()).isNotNull();
                })
                .extracting(log -> log.getEntityType())
                .containsExactlyInAnyOrder(
                        "RECEIVING", "PURCHASE_ORDER", "LOT", "INVENTORY_TRANSACTION");
    }

    @Test
    @Order(4)
    void flow4_complete_work_order_produces_lot() {
        ResponseEntity<JsonNode> response = post("/api/core/work-orders/" + WORK_ORDER_OPEN + "/complete",
                adminToken, body("goodQty", 450, "defectQty", 0));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode result = response.getBody();
        assertThat(result).isNotNull();
        assertThat(result.get("workOrder").get("status").asText()).isEqualTo("완료");
        assertThat(result.get("workOrder").get("progress").decimalValue())
                .isEqualByComparingTo(BigDecimal.valueOf(100));
        assertThat(result.get("lotNo").asText()).startsWith("LOT-");
        assertThat(result.get("inventoryTxnNo").asText()).startsWith("IVT-");
    }

    @Test
    @Order(5)
    void flow5_confirm_shipment_recognizes_revenue() {
        ResponseEntity<JsonNode> response = post(
                "/api/core/shipments/" + SHIPMENT_TO_CONFIRM + "/confirm", adminToken, body());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode result = response.getBody();
        assertThat(result).isNotNull();
        assertThat(result.get("shipment").get("status").asText()).isEqualTo("출하완료");
        assertThat(result.get("receivableNo").asText()).startsWith("RV-");

        JsonNode salesOrder = get("/api/core/sales-orders/" + SALES_ORDER_FOR_SHIPMENT, adminToken).getBody();
        assertThat(salesOrder.get("status").asText()).isEqualTo("출하완료");
    }

    @Test
    @Order(6)
    void unauthenticated_request_returns_401() {
        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/sales-orders", HttpMethod.GET, jsonEntity(null), JsonNode.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().get("code").asText()).isEqualTo("UNAUTHORIZED");
    }

    @Test
    @Order(7)
    void bad_credentials_return_401() {
        ResponseEntity<JsonNode> response = post("/api/core/auth/login",
                body("username", ADMIN_USERNAME, "password", "wrong-password"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().get("code").asText()).isEqualTo("UNAUTHORIZED");
    }

    @Test
    @Order(8)
    void malformed_json_body_returns_400() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>("{not-a-json", headers);

        ResponseEntity<JsonNode> response = rest.exchange(
                "/api/core/auth/login", HttpMethod.POST, entity, JsonNode.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("INVALID_INPUT");
    }

    @Test
    @Order(9)
    void insufficient_role_returns_403() {
        ResponseEntity<JsonNode> response = post("/api/core/work-orders/" + WORK_ORDER_OPEN + "/complete",
                salesToken, body("goodQty", 1, "defectQty", 0));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().get("code").asText()).isEqualTo("FORBIDDEN");
    }

    @Test
    @Order(10)
    void invalid_state_transition_returns_409() {
        ResponseEntity<JsonNode> response = post(
                "/api/core/sales-orders/" + SALES_ORDER_SHIPPED + "/confirm", adminToken, body());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("code").asText()).isEqualTo("INVALID_STATE_TRANSITION");
    }

    @Test
    @Order(11)
    void quotation_not_sent_returns_409() {
        ResponseEntity<JsonNode> response = post(
                "/api/core/sales-orders/from-quotation/" + QUOTATION_DRAFT, salesToken, body());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("code").asText()).isEqualTo("INVALID_STATE_TRANSITION");
    }

    @Test
    @Order(12)
    void missing_required_field_returns_400() {
        ResponseEntity<JsonNode> response = post("/api/core/receivings", adminToken,
                body("purchaseOrderId", PURCHASE_ORDER_FOR_VALIDATION));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("INVALID_INPUT");
    }

    @Test
    @Order(13)
    void audit_logs_are_recorded_synchronously() {
        assertThat(auditLogRepository.count()).isGreaterThan(0);
        assertThat(auditLogRepository.findAll())
                .allSatisfy(log -> {
                    assertThat(log.getTraceId()).matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,63}");
                    assertThat(log.getActorId()).isNotNull();
                    assertThat(log.getBeforeJson() != null || log.getAfterJson() != null).isTrue();
                });
    }

    @Test
    @Order(14)
    void actuator_health_is_public_but_metrics_require_admin() {
        assertThat(rest.getForEntity("/actuator/health", JsonNode.class).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(rest.getForEntity("/actuator/metrics", JsonNode.class).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(get("/actuator/metrics", adminToken).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(get("/actuator/metrics", salesToken).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
