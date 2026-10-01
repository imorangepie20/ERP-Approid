import { ApiError } from '../api/http'
import { ROLE_CODES, type AuthUser, type LoginResponse, type Role } from './types'

const roles = new Set<string>(ROLE_CODES)

function invalidAuthResponse(): never {
    throw new ApiError({
        status: 200,
        code: 'INVALID_AUTH_RESPONSE',
        message: '서버 인증 응답 형식이 올바르지 않습니다.',
    })
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parseUserResponse(value: unknown): AuthUser {
    if (!isRecord(value)
        || typeof value.id !== 'number'
        || !Number.isSafeInteger(value.id)
        || value.id <= 0
        || typeof value.username !== 'string'
        || value.username.trim() === ''
        || typeof value.name !== 'string'
        || value.name.trim() === ''
        || !Array.isArray(value.roles)
        || !value.roles.every(role => typeof role === 'string' && roles.has(role))) {
        return invalidAuthResponse()
    }

    return {
        id: value.id,
        username: value.username,
        name: value.name,
        roles: value.roles as Role[],
    }
}

export function parseLoginResponse(value: unknown): LoginResponse {
    if (!isRecord(value)
        || typeof value.accessToken !== 'string'
        || value.accessToken.trim() === ''
        || value.tokenType !== 'Bearer'
        || typeof value.expiresIn !== 'number'
        || !Number.isSafeInteger(value.expiresIn)
        || value.expiresIn <= 0) {
        return invalidAuthResponse()
    }

    return {
        accessToken: value.accessToken,
        tokenType: 'Bearer',
        expiresIn: value.expiresIn,
        user: parseUserResponse(value.user),
    }
}
