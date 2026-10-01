package com.erpapproid.core.domain.partner;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
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
@Table(name = "partners")
public class PartnerEntity extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "partner_no", nullable = false, unique = true)
    private String partnerNo;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "contact")
    private String contact;

    @Column(name = "contact_name", length = 64)
    private String contactName;

    @Builder.Default
    @Column(name = "lead_time_days", nullable = false)
    private Integer leadTimeDays = 0;

    @Column(name = "payment_terms", nullable = false)
    private Integer paymentTerms;

    @Column(name = "partner_type", nullable = false)
    private String partnerType;
}
