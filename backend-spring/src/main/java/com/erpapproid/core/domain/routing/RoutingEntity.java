package com.erpapproid.core.domain.routing;

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
@Table(name = "routings",
        uniqueConstraints = @UniqueConstraint(name = "uk_routings_item_seq",
                columnNames = {"item_id", "seq"}))
public class RoutingEntity extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "routing_no", nullable = false, unique = true)
    private String routingNo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private ItemEntity item;

    @Column(name = "seq", nullable = false)
    private Integer seq;

    @Column(name = "process", nullable = false)
    private String process;

    @Column(name = "work_center", nullable = false)
    private String workCenter;

    @Column(name = "std_time", nullable = false, precision = 10, scale = 3)
    private BigDecimal stdTime;

    @Column(name = "is_subcontract", nullable = false)
    private Boolean isSubcontract;
}
