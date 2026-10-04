import type { components } from './generated/core'
import type { HttpClient } from './http'
import { invalidMasterResponse } from './masterPage'

export interface DashboardFilters { from: string; to: string; itemId?: number }
export function seoulToday(base = new Date()): string {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(base)
}
export type DashboardData = {
    metadata: Omit<Required<components['schemas']['DashboardMetadata']>, 'itemId'> & { itemId: number | null }
    kpis: Omit<Required<components['schemas']['DashboardKpis']>, 'onTimeDeliveryPercent' | 'meanOrderDefectPercent' | 'inventoryTurnover'> & {
        onTimeDeliveryPercent: number | null; meanOrderDefectPercent: number | null; inventoryTurnover: number | null
    }
    trends: Required<components['schemas']['DashboardTrend']>[]
    alerts: Omit<Required<components['schemas']['DashboardAlerts']>, 'rows'> & { rows: Required<components['schemas']['DashboardAlert']>[] }
    coverage: Required<components['schemas']['DashboardCoverage']>
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const rate = (v: unknown) => v === null || typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100
const paths = ['/items', '/production/orders', '/sales/orders']
export async function fetchDashboard(client: HttpClient, filters: DashboardFilters, signal?: AbortSignal): Promise<DashboardData> {
    const query = new URLSearchParams({ from: filters.from, to: filters.to })
    if (filters.itemId) query.set('itemId', String(filters.itemId))
    const r = await client.get<unknown>(`analytics/dashboard?${query}`, { signal })
    const fail = () => invalidMasterResponse(r.status, r.traceId)
    const d = r.data
    if (!object(d) || !object(d.metadata) || !object(d.kpis) || !object(d.alerts) || !object(d.coverage)) return fail()
    const m = d.metadata, k = d.kpis, a = d.alerts, c = d.coverage
    if (!date(m.from) || !date(m.to) || m.from > m.to || m.timeZone !== 'Asia/Seoul'
        || !text(m.asOf) || !Number.isFinite(Date.parse(String(m.asOf))) || !text(m.snapshotScope)
        || !(m.itemId === null || count(m.itemId) && (m.itemId as number) > 0)
        || ![k.revenueKrw, k.productionValueKrw, k.backlogKrw, k.backlogOrders, k.onTimeOrders, k.eligibleDeliveryOrders, k.completedWorkOrders].every(count)
        || !rate(k.onTimeDeliveryPercent) || !rate(k.meanOrderDefectPercent) || k.inventoryTurnover !== null || !text(k.inventoryTurnoverReason)
        || (k.onTimeOrders as number) > (k.eligibleDeliveryOrders as number)
        || ((k.eligibleDeliveryOrders === 0) !== (k.onTimeDeliveryPercent === null))
        || ((k.completedWorkOrders === 0) !== (k.meanOrderDefectPercent === null))
        || ![a.lowStockItems, a.overdueWorkOrders, a.overdueSalesOrders, a.total, c.undatedShipments, c.undatedCompletedWorkOrders, c.unknownDeliveryOrders].every(count)
        || a.total !== (a.lowStockItems as number) + (a.overdueWorkOrders as number) + (a.overdueSalesOrders as number)
        || !Array.isArray(a.rows) || a.rows.length !== Math.min(20, a.total as number) || a.truncated !== ((a.total as number) > 20)
        || !Array.isArray(c.notes) || c.notes.length === 0 || !c.notes.every(text)
        || !Array.isArray(d.trends) || d.trends.length === 0 || d.trends.length > 13) return fail()
    for (const row of a.rows) {
        if (!object(row) || ![row.referenceNo, row.itemName, row.message].every(text)
            || !['LOW_STOCK', 'OVERDUE_WORK_ORDER', 'OVERDUE_SALES_ORDER'].includes(String(row.kind)) || !paths.includes(String(row.path))) return fail()
    }
    const trends = d.trends
    for (let index = 0; index < trends.length; index++) {
        const row: unknown = trends[index]
        if (!object(row) || typeof row.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month)
            || ![row.revenueKrw, row.productionValueKrw].every(count)
            || row.month < m.from.slice(0, 7) || row.month > m.to.slice(0, 7)
            || index > 0 && String((trends[index - 1] as Record<string, unknown>).month) >= row.month) return fail()
    }
    if (trends.reduce((sum, t) => sum + (t as Record<string, number>).revenueKrw, 0) !== k.revenueKrw
        || trends.reduce((sum, t) => sum + (t as Record<string, number>).productionValueKrw, 0) !== k.productionValueKrw) return fail()
    return d as DashboardData
}
