package com.erpapproid.core.domain.item;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface ItemRepository extends JpaRepository<ItemEntity, Long> {

    boolean existsByItemNo(String itemNo);

    Optional<ItemEntity> findByItemNo(String itemNo);

    @Query("""
            select i from ItemEntity i
            where (:itemType is null or i.itemType = :itemType)
              and (:keyword is null or lower(i.name) like lower(concat('%', :keyword, '%'))
                   or lower(i.itemNo) like lower(concat('%', :keyword, '%')))
            """)
    Page<ItemEntity> search(String itemType, String keyword, Pageable pageable);
}
