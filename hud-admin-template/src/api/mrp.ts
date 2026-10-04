import type { components } from './generated/core'
import type { HttpClient } from './http'
import { invalidMasterResponse } from './masterPage'

export type MrpRow = Required<components['schemas']['MrpRow']>
export type MrpResult = Omit<Required<components['schemas']['MrpResponse']>, 'rows' | 'itemId'> & { rows: MrpRow[]; itemId: number | null }
export type MrpPurchaseInput = components['schemas']['PurchaseOrderRequest']
export type MrpPurchase = Required<components['schemas']['PurchaseOrderResponse']>
export interface MrpFilters { through: string; itemId?: number; page: number; size: number }
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const id = (v: unknown) => count(v) && (v as number) > 0
const qty = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e14
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
export async function fetchMrp(client: HttpClient, filters: MrpFilters, signal?: AbortSignal): Promise<MrpResult> {
    const query = new URLSearchParams({ through: filters.through, page: String(filters.page), size: String(filters.size) })
    if (filters.itemId) query.set('itemId', String(filters.itemId))
    const r = await client.get<unknown>(`analytics/mrp/suggestions?${query}`, { signal }), d = r.data
    const fail = () => invalidMasterResponse(r.status, r.traceId)
    if (!obj(d) || !text(d.asOf) || !Number.isFinite(Date.parse(String(d.asOf))) || d.timeZone !== 'Asia/Seoul' || !date(d.through)
        || !(d.itemId === null || id(d.itemId)) || ![d.page, d.size, d.totalElements, d.totalPages, d.activeWorkOrders,
            d.purchaseNeededItems, d.productionNeededItems, d.missingBomItems].every(count)
        || (d.size as number) < 1 || (d.size as number) > 100 || !Array.isArray(d.rows) || d.rows.length > (d.size as number)
        || d.totalPages !== Math.ceil((d.totalElements as number) / (d.size as number))
        || !Array.isArray(d.notes) || d.notes.length === 0 || !d.notes.every(text)) return fail()
    for (const row of d.rows) {
        if (!obj(row) || !id(row.itemId) || ![row.itemNo, row.itemName, row.unit].every(text)
            || !['제품', '반제품', '자재'].includes(String(row.itemType)) || !count(row.price) || !count(row.leadTimeDays)
            || ![row.grossRequirement, row.onHand, row.usableStock, row.safetyStock, row.onOrder, row.scheduledProduction,
                row.lateSupplyQty, row.netRequirement, row.suggestedPurchaseQty, row.suggestedProductionQty].every(qty)
            || !date(row.requiredBy) || !date(row.orderBy) || typeof row.urgent !== 'boolean'
            || !['PURCHASE', 'PRODUCE', 'MISSING_BOM', 'EXPEDITE', 'COVERED'].includes(String(row.action))
            || (row.usableStock as number) > (row.onHand as number)
            || (row.itemType !== '자재' && row.suggestedPurchaseQty !== 0)
            || (row.itemType === '자재' && row.suggestedProductionQty !== 0)) return fail()
    }
    return d as MrpResult
}
export async function createMrpPurchase(client: HttpClient, input: MrpPurchaseInput): Promise<MrpPurchase> {
    const r = await client.post<unknown>('purchase-orders', input), p = r.data
    if (!obj(p) || ![p.id, p.vendorId, p.itemId].every(id) || ![p.purchaseOrderNo, p.vendorName, p.itemNo, p.itemName].every(text)
        || !qty(p.qty) || (p.qty as number) <= 0 || !qty(p.receivedQty) || !count(p.unitPrice) || !count(p.amount)
        || !date(p.dueDate) || p.status !== '발주') return invalidMasterResponse(r.status, r.traceId)
    return p as MrpPurchase
}
export function addDateDays(dateOnly: string, days: number): string {
    const date = new Date(`${dateOnly}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10)
}
