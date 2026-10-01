import { describe, expect, it, vi } from 'vitest'

import { ApiError, createHttpClient } from './http'

describe('createHttpClient', () => {
    it('uses the fixed base URL, injects a bearer token and collects the trace ID', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
            JSON.stringify([{ id: 1 }]),
            { status: 200, headers: { 'Content-Type': 'application/json', 'X-Trace-Id': 'trace-ok' } },
        ))
        const client = createHttpClient({
            baseUrl: 'https://core.example.test/api/core',
            getAccessToken: () => 'token-value',
            fetch: fetchMock,
        })

        const result = await client.get<Array<{ id: number }>>('items?active=true')

        expect(result).toEqual({ data: [{ id: 1 }], status: 200, traceId: 'trace-ok' })
        expect(fetchMock).toHaveBeenCalledOnce()
        const [url, init] = fetchMock.mock.calls[0]
        const headers = new Headers(init?.headers)
        expect(url).toBe('https://core.example.test/api/core/items?active=true')
        expect(init?.method).toBe('GET')
        expect(headers.get('Accept')).toBe('application/json')
        expect(headers.get('Authorization')).toBe('Bearer token-value')
    })

    it('normalizes Spring ErrorResponse and invokes the unauthorized callback', async () => {
        const onUnauthorized = vi.fn()
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
            code: 'AUTH_UNAUTHORIZED',
            message: '로그인이 필요합니다.',
            timestamp: '2026-10-01T00:00:00Z',
            traceId: 'trace-error',
        }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
        const client = createHttpClient({
            baseUrl: 'https://core.example.test/api/core',
            onUnauthorized,
            fetch: fetchMock,
        })

        const request = client.get('items')

        await expect(request).rejects.toMatchObject({
            name: 'ApiError',
            status: 401,
            code: 'AUTH_UNAUTHORIZED',
            message: '로그인이 필요합니다.',
            traceId: 'trace-error',
        })
        expect(onUnauthorized).toHaveBeenCalledOnce()
    })

    it('passes the authentication generation captured when the request started to a late 401 callback', async () => {
        let resolveResponse!: (response: Response) => void
        const response = new Promise<Response>(resolve => { resolveResponse = resolve })
        const onUnauthorized = vi.fn()
        let generation = 7
        const client = createHttpClient({
            baseUrl: 'https://core.example.test/api/core',
            getAccessToken: () => 'token-a',
            getAuthGeneration: () => generation,
            onUnauthorized,
            fetch: vi.fn<typeof fetch>().mockReturnValue(response),
        })

        const request = client.get('items')
        generation = 8
        resolveResponse(new Response(JSON.stringify({
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
        }), { status: 401, headers: { 'Content-Type': 'application/json' } }))

        await expect(request).rejects.toMatchObject({ status: 401 })
        expect(onUnauthorized).toHaveBeenCalledWith(expect.any(ApiError), 7)
    })

    it('keeps the original 401 ApiError when the unauthorized callback throws', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
            code: 'AUTH_UNAUTHORIZED',
            message: '로그인이 필요합니다.',
            traceId: 'trace-auth',
        }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
        const client = createHttpClient({
            baseUrl: 'https://core.example.test/api/core',
            onUnauthorized: () => { throw new Error('session cleanup failed') },
            fetch: fetchMock,
        })

        await expect(client.get('items')).rejects.toMatchObject({
            name: 'ApiError',
            code: 'AUTH_UNAUTHORIZED',
            traceId: 'trace-auth',
        })
    })

    it('rejects malformed JSON on a successful response without retrying it as a network failure', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{invalid-json', {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Trace-Id': 'trace-invalid-json' },
        }))
        const client = createHttpClient({ baseUrl: 'https://core.example.test/api/core', fetch: fetchMock })

        await expect(client.get('items')).rejects.toMatchObject({
            name: 'ApiError',
            status: 200,
            code: 'INVALID_RESPONSE',
            message: '서버 응답 형식이 올바르지 않습니다.',
            traceId: 'trace-invalid-json',
        })
    })

    it('normalizes a response body stream failure as a retryable network error', async () => {
        const response = Response.json({ id: 1 })
        vi.spyOn(response, 'text').mockRejectedValue(new TypeError('connection reset mid-stream'))
        const client = createHttpClient({
            baseUrl: 'https://core.example.test/api/core',
            fetch: vi.fn<typeof fetch>().mockResolvedValue(response),
        })

        await expect(client.get('items/1')).rejects.toMatchObject({
            name: 'ApiError',
            status: 0,
            code: 'NETWORK_ERROR',
            message: '서버에 연결할 수 없습니다.',
        })
    })

    it('does not expose arbitrary response text or server error messages', async () => {
        const textClient = createHttpClient({
            baseUrl: 'https://core.example.test/api/core',
            fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('database-password=secret', { status: 418 })),
        })
        const serverClient = createHttpClient({
            baseUrl: 'https://core.example.test/api/core',
            fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
                code: 'DB_FAILURE',
                message: 'jdbc:postgresql://internal-db secret detail',
                traceId: '<script>alert(1)</script>',
            }), { status: 500, headers: { 'Content-Type': 'application/json' } })),
        })

        await expect(textClient.get('items')).rejects.toMatchObject({
            code: 'HTTP_418',
            message: '요청을 처리하지 못했습니다.',
        })
        await expect(serverClient.get('items')).rejects.toMatchObject({
            code: 'DB_FAILURE',
            message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
            traceId: undefined,
        })
    })

    it('handles 204 responses without attempting JSON parsing', async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
        const client = createHttpClient({ baseUrl: 'https://core.example.test/api/core', fetch: fetchMock })

        await expect(client.delete('items/1')).resolves.toEqual({ data: undefined, status: 204 })
    })

    it('does not allow an absolute request URL to escape the configured API origin', async () => {
        const client = createHttpClient({
            baseUrl: 'https://core.example.test/api/core',
            fetch: vi.fn<typeof fetch>(),
        })

        await expect(client.get('https://evil.example.test/items')).rejects.toBeInstanceOf(ApiError)
    })

    it('requires HTTPS for non-loopback API hosts', () => {
        expect(() => createHttpClient({
            baseUrl: 'http://core.example.test/api/core',
            fetch: vi.fn<typeof fetch>(),
        })).toThrow(/HTTPS/)
    })
})
