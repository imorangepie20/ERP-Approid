package com.erpapproid.core.domain.inventory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LotRepository extends JpaRepository<LotEntity, Long> {

    Optional<LotEntity> findByLotNo(String lotNo);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select l from LotEntity l where l.id = :id")
    Optional<LotEntity> findForUpdate(Long id);

    List<LotEntity> findByItemIdAndStatus(Long itemId, String status);

    List<LotEntity> findByItemId(Long itemId);
}
