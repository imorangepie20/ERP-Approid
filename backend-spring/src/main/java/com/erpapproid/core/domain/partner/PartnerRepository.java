package com.erpapproid.core.domain.partner;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PartnerRepository extends JpaRepository<PartnerEntity, Long> {

    boolean existsByPartnerNo(String partnerNo);

    @Query("""
            select p from PartnerEntity p
            where (:partnerType is null or p.partnerType = :partnerType)
              and (:keyword is null or lower(p.name) like lower(concat('%', cast(:keyword as string), '%')) escape '!'
                   or lower(p.partnerNo) like lower(concat('%', cast(:keyword as string), '%')) escape '!')
            """)
    Page<PartnerEntity> search(String partnerType, String keyword, Pageable pageable);
}
