package com.erpapproid.core.domain.inventory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LotRepository extends JpaRepository<LotEntity, Long> {

    Optional<LotEntity> findByLotNo(String lotNo);

    List<LotEntity> findByItemIdAndStatus(Long itemId, String status);

    List<LotEntity> findByItemId(Long itemId);
}
