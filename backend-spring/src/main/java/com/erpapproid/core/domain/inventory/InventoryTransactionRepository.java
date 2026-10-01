package com.erpapproid.core.domain.inventory;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.lang.Nullable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InventoryTransactionRepository
        extends JpaRepository<InventoryTransactionEntity, Long> {

    Optional<InventoryTransactionEntity> findByTxnNo(String txnNo);

    boolean existsByItemId(Long itemId);

    @Nullable
    @Query("""
            select coalesce(sum(t.qty), 0) from InventoryTransactionEntity t
            where t.item.id = :itemId
            """)
    BigDecimal sumQtyByItemId(Long itemId);

    @Query("""
            select t from InventoryTransactionEntity t
            where (:itemId is null or t.item.id = :itemId)
              and (:txnType is null or t.txnType = :txnType)
              and (:from is null or t.txnDate >= :from)
              and (:to is null or t.txnDate <= :to)
            order by t.txnDate desc
            """)
    Page<InventoryTransactionEntity> search(Long itemId, String txnType, LocalDate from,
                                            LocalDate to, Pageable pageable);

    List<InventoryTransactionEntity> findByRefTypeAndRefNo(String refType, String refNo);
}
