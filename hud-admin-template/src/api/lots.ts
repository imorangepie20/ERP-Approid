import type { components } from './generated/core'
import type { HttpClient } from './http'
import { ApiError } from './http'
import { invalidMasterResponse } from './masterPage'

export type LotRow = Omit<Required<components['schemas']['LotResponse']>, 'expiry'> & { expiry: string | null }

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const id = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && (v as number) > 0
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const qty = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
function invalidInput(message: string): never {
    throw new ApiError({ status: 400, code: 'INVALID_INPUT', message })
}

export function lotRow(value: unknown, status: number, trace?: string): LotRow {
    if (!object(value) || !id(value.id) || !id(value.itemId)
        || ![value.lotNo, value.itemNo, value.itemName, value.warehouse].every(text)
        || !qty(value.qty) || !date(value.producedAt) || !(value.expiry === null || value.expiry === undefined || date(value.expiry))
        || typeof value.status !== 'string' || typeof value.expiringSoon !== 'boolean') {
        return invalidMasterResponse(status, trace)
    }
    return { ...value, expiry: (value.expiry as string | undefined) ?? null } as LotRow
}

export async function disposeLot(client: HttpClient, lotId: number): Promise<LotRow> {
    if (!id(lotId)) invalidInput('Lot ID가 올바르지 않습니다.')
    const r = await client.post<unknown>(`lots/${lotId}/dispose`, {})
    const row = lotRow(r.data, r.status, r.traceId)
    if (row.id !== lotId || row.status !== '폐기') return invalidMasterResponse(r.status, r.traceId)
    return row
}

async function transition(client: HttpClient, lotId: number, action: 'hold' | 'release', expected: string): Promise<LotRow> {
    if (!id(lotId)) invalidInput('Lot ID가 올바르지 않습니다.')
    const r = await client.post<unknown>(`lots/${lotId}/${action}`, {})
    const row = lotRow(r.data, r.status, r.traceId)
    if (row.id !== lotId || row.status !== expected) return invalidMasterResponse(r.status, r.traceId)
    return row
}

export async function holdLot(client: HttpClient, lotId: number): Promise<LotRow> {
    return transition(client, lotId, 'hold', '보류')
}

export async function releaseLot(client: HttpClient, lotId: number): Promise<LotRow> {
    return transition(client, lotId, 'release', '정상')
}
