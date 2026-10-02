package com.erpapproid.core.domain.production;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import com.erpapproid.core.common.entity.BaseEntity;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.sales.SalesOrderEntity;

@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Table(name = "work_orders")
public class WorkOrderEntity extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "work_order_no", nullable = false, unique = true)
    private String workOrderNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sales_order_id")
    private SalesOrderEntity salesOrder;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private ItemEntity item;

    @Column(name = "qty", nullable = false, precision = 18, scale = 4)
    private BigDecimal qty;

    @Column(name = "good_qty", nullable = false, precision = 18, scale = 4)
    private BigDecimal goodQty;

    @Column(name = "defect_qty", nullable = false, precision = 18, scale = 4)
    private BigDecimal defectQty;

    @Column(name = "progress", nullable = false, precision = 5, scale = 2)
    private BigDecimal progress;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(name = "status", nullable = false)
    private String status;

    @Builder.Default
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "routing_steps", nullable = false, columnDefinition = "jsonb")
    private List<RoutingStepSnapshot> routingSteps = List.of();
}
