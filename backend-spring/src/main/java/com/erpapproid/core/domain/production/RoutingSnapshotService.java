package com.erpapproid.core.domain.production;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import com.erpapproid.core.domain.routing.RoutingRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RoutingSnapshotService {
    private final RoutingRepository routings;

    @Transactional(propagation = Propagation.MANDATORY)
    public List<RoutingStepSnapshot> capture(Long itemId) {
        return routings.findByItemIdOrderBySeqAsc(itemId).stream().map(r -> new RoutingStepSnapshot(
                r.getId(), r.getRoutingNo(), r.getSeq(), r.getProcess(), r.getWorkCenter(),
                r.getStdTime(), r.getIsSubcontract())).toList();
    }
}
