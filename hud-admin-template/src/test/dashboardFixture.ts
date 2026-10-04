import type { DashboardData } from '../api/dashboard'

export function dashboardFixture(): DashboardData {
    return {
        metadata: { asOf: '2026-10-04T01:00:00Z', timeZone: 'Asia/Seoul', from: '2026-10-01', to: '2026-10-04', itemId: null, snapshotScope: '현재 스냅샷' },
        kpis: { revenueKrw: 1400, productionValueKrw: 900, backlogKrw: 1600, backlogOrders: 2,
            onTimeDeliveryPercent: 50, onTimeOrders: 1, eligibleDeliveryOrders: 2,
            meanOrderDefectPercent: 35, completedWorkOrders: 2, inventoryTurnover: null, inventoryTurnoverReason: '원가·평균재고 이력 없음' },
        trends: [{ month: '2026-10', revenueKrw: 1400, productionValueKrw: 900 }],
        alerts: { lowStockItems: 1, overdueWorkOrders: 0, overdueSalesOrders: 0, total: 1, truncated: false,
            rows: [{ kind: 'LOW_STOCK', referenceNo: 'P-LIVE', itemName: '실제 제품', message: '현재고 0 / 안전재고 5 EA', path: '/items' }] },
        coverage: { undatedShipments: 1, undatedCompletedWorkOrders: 1, unknownDeliveryOrders: 1, notes: ['실제 출하확정 금액 합계', '오더별 불량률 단순 평균'] },
    }
}
