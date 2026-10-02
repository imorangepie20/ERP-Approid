package com.erpapproid.core.api.item;

import java.math.BigDecimal;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.erpapproid.core.api.item.ItemDto.CreateRequest;
import com.erpapproid.core.api.item.ItemDto.Response;
import com.erpapproid.core.api.item.ItemDto.UpdateRequest;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.audit.AuditService;
import com.erpapproid.core.domain.audit.AuditEvent;
import com.erpapproid.core.domain.bom.BomRepository;
import com.erpapproid.core.domain.inventory.InventoryTransactionRepository;
import com.erpapproid.core.domain.item.ItemEntity;
import com.erpapproid.core.domain.item.ItemRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "items", description = "품목 마스터")
@RestController
@RequestMapping("/api/core/items")
@RequiredArgsConstructor
public class ItemController {

    private static final int MAX_KEYWORD_LENGTH = 128;
    private static final int MAX_ITEM_TYPE_LENGTH = 16;
    private static final int MAX_PAGE_INDEX = 10_000;
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ALLOWED_ITEM_TYPES = Set.of(
            "\uC81C\uD488", "\uBC18\uC81C\uD488", "\uC790\uC7AC");
    private static final Set<String> ALLOWED_SORT_PROPERTIES = Set.of(
            "itemNo", "name", "spec", "itemType", "unit", "price", "stock", "safetyStock");

    private final ItemRepository itemRepository;
    private final BomRepository bomRepository;
    private final com.erpapproid.core.domain.routing.RoutingRepository routingRepository;
    private final InventoryTransactionRepository inventoryTransactionRepository;
    private final AuditService auditService;

