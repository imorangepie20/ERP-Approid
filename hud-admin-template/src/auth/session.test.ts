import { beforeEach, describe, expect, it } from 'vitest'

import { clearSession, readSession, saveSession } from './session'

describe('auth session storage', () => {
    beforeEach(() => sessionStorage.clear())

    it('stores only the access token and absolute expiration in sessionStorage', () => {
        const session = saveSession(sessionStorage, 'access-token', 60, 1_000)

        expect(session).toEqual({ accessToken: 'access-token', expiresAt: 61_000 })
        expect(JSON.parse(sessionStorage.getItem('erp-approid.auth')!)).toEqual(session)
        expect(localStorage).toHaveLength(0)
    })

    it('removes expired or malformed sessions', () => {
        sessionStorage.setItem('erp-approid.auth', JSON.stringify({ accessToken: 'old', expiresAt: 999 }))
        expect(readSession(sessionStorage, 1_000)).toBeNull()
        expect(sessionStorage).toHaveLength(0)

        sessionStorage.setItem('erp-approid.auth', '{broken')
        expect(readSession(sessionStorage, 1_000)).toBeNull()
        expect(sessionStorage).toHaveLength(0)
    })

    it('clears a valid session explicitly', () => {
        saveSession(sessionStorage, 'access-token', 60, 1_000)
        clearSession(sessionStorage)
        expect(readSession(sessionStorage, 1_000)).toBeNull()
    })

    it('rejects an expiration that cannot be represented as a safe integer', () => {
        expect(() => saveSession(sessionStorage, 'access-token', Number.MAX_SAFE_INTEGER, 1_000))
            .toThrow(/세션/)
        expect(sessionStorage).toHaveLength(0)
    })
})
