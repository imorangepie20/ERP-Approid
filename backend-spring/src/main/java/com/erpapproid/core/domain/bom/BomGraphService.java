package com.erpapproid.core.domain.bom;

import java.util.ArrayDeque;
import java.util.HashSet;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import com.erpapproid.core.common.exception.DomainException;
import com.erpapproid.core.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class BomGraphService {
    private final JdbcTemplate jdbc;
    private final BomRepository boms;

    // Serialize graph writes across API instances, so concurrent A→B / B→A cannot both pass.
    @Transactional(propagation = Propagation.MANDATORY)
    public void validateEdge(Long parent, Long child) {
        jdbc.query("select pg_advisory_xact_lock(73003)", rs -> { return null; });
        var pending = new ArrayDeque<Long>();
        var visited = new HashSet<Long>();
        pending.add(child);
        while (!pending.isEmpty()) {
            Long current = pending.removeFirst();
            if (current.equals(parent)) {
                throw new DomainException(ErrorCode.BOM_CYCLE, "순환 참조가 발생하는 BOM은 등록할 수 없습니다.");
            }
            if (visited.add(current)) {
                boms.findByParentId(current).forEach(edge -> pending.add(edge.getChild().getId()));
            }
        }
    }
}
