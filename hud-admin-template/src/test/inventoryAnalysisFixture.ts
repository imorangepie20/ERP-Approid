import type { InventoryAnalysisResult } from '../api/inventoryAnalysis'
export function inventoryAnalysisFixture(): InventoryAnalysisResult {
    return { asOf: '2026-10-04T01:00:00Z', timeZone: 'Asia/Seoul', from: '2026-10-01', to: '2026-10-04', ageDays: 90,
        itemId: null, itemType: 'all', risk: 'all', keyword: '', sort: 'itemNo,asc', page: 0, size: 20, totalElements: 1, totalPages: 1,
        summary: { totalItems: 1, lowStockItems: 1, ledgerMismatchItems: 1, lotMismatchItems: 1, agedItems: 1,
            heldItems: 1, expiredItems: 1, invalidLots: 0, futureTransactions: 0, inventoryTurnover: null },
        rows: [{ itemId: 7, itemNo: 'M-LIVE', itemName: '실제 자재', itemType: '자재', unit: 'kg', currentStock: 30, safetyStock: 40,
            ledgerBalance: 28, stockLedgerDelta: 2, recordedLotQty: 25, knownUsableLotQty: 10, heldLotQty: 7, expiredLotQty: 3, agedLotQty: 20,
            periodIncreaseQty: 10, periodDecreaseQty: 5, periodNetQty: 5, lotCount: 4, invalidLots: 0, futureTransactions: 0,
            lowStock: true, ledgerMismatch: true, lotMismatch: true }],
        notes: ['현재고·Lot에는 기간 필터 미적용. 장기는 제조·입고일 경과이며 무출고 기간을 추정하지 않습니다.',
            '원가·평균재고 이력이 없어 재고회전율은 계산 불가. 현재고 차이는 자동 보정하지 않습니다.'] }
}
