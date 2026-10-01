import { describe, expect, it } from 'vitest'

import { parseLoginResponse, parseUserResponse } from './contracts'

describe('auth response contracts', () => {
    it('accepts a complete login response and known roles', () => {
        expect(parseLoginResponse({
            accessToken: 'token',
            tokenType: 'Bearer',
            expiresIn: 3600,
            user: { id: 1, username: 'admin', name: '관리자', roles: ['ADMIN'] },
        })).toEqual({
            accessToken: 'token',
            tokenType: 'Bearer',
            expiresIn: 3600,
            user: { id: 1, username: 'admin', name: '관리자', roles: ['ADMIN'] },
        })
    })

    it.each([
        {},
        { accessToken: '', tokenType: 'Bearer', expiresIn: 3600, user: {} },
        { accessToken: 'token', tokenType: 'Basic', expiresIn: 3600, user: {} },
        { accessToken: 'token', tokenType: 'Bearer', expiresIn: 0, user: {} },
    ])('rejects incomplete login responses', (payload) => {
        expect(() => parseLoginResponse(payload)).toThrow(/인증 응답/)
    })

    it('rejects malformed users and unknown roles', () => {
        expect(() => parseUserResponse({ id: 1, username: 'user', name: '사용자', roles: ['ROOT'] }))
            .toThrow(/인증 응답/)
        expect(() => parseUserResponse({ id: 1, username: '', name: '사용자', roles: [] }))
            .toThrow(/인증 응답/)
    })
})
