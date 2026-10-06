import type { components } from './generated/core'
import type { HttpClient } from './http'
import { ApiError } from './http'
import { invalidMasterResponse } from './masterPage'

export type StockAdjustment = Required<components['schemas']['InventoryAdjustResponse']>
export type StockAdjustmentInput = components['schemas']['InventoryAdjustRequest']

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const id = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && (v as number) > 0
const qty = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
function invalidInput(message: string): never {
    throw new ApiError({ status: 400, code: 'INVALID_INPUT', message })
}

export function stockAdjustment(value: unknown, status: number, trace?: string): StockAdjustment {
    if (!object(value) || !id(value.itemId) || ![value.itemNo, value.itemName, value.txnNo].every(text)
        || ![value.previousStock, value.ledgerBalance, value.countedQty, value.adjustedQty].every(qty)
        || (value.countedQty as number) < 0 || value.txnType !== '실사' || !date(value.txnDate)) {
        return invalidMasterResponse(status, trace)
    }
    return value as StockAdjustment
}

function adjustInput(value: unknown): asserts value is StockAdjustmentInput {
    if (!object(value) || !id(value.itemId)
        || typeof value.countedQty !== 'number' || !Number.isFinite(value.countedQty) || value.countedQty < 0
        || !text(value.warehouse) || (value.warehouse as string).trim().length > 32
        || !text(value.reason) || (value.reason as string).length > 200) invalidInput('실사 조정 입력이 올바르지 않습니다.')
}

export async function adjustStock(client: HttpClient, input: StockAdjustmentInput): Promise<StockAdjustment> {
    adjustInput(input)
    const r = await client.post<unknown>('inventory/adjustments', input)
    return stockAdjustment(r.data, r.status, r.traceId)
}
