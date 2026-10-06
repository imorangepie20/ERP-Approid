import type { components } from './generated/core'
import type { HttpClient } from './http'
import { ApiError } from './http'
import { invalidMasterResponse, normalizeMasterPage, type MasterPage } from './masterPage'
import { validReminderRecipient } from './receivables'

export const messagePermissions = ['PENDING', 'ALLOWED', 'BLOCKED'] as const
export const messageStates = ['QUEUED', 'CLAIMED', 'DISPATCHING', 'RETRY_WAIT', 'SMTP_ACCEPTED', 'FAILED', 'STALE', 'UNKNOWN'] as const
export type MessageContact = Required<components['schemas']['MessageContactResponse']>
export type MessageContactInput = Omit<components['schemas']['MessageContactRequest'], 'expectedVersion'> & { expectedVersion?: number | null }
export type MessageRow = Omit<Required<components['schemas']['MessageResponse']>, 'attempts'> & { attempts: MessageAttemptRow[] }
export type MessageAttemptRow = Required<components['schemas']['MessageAttemptResponse']>
export type MessageSummaryRow = Required<components['schemas']['MessageSummary']>
export interface MessageResult { message: MessageRow; replayed: boolean }

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const integer = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const id = (v: unknown) => integer(v) && Number(v) > 0
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const instant = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v))
const nullableInstant = (v: unknown) => v === null || instant(v)
function invalidInput(message: string): never {
    throw new ApiError({ status: 400, code: 'INVALID_INPUT', message })
}

function contact(v: unknown, status: number, trace?: string): MessageContact {
    if (!object(v) || !id(v.id) || !id(v.partnerId) || !integer(v.version)
        || typeof v.email !== 'string' || !validReminderRecipient('EMAIL', v.email)
        || !messagePermissions.includes(v.permission as typeof messagePermissions[number])) return invalidMasterResponse(status, trace)
    return v as MessageContact
}

export async function fetchMessageContact(client: HttpClient, partnerId: number, signal?: AbortSignal): Promise<{ contact: MessageContact | null }> {
    if (!id(partnerId)) invalidInput('거래처 ID가 올바르지 않습니다.')
    const r = await client.get<unknown>(`partners/${partnerId}/message-contacts/receivable-reminder`, { signal }), d = r.data
    if (!object(d) || !('contact' in d)) return invalidMasterResponse(r.status, r.traceId)
    if (d.contact === null) return { contact: null }
    return { contact: contact(d.contact, r.status, r.traceId) }
}

export async function saveMessageContact(client: HttpClient, partnerId: number, input: MessageContactInput): Promise<{ contact: MessageContact; created: boolean }> {
    if (!id(partnerId) || !object(input) || typeof input.email !== 'string' || !validReminderRecipient('EMAIL', input.email)
        || !messagePermissions.includes(input.permission as typeof messagePermissions[number])
        || !(input.expectedVersion === null || input.expectedVersion === undefined || integer(input.expectedVersion))
        || typeof input.confirmationNote !== 'string' || input.confirmationNote.length > 256
        || (input.permission === 'ALLOWED' && (input.confirmationNote.trim().length === 0 || input.acknowledged !== true))
        || typeof input.acknowledged !== 'boolean') invalidInput('등록 연락처 입력이 올바르지 않습니다.')
    const r = await client.put<unknown>(`partners/${partnerId}/message-contacts/receivable-reminder`, input)
    if (!object(r.data)) return invalidMasterResponse(r.status, r.traceId)
    return { contact: contact((r.data as Record<string, unknown>).contact ?? r.data, r.status, r.traceId), created: r.status === 201 }
}

function attempt(v: unknown, status: number, trace?: string): MessageAttemptRow {
    if (!object(v) || !integer(v.attemptNumber) || Number(v.attemptNumber) < 1 || Number(v.attemptNumber) > 3
        || !instant(v.startedAt) || !nullableInstant(v.finishedAt)
        || !(['ACCEPTED', 'DEFINITELY_NOT_ACCEPTED_TRANSIENT', 'DEFINITELY_NOT_ACCEPTED_PERMANENT', 'UNKNOWN'].includes(v.outcome as string))
        || !(v.errorCode === null || typeof v.errorCode === 'string')) return invalidMasterResponse(status, trace)
    return v as MessageAttemptRow
}

