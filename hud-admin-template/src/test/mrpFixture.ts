import type { MrpResult, MrpPurchase } from '../api/mrp'

export function mrpFixture(): MrpResult {
    return { asOf: '2026-10-04T01:00:00Z', timeZone: 'Asia/Seoul', through: '2027-01-02', itemId: null,
        page: 0, size: 50, totalElements: 1, totalPages: 1, activeWorkOrders: 2,
        purchaseNeededItems: 1, productionNeededItems: 1, missingBomItems: 0,
        rows: [{ itemId: 7, itemNo: 'M-LIVE', itemName: '실제 자재', itemType: '자재', unit: 'kg', price: 100,
            grossRequirement: 63.55, onHand: 10, usableStock: 8, safetyStock: 2, onOrder: 6,
            scheduledProduction: 0, lateSupplyQty: 6, netRequirement: 51.55, suggestedPurchaseQty: 51.55,
            suggestedProductionQty: 0, leadTimeDays: 4, requiredBy: '2026-10-07', orderBy: '2026-10-03', urgent: true, action: 'PURCHASE' }],
        notes: ['구성품 불출 이력이 없어 전체 활성 오더를 계획 소요량으로 사용합니다.', '손실률은 추가 소요율이며 품목 기본단위 기준입니다.'] }
}
export function mrpPurchaseFixture(): MrpPurchase {
    return { id: 10, purchaseOrderNo: 'PO-MRP-LIVE', vendorId: 8, vendorName: '실제 공급사', itemId: 7,
        itemNo: 'M-LIVE', itemName: '실제 자재', qty: 51.55, unitPrice: 100, amount: 5155, dueDate: '2026-10-20', status: '발주', receivedQty: 0 }
}
