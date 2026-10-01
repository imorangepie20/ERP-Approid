import type { ApiResult, ErrorResponse, FieldError } from './types'
import { normalizeApiBaseUrl } from './config'

const DEFAULT_ERROR_MESSAGE = '요청을 처리하지 못했습니다.'
const SERVER_ERROR_MESSAGE = '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
const INVALID_RESPONSE_MESSAGE = '서버 응답 형식이 올바르지 않습니다.'

const statusMessages: Record<number, string> = {
    401: '로그인이 필요합니다.',
    403: '요청을 수행할 권한이 없습니다.',
    404: '요청한 정보를 찾을 수 없습니다.',
    409: '현재 상태와 충돌하여 요청을 처리할 수 없습니다.',
    422: '입력값을 확인해 주세요.',
}

export interface ApiErrorOptions {
    status: number
    code: string
    message: string
    traceId?: string
    errors?: FieldError[]
    cause?: unknown
}

export class ApiError extends Error {
    readonly status: number
    readonly code: string
    readonly traceId?: string
    readonly errors?: FieldError[]
    readonly cause?: unknown

    constructor(options: ApiErrorOptions) {
        super(options.message)
        this.name = 'ApiError'
        this.status = options.status
        this.code = options.code
        this.traceId = options.traceId
        this.errors = options.errors
        this.cause = options.cause
    }
}

export interface HttpClientOptions {
    baseUrl: string
    getAccessToken?: () => string | null | undefined
    onUnauthorized?: (error: ApiError) => void | Promise<void>
    fetch?: typeof globalThis.fetch
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
    body?: unknown
}

export interface HttpClient {
    request<T>(method: string, path: string, options?: ApiRequestOptions): Promise<ApiResult<T>>
    get<T>(path: string, options?: ApiRequestOptions): Promise<ApiResult<T>>
    post<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<ApiResult<T>>
    put<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<ApiResult<T>>
    patch<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<ApiResult<T>>
    delete<T = undefined>(path: string, options?: ApiRequestOptions): Promise<ApiResult<T>>
}

function normalizeBaseUrl(value: string): URL {
    const url = new URL(normalizeApiBaseUrl(value))
    url.pathname = `${url.pathname.replace(/\/$/, '')}/`
    return url
}

function resolveRequestUrl(baseUrl: URL, path: string): string {
    if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//')) {
        throw new ApiError({
            status: 0,
            code: 'INVALID_REQUEST_PATH',
            message: 'API 요청 경로에는 절대 URL을 사용할 수 없습니다.',
        })
    }

    const resolved = new URL(path.replace(/^\/+/, ''), baseUrl)
    if (resolved.origin !== baseUrl.origin || !resolved.pathname.startsWith(baseUrl.pathname)) {
        throw new ApiError({
            status: 0,
            code: 'INVALID_REQUEST_PATH',
            message: 'API 요청 경로가 설정된 base URL을 벗어났습니다.',
        })
    }
    return resolved.toString()
}

function isErrorResponse(value: unknown): value is ErrorResponse {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<ErrorResponse>
    return typeof candidate.code === 'string' && typeof candidate.message === 'string'
}

interface ParsedBody {
    payload?: unknown
    invalidJson?: boolean
}

async function readBody(response: Response): Promise<ParsedBody> {
    if (response.status === 204 || response.status === 205) return {}

    const text = await response.text()
    if (text === '') return {}
    if (response.headers.get('content-type')?.includes('json')) {
        try {
            return { payload: JSON.parse(text) }
        } catch {
            return { invalidJson: true }
        }
    }
    return { payload: text }
}

function sanitizeTraceId(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) ? value : undefined
}

function serializeBody(body: unknown, headers: Headers): BodyInit | undefined {
    if (body === undefined || body === null) return undefined
    if (
        typeof body === 'string'
        || body instanceof Blob
        || body instanceof FormData
        || body instanceof URLSearchParams
        || body instanceof ArrayBuffer
    ) return body

    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    return JSON.stringify(body)
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
    const baseUrl = normalizeBaseUrl(options.baseUrl)
    const fetchImpl = options.fetch ?? globalThis.fetch

    async function request<T>(method: string, path: string, requestOptions: ApiRequestOptions = {}): Promise<ApiResult<T>> {
        const url = resolveRequestUrl(baseUrl, path)
        const headers = new Headers(requestOptions.headers)
        if (!headers.has('Accept')) headers.set('Accept', 'application/json')

        const accessToken = options.getAccessToken?.()
        if (accessToken && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${accessToken}`)
        }

        const { body: inputBody, ...init } = requestOptions
        const body = serializeBody(inputBody, headers)
        let response: Response
        try {
            response = await fetchImpl(url, { ...init, method, headers, body })
        } catch (cause) {
            throw new ApiError({
                status: 0,
                code: 'NETWORK_ERROR',
                message: '서버에 연결할 수 없습니다.',
                cause,
            })
        }

        const responseTraceId = sanitizeTraceId(response.headers.get('X-Trace-Id'))
        let parsedBody: ParsedBody
        try {
            parsedBody = await readBody(response)
        } catch (cause) {
            if (cause instanceof ApiError) throw cause
            throw new ApiError({
                status: 0,
                code: 'NETWORK_ERROR',
                message: '서버에 연결할 수 없습니다.',
                cause,
            })
        }
        const { payload, invalidJson } = parsedBody
        if (response.ok && invalidJson) {
            throw new ApiError({
                status: response.status,
                code: 'INVALID_RESPONSE',
                message: INVALID_RESPONSE_MESSAGE,
                traceId: responseTraceId,
            })
        }
        if (!response.ok) {
            const springError = !invalidJson && isErrorResponse(payload) ? payload : undefined
            const error = new ApiError({
                status: response.status,
                code: springError?.code ?? `HTTP_${response.status}`,
                message: response.status >= 500
                    ? SERVER_ERROR_MESSAGE
                    : springError?.message ?? statusMessages[response.status] ?? DEFAULT_ERROR_MESSAGE,
                traceId: sanitizeTraceId(springError?.traceId) ?? responseTraceId,
                errors: springError?.errors,
            })
            if (response.status === 401 && options.onUnauthorized) {
                try {
                    const callbackResult = options.onUnauthorized(error)
                    if (callbackResult) void callbackResult.catch(() => undefined)
                } catch {
                    // Session cleanup failures must never replace the API contract error.
                }
            }
            throw error
        }

        return {
            data: payload as T,
            status: response.status,
            ...(responseTraceId ? { traceId: responseTraceId } : {}),
        }
    }

    return {
        request,
        get: (path, requestOptions) => request('GET', path, requestOptions),
        post: (path, body, requestOptions) => request('POST', path, { ...requestOptions, body }),
        put: (path, body, requestOptions) => request('PUT', path, { ...requestOptions, body }),
        patch: (path, body, requestOptions) => request('PATCH', path, { ...requestOptions, body }),
        delete: (path, requestOptions) => request('DELETE', path, requestOptions),
    }
}
