import { describe, expect, it } from 'vitest'

import { ApiError } from './http'
import { createAppQueryClient, shouldRetryQuery } from './query-client'

describe('React Query policy', () => {
    it('retries normalized network and server failures at most twice', () => {
        expect(shouldRetryQuery(0, new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Network' }))).toBe(true)
        expect(shouldRetryQuery(1, new ApiError({ status: 503, code: 'DOWN', message: 'Unavailable' }))).toBe(true)
        expect(shouldRetryQuery(2, new ApiError({ status: 503, code: 'DOWN', message: 'Unavailable' }))).toBe(false)
    })

    it('does not retry client failures or mutations', () => {
        expect(shouldRetryQuery(0, new TypeError('unclassified error'))).toBe(false)
        expect(shouldRetryQuery(0, new ApiError({ status: 409, code: 'CONFLICT', message: 'Conflict' }))).toBe(false)
        expect(shouldRetryQuery(0, new ApiError({ status: 200, code: 'INVALID_RESPONSE', message: 'Invalid JSON' }))).toBe(false)
        const client = createAppQueryClient()
        expect(client.getDefaultOptions().mutations?.retry).toBe(false)
    })
})
