import type { components } from './generated/core'
import type { HttpClient } from './http'
import { invalidMasterResponse, normalizeMasterPage } from './masterPage'

export const receivableStatuses = ['미수', '수납완료', '연체'] as const
export type ReceivableRow = Omit<Required<components['schemas']['ReceivableResponse']>, 'salesOrderId' | 'salesOrderNo'> & {
    salesOrderId: number | null; salesOrderNo: string | null
}
export type ReceivableSummary = Required<components['schemas']['ReceivableSummary']>
export type CollectionInput = components['schemas']['ReceivableCollectionRequest']
export type CollectionRow = Required<components['schemas']['ReceivableCollectionResponse']>
export type ReceivableDetail = Omit<Required<components['schemas']['ReceivableDetail']>, 'receivable' | 'collections'> & {
    receivable: ReceivableRow; collections: import('./masterPage').MasterPage<CollectionRow>
}
export type CollectionResult = Omit<Required<components['schemas']['ReceivableCollectionResult']>, 'receivable' | 'collection'> & {
    receivable: ReceivableRow; collection: CollectionRow
}
export type ReminderPreview = Omit<Required<components['schemas']['ReceivableReminderPreview']>, 'receivable' | 'contactName' | 'contact'> & {
    receivable: ReceivableRow; contactName: string | null; contact: string | null
}
export type ReminderChannel = 'EMAIL' | 'SMS'
export function validReminderRecipient(channel: ReminderChannel, value: string): boolean {
    const recipient = value.trim()
    if (channel === 'EMAIL') return recipient.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)
    if (channel === 'SMS') return /^01[016789]\d{7,8}$/.test(recipient.replace(/[ -]/g, ''))
    return false
}
export interface ReceivableFilters { customerId?: number; status: string; overdue: string; keyword: string; page: number; size: number; sort: string }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const integer = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const id = (v: unknown) => integer(v) && Number(v) > 0
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
    && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v

function row(v: unknown, status: number, trace?: string): ReceivableRow {
    if (!object(v) || ![v.id, v.customerId].every(id) || ![v.receivableNo, v.customerName].every(text)
        || ![v.amount, v.collectedAmount, v.openingCollectedAmount, v.remainingAmount, v.overdueDays].every(integer) || !date(v.dueDate) || !date(v.referenceDate)
        || !receivableStatuses.includes(v.status as typeof receivableStatuses[number]) || typeof v.overdue !== 'boolean'
        || (v.salesOrderId === null ? v.salesOrderNo !== null : !id(v.salesOrderId) || !text(v.salesOrderNo))) return invalidMasterResponse(status, trace)
    if (Number(v.collectedAmount) > Number(v.amount) || Number(v.openingCollectedAmount) > Number(v.collectedAmount)
        || v.remainingAmount !== Number(v.amount) - Number(v.collectedAmount) || (v.status === '수납완료' && v.remainingAmount !== 0)) return invalidMasterResponse(status, trace)
    const days = v.status === '수납완료' || v.remainingAmount === 0 ? 0 : Math.max(0, Math.round((Date.parse(`${v.referenceDate}T00:00:00Z`) - Date.parse(`${v.dueDate}T00:00:00Z`)) / 86400000))
    if (v.overdueDays !== days || v.overdue !== (days > 0)) return invalidMasterResponse(status, trace)
    return v as ReceivableRow
}

export async function fetchReceivablePage(client: HttpClient, filters: ReceivableFilters, signal?: AbortSignal) {
    const query = new URLSearchParams({ keyword: filters.keyword, status: filters.status, page: String(filters.page), size: String(filters.size), sort: filters.sort })
    if (filters.customerId) query.set('customerId', String(filters.customerId))
    if (filters.overdue) query.set('overdue', filters.overdue)
    const r = await client.get<unknown>(`receivables?${query}`, { signal })
    return normalizeMasterPage(r.data, v => row(v, r.status, r.traceId), r.status, r.traceId)
}

