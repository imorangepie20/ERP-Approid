package com.erpapproid.core.domain.production;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import com.erpapproid.core.common.entity.BaseEntity;
import com.erpapproid.core.domain.item.ItemEntity;

@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Table(name = "production_plans",
        uniqueConstraints = @UniqueConstraint(name = "uk_plans_item_month",
                columnNames = {"item_id", "plan_month"}))
public class ProductionPlanEntity extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plan_no", nullable = false, unique = true)
    private String planNo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private ItemEntity item;

    @Column(name = "plan_month", nullable = false)
    private String planMonth;

    @Column(name = "plan_qty", nullable = false, precision = 18, scale = 4)
    private BigDecimal planQty;

    @Column(name = "order_qty", nullable = false, precision = 18, scale = 4)
    private BigDecimal orderQty;

    @Column(name = "stock_qty", nullable = false, precision = 18, scale = 4)
    private BigDecimal stockQty;

    @Column(name = "gap_qty", nullable = false, precision = 18, scale = 4)
    private BigDecimal gapQty;

    @Column(name = "status", nullable = false)
    private String status;
}
