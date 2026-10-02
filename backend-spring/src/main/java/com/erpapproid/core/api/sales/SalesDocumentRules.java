package com.erpapproid.core.api.sales;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import com.erpapproid.core.common.api.MasterListQuery;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.partner.PartnerEntity;
import jakarta.persistence.criteria.Predicate;

final class SalesDocumentRules {
    private SalesDocumentRules() {}

    static void references(PartnerEntity customer, ItemEntity item) {
        if (!"고객사".equals(customer.getPartnerType())) {
            throw new DomainException(ErrorCode.BUSINESS_RULE_VIOLATION, "고객사 유형의 거래처만 사용할 수 있습니다.");
        }
        if (!Constants.PRODUCT.equals(item.getItemType())) {
            throw new DomainException(ErrorCode.ITEM_NOT_PRODUCIBLE, "영업 문서는 제품 유형만 사용할 수 있습니다.");
        }
    }

    // 정수 원화: 원 미만은 버린다. 브라우저에서도 정확하게 표현 가능한 범위만 허용한다.
    static long amount(BigDecimal qty, long unitPrice) {
        BigDecimal amount = qty.multiply(BigDecimal.valueOf(unitPrice)).setScale(0, RoundingMode.DOWN);
        if (amount.compareTo(BigDecimal.valueOf(9007199254740991L)) > 0) {
            throw MasterListQuery.invalid("금액이 지원 범위를 초과했습니다.");
        }
        return amount.longValueExact();
    }

    static <T> Specification<T> filter(String number, String status, Long customerId, String keyword,
                                       Set<String> statuses) {
        String selected = status == null || status.isBlank() ? null : status;
        if (selected != null && !statuses.contains(selected)) throw MasterListQuery.invalid("지원하지 않는 상태입니다.");
        if (customerId != null && customerId <= 0) throw MasterListQuery.invalid("고객사 ID는 양수여야 합니다.");
        String pattern = MasterListQuery.keyword(keyword);
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            if (selected != null) predicates.add(cb.equal(root.get("status"), selected));
            if (customerId != null) predicates.add(cb.equal(root.get("customer").get("id"), customerId));
            if (pattern != null) {
                var customer = root.join("customer");
                var item = root.join("item");
                predicates.add(cb.or(cb.like(cb.lower(root.get(number)), pattern, '!'),
                        cb.like(cb.lower(customer.get("name")), pattern, '!'),
                        cb.like(cb.lower(customer.get("partnerNo")), pattern, '!'),
                        cb.like(cb.lower(item.get("itemNo")), pattern, '!'),
                        cb.like(cb.lower(item.get("name")), pattern, '!')));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
