package com.erpapproid.core.audit;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

import com.erpapproid.core.api.bom.BomController;
import com.erpapproid.core.api.inventory.LotController;
import com.erpapproid.core.api.item.ItemController;
import com.erpapproid.core.api.partner.PartnerController;
import com.erpapproid.core.api.production.ProductionPlanController;
import com.erpapproid.core.api.production.WorkOrderController;
import com.erpapproid.core.api.purchase.PurchaseOrderController;
import com.erpapproid.core.api.purchase.ReceivingController;
import com.erpapproid.core.api.routing.RoutingController;
import com.erpapproid.core.api.sales.QuotationController;
import com.erpapproid.core.api.sales.ReceivableController;
import com.erpapproid.core.api.sales.SalesOrderController;
import com.erpapproid.core.api.sales.ShipmentController;

class WriteTransactionContractTest {

    private static final List<Class<?>> WRITE_CONTROLLERS = List.of(
            ItemController.class, PartnerController.class, BomController.class,
            RoutingController.class, QuotationController.class, SalesOrderController.class,
            ShipmentController.class, ReceivableController.class, PurchaseOrderController.class,
            ReceivingController.class, ProductionPlanController.class, WorkOrderController.class,
            LotController.class);

    @Test
    void every_business_write_endpoint_has_a_transaction_boundary() {
        List<String> missing = WRITE_CONTROLLERS.stream()
                .flatMap(type -> java.util.Arrays.stream(type.getDeclaredMethods())
                        .filter(this::isWriteEndpoint)
                        .filter(method -> !AnnotatedElementUtils.hasAnnotation(method, Transactional.class))
                        .map(method -> type.getSimpleName() + "#" + method.getName()))
                .sorted()
                .toList();

        assertThat(missing).isEmpty();
    }

    private boolean isWriteEndpoint(Method method) {
        return AnnotatedElementUtils.hasAnnotation(method, PostMapping.class)
                || AnnotatedElementUtils.hasAnnotation(method, PutMapping.class)
                || AnnotatedElementUtils.hasAnnotation(method, PatchMapping.class)
                || AnnotatedElementUtils.hasAnnotation(method, DeleteMapping.class);
    }
}
