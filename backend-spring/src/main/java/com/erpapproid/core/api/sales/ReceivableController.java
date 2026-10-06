package com.erpapproid.core.api.sales;

import org.springframework.data.domain.Page;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import jakarta.validation.Valid;

import com.erpapproid.core.api.sales.ReceivableDto.Response;
import com.erpapproid.core.api.sales.ReceivableDto.Summary;
import com.erpapproid.core.common.domain.Constants;
import com.erpapproid.core.common.api.MasterListQuery;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import com.erpapproid.core.domain.sales.ReceivableRepository;
import com.erpapproid.core.domain.sales.ReceivableCollectionRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "receivables", description = "미수금")
@RestController
@RequestMapping("/api/core/receivables")
@RequiredArgsConstructor
public class ReceivableController {
    private static final ZoneId TIME_ZONE = ZoneId.of("Asia/Seoul");
    private static final Set<String> SORTS = Set.of("receivableNo", "amount", "dueDate", "status");

    private final ReceivableRepository receivableRepository;
    private final ReceivableCollectionRepository collections;
    private final ReceivableCollectionService collectionService;
    private final ReceivableReminderService reminderService;

    @Operation(summary = "미수금 목록")
    @GetMapping
    @PreAuthorize("hasAnyRole('SALES', 'ACCOUNTING', 'ADMIN')")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ResponseEntity<Page<Response>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean overdue,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "receivableNo,asc") String sort) {
        if (status != null && status.isBlank()) status = null;
        if (status != null && !Set.of(Constants.OPEN, Constants.COLLECTED, Constants.OVERDUE).contains(status)) {
            throw MasterListQuery.invalid("지원하지 않는 미수금 상태입니다.");
        }
        if (customerId != null && customerId <= 0) throw MasterListQuery.invalid("고객 ID는 양수여야 합니다.");
        var pageable = MasterListQuery.pageable(page, size, sort, SORTS, "id");
        var pattern = MasterListQuery.keyword(keyword);
        var today = LocalDate.now(TIME_ZONE);
        return ResponseEntity.ok(
                receivableRepository.search(status, customerId, pattern, overdue, today, pageable)
                        .map(entity -> ReceivableMapper.response(entity, today)));
    }

    @Operation(summary = "미수/연체 요약")
    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('SALES', 'ACCOUNTING', 'ADMIN')")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ResponseEntity<Summary> summary() {
        var today = LocalDate.now(TIME_ZONE);
        return ResponseEntity.ok(Summary.builder()
                .openCount(receivableRepository.countByStatusNot(Constants.COLLECTED))
                .openAmount(receivableRepository.sumOpenAmount())
                .overdueCount(receivableRepository.countOverdue(today))
                .overdueAmount(receivableRepository.sumOverdueAmount(today))
                .openBalance(receivableRepository.sumOpenBalance())
                .overdueBalance(receivableRepository.sumOverdueBalance(today))
                .referenceDate(today)
                .build());
    }

    @Operation(summary = "미수금 잔액·수납 이력")
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SALES', 'ACCOUNTING', 'ADMIN')")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ResponseEntity<ReceivableDto.Detail> detail(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        if (id <= 0) throw MasterListQuery.invalid("미수금 ID는 양수여야 합니다.");
        var pageable = MasterListQuery.pageable(page, size, "id,desc", Set.of("id"), "id");
        var entity = receivableRepository.findById(id).orElseThrow(() -> new DomainException(ErrorCode.NOT_FOUND, "미수금을 찾을 수 없습니다: " + id));
        return ResponseEntity.ok(new ReceivableDto.Detail(ReceivableMapper.response(entity, LocalDate.now(TIME_ZONE)),
                collections.findByReceivable_Id(id, pageable).map(ReceivableMapper::collection)));
    }

    @Operation(summary = "독촉 검토용 현재 미수·거래처 연락처", description = "읽기 전용. 채널·수신동의·발송 상태를 추정하지 않으며 발송하지 않습니다.")
    @GetMapping("/{id}/reminder-preview")
    @PreAuthorize("hasAnyRole('SALES', 'ACCOUNTING', 'ADMIN')")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ResponseEntity<ReceivableDto.ReminderPreview> reminderPreview(@PathVariable Long id) {
        if (id <= 0) throw MasterListQuery.invalid("미수금 ID는 양수여야 합니다.");
        return ResponseEntity.ok(reminderService.preview(id));
    }

    @GetMapping("/{id}/reminders")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTING','SALES')")
    public org.springframework.data.domain.Page<com.erpapproid.core.api.messaging.MessageDto.Summary> reminderHistory(
            @PathVariable Long id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return reminderService.history(id,page,size);
    }

    @PostMapping("/{id}/reminders")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTING')")
    public ResponseEntity<com.erpapproid.core.api.messaging.MessageDto.Result> requestReminder(@PathVariable Long id,
            @Valid @RequestBody com.erpapproid.core.api.messaging.MessageDto.Request input) {
        var result=reminderService.request(id,input);
        return ResponseEntity.status(result.replayed()?200:202).body(result);
    }

    @Operation(summary = "전액·부분 수납", description = "금액·수납일·요청 UUID 필수. 동일 처리자/키/입력 재전송은 중복 저장하지 않습니다.")
    @PostMapping("/{id}/collect")
    @PreAuthorize("hasAnyRole('ACCOUNTING', 'ADMIN')")
    public ResponseEntity<ReceivableDto.CollectionResult> collect(@PathVariable Long id,
            @Valid @RequestBody ReceivableDto.CollectionRequest input) {
        if (id <= 0) throw MasterListQuery.invalid("미수금 ID는 양수여야 합니다.");
        return ResponseEntity.ok(collectionService.collect(id, input));
    }
}
