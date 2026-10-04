import type { SalesAnalysisResult } from '../api/salesAnalysis'
export function salesAnalysisFixture(): SalesAnalysisResult {
    return { asOf: '2026-10-04T01:00:00Z', timeZone: 'Asia/Seoul', from: '2026-10-01', to: '2026-10-04', itemId: null, customerId: null,
        keyword: '', scope: 'ordered', sort: 'orderedAt,desc', page: 0, size: 20, totalElements: 1, totalPages: 1,
        summary: { periodOrders: 1, periodCancelledOrders: 0, periodOrderKrw: 1000, periodConfirmedShipments: 1, periodRevenueKrw: 400,
            currentBacklogOrders: 1, unknownBacklogOrders: 0, knownCurrentBacklogKrw: 600, currentOpenReceivables: 1,
            currentOpenReceivableKrw: 400, currentOverdueReceivables: 1, currentOverdueReceivableKrw: 400,
            excludedHistoricalShipments: 0, excludedUnlinkedReceivables: 0 },
        rows: [{ id: 42, salesOrderNo: 'SO-LIVE', customerId: 90, customerNo: 'C-LIVE', customerName: '실제 고객', itemId: 7, itemNo: 'P-LIVE', itemName: '실제 제품', unit: 'kg',
            qty: 10, amountKrw: 1000, orderedAt: '2026-10-02', dueDate: '2026-10-03', status: '생산중', knownShippedQty: 4,
            knownShippedAmountKrw: 400, periodRevenueKrw: 400, currentBacklogKrw: 600, currentOpenReceivableKrw: 400, currentOverdueReceivableKrw: 400,
            historyUnknown: false, delayed: true }],
        notes: ['기간은 수주일/실제 출하확정일입니다. 현재 잔고·미수는 기간 필터를 적용하지 않습니다.',
            '수납일·부분수납 이력이 없어 현재 미수 문서 원금만 표시합니다. 이력 미확인 잔고는 추정하지 않습니다.'] }
}