function message(v: unknown, status: number, trace?: string): MessageRow {
    if (!object(v) || !uuid(v.id) || !id(v.receivableId) || !messageStates.includes(v.state as typeof messageStates[number])
        || !text(v.recipient) || !text(v.subject) || typeof v.body !== 'string' || !integer(v.remainingAmount)
        || !instant(v.requestedAt) || !instant(v.expiresAt) || !nullableInstant(v.nextAttemptAt)
        || !integer(v.attemptCount) || Number(v.attemptCount) > 3 || !nullableInstant(v.acceptedAt)
        || !(v.errorCode === null || typeof v.errorCode === 'string') || !Array.isArray(v.attempts)) return invalidMasterResponse(status, trace)
    const attempts = (v.attempts as unknown[]).map(a => attempt(a, status, trace))
    return { ...(v as object), attempts } as MessageRow
}

function summary(v: unknown, status: number, trace?: string): MessageSummaryRow {
    if (!object(v) || !uuid(v.id) || !id(v.receivableId) || !messageStates.includes(v.state as typeof messageStates[number])
        || !text(v.recipient) || !text(v.subject) || !integer(v.remainingAmount) || !instant(v.requestedAt)
        || !integer(v.attemptCount) || !nullableInstant(v.acceptedAt)
        || !(v.errorCode === null || typeof v.errorCode === 'string')) return invalidMasterResponse(status, trace)
    return v as MessageSummaryRow
}

function result(data: unknown, status: number, trace?: string): MessageResult {
    if (!object(data) || typeof data.replayed !== 'boolean') return invalidMasterResponse(status, trace)
    return { message: message(data.message, status, trace), replayed: data.replayed }
}

export async function requestMessageReminder(client: HttpClient, receivableId: number, input: components['schemas']['ReminderRequest']): Promise<MessageResult> {
    if (!id(receivableId) || !object(input) || !uuid(input.requestId) || !id(input.contactId)
        || typeof input.expectedSnapshotHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.expectedSnapshotHash)
        || typeof input.note !== 'string' || input.note.length > 1000 || input.acknowledged !== true) invalidInput('발송 요청 입력이 올바르지 않습니다.')
    const r = await client.post<unknown>(`receivables/${receivableId}/reminders`, input)
    return result(r.data, r.status, r.traceId)
}

export async function fetchMessageDetail(client: HttpClient, id: string, signal?: AbortSignal): Promise<MessageRow> {
    if (!uuid(id)) invalidInput('메시지 ID가 올바르지 않습니다.')
    const r = await client.get<unknown>(`messages/${id}`, { signal })
    const row = message(r.data, r.status, r.traceId)
    if (row.id.toLowerCase() !== id.toLowerCase()) return invalidMasterResponse(r.status, r.traceId)
    return row
}

export async function fetchReminderHistory(client: HttpClient, receivableId: number, page: number, signal?: AbortSignal): Promise<MasterPage<MessageSummaryRow>> {
    if (!id(receivableId) || !integer(page)) invalidInput('이력 조회 입력이 올바르지 않습니다.')
    const r = await client.get<unknown>(`receivables/${receivableId}/reminders?page=${page}&size=20`, { signal })
    return normalizeMasterPage(r.data, v => summary(v, r.status, r.traceId), r.status, r.traceId)
}

export async function retryMessage(client: HttpClient, id: string, retryRequestId: string): Promise<MessageResult> {
    if (!uuid(id) || !uuid(retryRequestId)) invalidInput('재시도 입력이 올바르지 않습니다.')
    const r = await client.post<unknown>(`messages/${id}/retry`, { retryRequestId })
    return result(r.data, r.status, r.traceId)
}
