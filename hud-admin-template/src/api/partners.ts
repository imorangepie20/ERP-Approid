import type { components } from './generated/core'
import { ApiError, type HttpClient } from './http'

export const partnerTypes = ['고객사', '발주처', '외주처'] as const
export type PartnerType = typeof partnerTypes[number]
export type PartnerSort = 'partnerNo' | 'name' | 'partnerType' | 'contactName' | 'contact' | 'paymentTerms' | 'leadTimeDays'
export interface PartnerRow {
    id: number
    partnerNo: string
    name: string
    partnerType: PartnerType
    contactName: string
    contact: string
    paymentTerms: number
    leadTimeDays: number
}
export type CreatePartnerInput = Omit<components['schemas']['PartnerCreateRequest'], 'partnerType'> & { partnerType: PartnerType }
export type UpdatePartnerInput = Omit<components['schemas']['PartnerUpdateRequest'], 'partnerType'> & { partnerType?: PartnerType }
export interface PartnerListParams {
    page: number
    size: number
    keyword?: string
    partnerType?: PartnerType
    sortColumn?: PartnerSort
    sortDirection?: 'asc' | 'desc'
}
export interface PartnerPage {
    partners: PartnerRow[]
    page: number
    totalElements: number
    totalPages: number
}

function invalid(status: number, traceId?: string) {
    return new ApiError({ status, traceId, code: 'INVALID_RESPONSE', message: '거래처 응답 형식이 올바르지 않습니다.' })
}

function nonnegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function normalizePartner(value: unknown, status: number, traceId?: string): PartnerRow {
    if (!value || typeof value !== 'object') throw invalid(status, traceId)
    const row = value as Partial<components['schemas']['PartnerResponse']>
    if (!nonnegativeInteger(row.id) || row.id === 0
        || typeof row.partnerNo !== 'string' || !row.partnerNo.trim()
        || typeof row.name !== 'string' || !row.name.trim()
        || !partnerTypes.includes(row.partnerType as PartnerType)
        || (row.contact != null && typeof row.contact !== 'string')
        || (row.contactName != null && typeof row.contactName !== 'string')
        || !nonnegativeInteger(row.paymentTerms) || !nonnegativeInteger(row.leadTimeDays)) {
        throw invalid(status, traceId)
    }
    return { id: row.id, partnerNo: row.partnerNo, name: row.name, partnerType: row.partnerType as PartnerType,
        contactName: row.contactName ?? '', contact: row.contact ?? '', paymentTerms: row.paymentTerms, leadTimeDays: row.leadTimeDays }
}

export async function fetchPartnerPage(client: HttpClient, params: PartnerListParams, signal?: AbortSignal): Promise<PartnerPage> {
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size),
        sort: `${params.sortColumn ?? 'partnerNo'},${params.sortDirection ?? 'asc'}` })
    if (params.keyword?.trim()) query.set('keyword', params.keyword.trim())
    if (params.partnerType) query.set('partnerType', params.partnerType)
    const result = await client.get<components['schemas']['PagePartnerResponse']>(`partners?${query}`, { signal })
    const page = result.data
    if (!page || !Array.isArray(page.content) || !nonnegativeInteger(page.number)
        || !nonnegativeInteger(page.size) || page.size === 0 || page.content.length > page.size
        || !nonnegativeInteger(page.totalElements) || !nonnegativeInteger(page.totalPages)
        || (page.content.length > 0 && page.number >= page.totalPages)) throw invalid(result.status, result.traceId)
    return { partners: page.content.map(row => normalizePartner(row, result.status, result.traceId)),
        page: page.number, totalElements: page.totalElements, totalPages: page.totalPages }
}

export async function fetchPartnerOptions(client: HttpClient, partnerType: PartnerType, signal?: AbortSignal): Promise<PartnerRow[]> {
    const rows: PartnerRow[] = []
    let page = 0
    let totalPages = 1
    while (page < totalPages) {
        const result = await fetchPartnerPage(client, { partnerType, page, size: 100 }, signal)
        rows.push(...result.partners)
        totalPages = result.totalPages
        if (totalPages > 10001) throw invalid(200)
        page++
    }
    return rows
}

function validateId(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError({ status: 0, code: 'INVALID_PARTNER_ID', message: '거래처 ID가 올바르지 않습니다.' })
}

export async function createPartner(client: HttpClient, input: CreatePartnerInput): Promise<PartnerRow> {
    const result = await client.post('partners', input)
    return normalizePartner(result.data, result.status, result.traceId)
}

export async function updatePartner(client: HttpClient, id: number, input: UpdatePartnerInput): Promise<PartnerRow> {
    validateId(id)
    const result = await client.patch(`partners/${id}`, input)
    return normalizePartner(result.data, result.status, result.traceId)
}

export async function deletePartner(client: HttpClient, id: number) {
    validateId(id)
    await client.delete(`partners/${id}`)
}
