package com.erpapproid.core.api.sales;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.domain.sales.ReceivableEntity;
import com.erpapproid.core.domain.sales.ReceivableCollectionEntity;

final class ReceivableMapper {
    private ReceivableMapper() {}
    static ReceivableDto.Response response(ReceivableEntity entity, LocalDate today) {
        boolean overdue = !Constants.COLLECTED.equals(entity.getStatus()) && entity.getAmount() > entity.getCollectedAmount()
                && entity.getDueDate().isBefore(today);
        return ReceivableDto.Response.builder().id(entity.getId()).receivableNo(entity.getReceivableNo())
                .customerId(entity.getCustomer().getId()).customerName(entity.getCustomer().getName())
                .salesOrderId(entity.getSalesOrder() == null ? null : entity.getSalesOrder().getId())
                .salesOrderNo(entity.getSalesOrder() == null ? null : entity.getSalesOrder().getSalesOrderNo())
                .amount(entity.getAmount()).collectedAmount(entity.getCollectedAmount())
                .openingCollectedAmount(entity.getOpeningCollectedAmount())
                .remainingAmount(entity.getAmount() - entity.getCollectedAmount()).dueDate(entity.getDueDate())
                .overdueDays(overdue ? Math.toIntExact(ChronoUnit.DAYS.between(entity.getDueDate(), today)) : 0)
                .status(entity.getStatus()).overdue(overdue).referenceDate(today).build();
    }
    static ReceivableDto.CollectionResponse collection(ReceivableCollectionEntity entity) {
        return new ReceivableDto.CollectionResponse(entity.getId(), entity.getRequestId(), entity.getAmount(),
                entity.getCollectedOn(), entity.getRemainingAmount(), entity.getActorId(), entity.getTraceId(), entity.getRecordedAt());
    }
}