export async function fetchReceivableSummary(client: HttpClient, signal?: AbortSignal): Promise<ReceivableSummary> {
    const r = await client.get<unknown>('receivables/summary', { signal }), d = r.data
    if (!object(d) || ![d.openCount, d.openAmount, d.overdueCount, d.overdueAmount, d.openBalance, d.overdueBalance].every(integer)
        || !date(d.referenceDate) || Number(d.overdueCount) > Number(d.openCount) || Number(d.overdueAmount) > Number(d.openAmount)
        || Number(d.openBalance) > Number(d.openAmount) || Number(d.overdueBalance) > Number(d.overdueAmount) || Number(d.overdueBalance) > Number(d.openBalance)) return invalidMasterResponse(r.status, r.traceId)
    return d as ReceivableSummary
}

const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
export function validCollectionInput(v: unknown): v is CollectionInput {
    return object(v) && id(v.amount) && date(v.collectedOn) && uuid(v.requestId)
}
function collection(v: unknown, status: number, trace?: string): CollectionRow {
    if (!object(v) || ![v.id, v.actorId, v.amount].every(id) || !integer(v.remainingAmount) || !uuid(v.requestId) || !date(v.collectedOn)
        || !text(v.traceId) || !text(v.recordedAt) || !Number.isFinite(Date.parse(String(v.recordedAt)))) return invalidMasterResponse(status, trace)
    return v as unknown as CollectionRow
}
export async function fetchReceivableDetail(client: HttpClient, id: number, page: number, signal?: AbortSignal): Promise<ReceivableDetail> {
    const r = await client.get<unknown>(`receivables/${id}?page=${page}&size=20`, { signal }), d = r.data
    if (!object(d)) return invalidMasterResponse(r.status, r.traceId)
    const receivable = row(d.receivable, r.status, r.traceId)
    if (receivable.id !== id) return invalidMasterResponse(r.status, r.traceId)
    const collections = normalizeMasterPage(d.collections, v => collection(v, r.status, r.traceId), r.status, r.traceId)
    if (collections.rows.some(c => c.amount > receivable.amount || c.remainingAmount > receivable.amount - c.amount || c.remainingAmount < receivable.remainingAmount)
        || collections.rows.reduce((sum, c) => sum + BigInt(c.amount), 0n) > BigInt(receivable.collectedAmount - receivable.openingCollectedAmount)) return invalidMasterResponse(r.status, r.traceId)
    return { receivable, collections }
}
export async function collectReceivable(client: HttpClient, id: number, input: CollectionInput): Promise<CollectionResult> {
    const r = await client.post<unknown>(`receivables/${id}/collect`, input), d = r.data
    if (!object(d) || typeof d.replayed !== 'boolean') return invalidMasterResponse(r.status, r.traceId)
    const receivable = row(d.receivable, r.status, r.traceId), payment = collection(d.collection, r.status, r.traceId)
    if (receivable.id !== id || payment.amount !== input.amount || payment.collectedOn !== input.collectedOn || payment.requestId !== input.requestId
        || payment.amount > receivable.collectedAmount - receivable.openingCollectedAmount || payment.remainingAmount < receivable.remainingAmount
        || payment.remainingAmount > receivable.amount - payment.amount || (!d.replayed && payment.remainingAmount !== receivable.remainingAmount)) return invalidMasterResponse(r.status, r.traceId)
    return { receivable, collection: payment, replayed: d.replayed }
}

export async function fetchReminderPreview(client: HttpClient, id: number, signal?: AbortSignal): Promise<ReminderPreview> {
    const r = await client.get<unknown>(`receivables/${id}/reminder-preview`, { signal }), d = r.data
    if (!object(d) || ![d.contactName, d.contact].every(v => v === null || typeof v === 'string')) return invalidMasterResponse(r.status, r.traceId)
    const receivable = row(d.receivable, r.status, r.traceId)
    if (receivable.id !== id) return invalidMasterResponse(r.status, r.traceId)
    return { receivable, contactName: d.contactName as string | null, contact: d.contact as string | null }
}
