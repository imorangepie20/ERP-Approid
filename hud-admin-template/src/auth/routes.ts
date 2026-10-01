const DEFAULT_RETURN_PATH = '/'

export function safeReturnPath(state: unknown): string {
    if (!state || typeof state !== 'object') return DEFAULT_RETURN_PATH
    const from = (state as { from?: unknown }).from
    if (typeof from !== 'string'
        || !from.startsWith('/')
        || from.startsWith('//')
        || from.includes('\\')
        || from === '/login'
        || Array.from(from).some(character => {
            const code = character.charCodeAt(0)
            return code <= 31 || code === 127
        })) {
        return DEFAULT_RETURN_PATH
    }
    return from
}
