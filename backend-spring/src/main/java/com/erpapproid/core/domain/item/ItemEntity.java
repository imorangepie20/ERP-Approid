package com.erpapproid.core.domain.item;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import com.erpapproid.core.common.entity.BaseEntity;

@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Table(name = "items")
public class ItemEntity extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "item_no", nullable = false, unique = true)
    private String itemNo;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "spec")
    private String spec;

    @Column(name = "category")
    private String category;

    @Column(name = "item_type", nullable = false)
    private String itemType;

    @Column(name = "unit", nullable = false)
    private String unit;

    @Column(name = "price", nullable = false)
    private Long price;

    @Column(name = "stock", nullable = false, precision = 18, scale = 4)
    private BigDecimal stock;

    @Column(name = "safety_stock", nullable = false, precision = 18, scale = 4)
    private BigDecimal safetyStock;

    @Column(name = "lead_time_days", nullable = false)
    private Integer leadTimeDays;
}
