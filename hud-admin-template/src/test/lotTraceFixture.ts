export const lotTraceRow = () => ({ id: 7, lotNo: 'LOT-LIVE', itemId: 9, itemNo: 'M-LIVE', itemName: '실제 자재', unit: 'kg',
    warehouse: '기록창고', qty: 5, producedAt: '2026-10-01', expiry: null as string | null, status: '정상',
    expired: false, expiringSoon: false, invalid: false, referenceDate: '2026-10-04' })
export const lotTraceMovement = () => ({ id: 12, itemId: 9, unit: 'kg', txnNo: 'IVT-LIVE', txnType: '입고', qty: 5, txnDate: '2026-10-01', warehouse: '기록창고',
    refType: 'RECEIVING' as string | null, refNo: 'RC-LIVE' as string | null, sourceType: 'RECEIVING', sourceId: 42 as number | null, sourceNo: 'RC-LIVE' as string | null })
export const lotTraceDetail = () => ({ asOf: '2026-10-04T05:00:00Z', timeZone: 'Asia/Seoul', lot: lotTraceRow(),
    movements: { content: [lotTraceMovement()], number: 0, size: 20, totalElements: 1, totalPages: 1 },
    notes: ['저장된 원천값이며 출하 가용량이 아닙니다.', '과거 미연결 원천을 추정하지 않습니다.'] })
export const lotTracePage = () => ({ content: [lotTraceRow()], number: 0, size: 10, totalElements: 1, totalPages: 1 })
