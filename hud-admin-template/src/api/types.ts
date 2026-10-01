export interface FieldError {
    field: string
    value?: string | null
    reason: string
}

/** Mirrors the Spring API's common ErrorResponse contract. */
export interface ErrorResponse {
    code: string
    message: string
    timestamp?: string
    traceId?: string
    errors?: FieldError[]
}

export interface ApiResult<T> {
    data: T
    status: number
    traceId?: string
}
