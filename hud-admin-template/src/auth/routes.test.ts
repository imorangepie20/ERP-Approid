import { describe, expect, it } from 'vitest'

import { safeReturnPath } from './routes'

describe('safeReturnPath', () => {
    it('keeps an internal application path', () => {
        expect(safeReturnPath({ from: '/sales/orders?page=2#pending' })).toBe('/sales/orders?page=2#pending')
    })

    it.each([
        [undefined],
        [{ from: 'https://evil.example/collect' }],
        [{ from: '//evil.example/collect' }],
        [{ from: '/login' }],
        [{ from: '/\\evil.example' }],
    ])('falls back to the dashboard for unsafe state %#', (state) => {
        expect(safeReturnPath(state)).toBe('/')
    })
})
