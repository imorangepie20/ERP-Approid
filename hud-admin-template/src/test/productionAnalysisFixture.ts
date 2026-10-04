import type { ProductionAnalysisResult } from '../api/productionAnalysis'
export function productionAnalysisFixture(): ProductionAnalysisResult {
    return { asOf: '2026-10-04T01:00:00Z', timeZone: 'Asia/Seoul', from: '2026-09-04', to: '2026-11-03',
        itemId: null, status: 'active', keyword: '', sort: 'dueDate,asc', page: 0, size: 20, totalElements: 1, totalPages: 1,
        summary: { totalOrders: 1, activeOrders: 1, completedOrders: 0, cancelledOrders: 0, delayedOrders: 1, unassignedActiveOrders: 1,
            overActualOrders: 0, eligibleActiveOrders: 1, meanActiveProgressPercent: 50, eligibleYieldOrders: 1, meanReportedYieldPercent: 80 },
        rows: [{ id: 12, workOrderNo: 'WO-LIVE', itemId: 7, itemNo: 'P-LIVE', itemName: '실제 생산 품목', unit: 'kg',
            qty: 10, goodQty: 4, defectQty: 1, remainingQty: 5, progressPercent: 50, yieldPercent: 80, startDate: '2026-10-01', dueDate: '2026-10-03',
            status: '진행중', assignee: '', priority: 2, delayed: true, overActual: false }],
        notes: ['진척=(양품+불량)/지시수량. 서로 다른 품목 단위의 수량은 합산하지 않습니다.', '설비 가동률·실제 공정시간·원가 이력은 없어 제공하지 않습니다.'] }
}