    @Operation(summary = "품목 목록")
    @GetMapping
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String itemType,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "itemNo,asc") String sort) {
        validateKeyword(keyword);
        String normalizedItemType = normalizeItemType(itemType);
        Pageable pageable = createPageable(page, size, sort);
        String escapedKeyword = escapeLikeKeyword(keyword);
        Page<ItemEntity> result = itemRepository.search(normalizedItemType, escapedKeyword, pageable);
        return ResponseEntity.ok(result.map(this::toResponse));
    }

    @Operation(summary = "품목 상세")
    @GetMapping("/{id}")
    public ResponseEntity<Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(itemRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + id)));
    }

    @Operation(summary = "품목 생성")
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Response> create(@Valid @RequestBody CreateRequest request) {
        if (itemRepository.existsByItemNo(request.getItemNo())) {
            throw new DomainException(ErrorCode.ITEM_NO_DUPLICATE,
                    "이미 존재하는 품번입니다: " + request.getItemNo());
        }
        ItemEntity entity = ItemEntity.builder()
                .itemNo(request.getItemNo())
                .name(request.getName())
                .spec(request.getSpec())
                .category(request.getCategory())
                .itemType(request.getItemType())
                .unit(request.getUnit())
                .price(request.getPrice())
                .stock(BigDecimal.ZERO)
                .safetyStock(request.getSafetyStock() == null
                        ? BigDecimal.ZERO : request.getSafetyStock())
                .leadTimeDays(request.getLeadTimeDays() == null ? 0 : request.getLeadTimeDays())
                .build();
        ItemEntity saved = itemRepository.save(entity);
        auditService.record(AuditEvent.sensitiveCreated("ITEM", saved.getItemNo(), toResponse(saved)));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Operation(summary = "품목 수정")
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Response> update(@PathVariable Long id, @Valid @RequestBody UpdateRequest request) {
        if (!request.hasChanges()) {
            throw invalidInput("At least one item field must be provided.");
        }
        ItemEntity entity = itemRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + id));
        Response before = toResponse(entity);
        applyRequest(entity, request);
        ItemEntity saved = itemRepository.save(entity);
        auditService.record(AuditEvent.sensitiveChange(
                "UPDATE", "ITEM", saved.getItemNo(), before, toResponse(saved)));
        return ResponseEntity.ok(toResponse(saved));
    }

    @Operation(summary = "품목 삭제")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        ItemEntity entity = itemRepository.findById(id)
                .orElseThrow(() -> new DomainException(ErrorCode.ITEM_NOT_FOUND,
                        "품목을 찾을 수 없습니다: " + id));
        if (bomRepository.countByParentId(id) > 0 || bomRepository.countByChildId(id) > 0) {
            throw new DomainException(ErrorCode.ITEM_IN_USE, "BOM 참조 중인 품목은 삭제할 수 없습니다.");
        }
        if (inventoryTransactionRepository.existsByItemId(id)) {
            throw new DomainException(ErrorCode.ITEM_IN_USE,
                    "재고 이력이 있는 품목은 삭제할 수 없습니다.");
        }
        if (routingRepository.countByItemId(id) > 0) {
            throw new DomainException(ErrorCode.ITEM_IN_USE, "공정에서 참조 중인 품목은 삭제할 수 없습니다.");
        }
        Response before = toResponse(entity);
        itemRepository.delete(entity);
        auditService.record(AuditEvent.sensitiveDeleted("ITEM", entity.getItemNo(), before));
        return ResponseEntity.noContent().build();
    }

    private void applyRequest(ItemEntity entity, UpdateRequest request) {
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getSpec() != null) {
            entity.setSpec(request.getSpec());
        }
        if (request.getCategory() != null) {
            entity.setCategory(request.getCategory());
        }
        if (request.getItemType() != null) {
            entity.setItemType(request.getItemType());
        }
        if (request.getUnit() != null) {
            entity.setUnit(request.getUnit());
        }
        if (request.getPrice() != null) {
            entity.setPrice(request.getPrice());
        }
        if (request.getSafetyStock() != null) {
            entity.setSafetyStock(request.getSafetyStock());
        }
        if (request.getLeadTimeDays() != null) {
            entity.setLeadTimeDays(request.getLeadTimeDays());
        }
    }

    private void validateKeyword(String keyword) {
        if (keyword != null && keyword.length() > MAX_KEYWORD_LENGTH) {
            throw invalidInput("keyword must not exceed 128 characters.");
        }
    }

    private String normalizeItemType(String itemType) {
        if (itemType == null || itemType.isBlank()) {
            return null;
        }
        if (itemType.length() > MAX_ITEM_TYPE_LENGTH || !ALLOWED_ITEM_TYPES.contains(itemType)) {
            throw invalidInput("Unsupported item type.");
        }
        return itemType;
    }

    private Pageable createPageable(int page, int size, String sort) {
        if (page < 0 || page > MAX_PAGE_INDEX) {
            throw invalidInput("page must be between 0 and 10000.");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw invalidInput("size must be between 1 and 100.");
        }

        String[] sortParts = sort.split(",", -1);
        if (sortParts.length != 2 || !ALLOWED_SORT_PROPERTIES.contains(sortParts[0])) {
            throw invalidInput("Unsupported item sort.");
        }

        Sort.Direction direction;
        try {
            direction = Sort.Direction.fromString(sortParts[1]);
        } catch (IllegalArgumentException ex) {
            throw invalidInput("Unsupported item sort direction.");
        }
        Sort requestedSort = Sort.by(direction, sortParts[0]);
        Sort stableSort = "itemNo".equals(sortParts[0])
                ? requestedSort
                : requestedSort.and(Sort.by(Sort.Direction.ASC, "itemNo"));
        return PageRequest.of(page, size, stableSort);
    }

    private String escapeLikeKeyword(String keyword) {
        if (keyword == null) {
            return null;
        }
        return keyword
                .replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_");
    }

    private DomainException invalidInput(String message) {
        return new DomainException(ErrorCode.INVALID_INPUT, message);
    }

    private Response toResponse(ItemEntity entity) {
        return Response.builder()
                .id(entity.getId())
                .itemNo(entity.getItemNo())
                .name(entity.getName())
                .spec(entity.getSpec())
                .category(entity.getCategory())
                .itemType(entity.getItemType())
                .unit(entity.getUnit())
                .price(entity.getPrice())
                .stock(entity.getStock())
                .safetyStock(entity.getSafetyStock())
                .leadTimeDays(entity.getLeadTimeDays())
                .build();
    }
}
