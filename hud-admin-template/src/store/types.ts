// ============================================================
// ERP-Approid 공통 도메인 타입
// ============================================================

// ============================================================
// 공통
// ============================================================

import type { StatusTone } from '../components/common/StatusBadge'

/** 상태 문자열 → StatusBadge 톤 매핑용 별칭 */
export type StatusToneKey = StatusTone

export type ID = string

/** 품목 유형 */
export type ItemType = '제품' | '반제품' | '자재'

/** 품목 마스터 */
export interface Item {
    id: ID
    name: string
    spec: string
    category: string
    unit: string
    price: number
    stock: number
    safetyStock: number
    type: ItemType
    /** 발주~입고 소요일 (리드타임) */
    leadTime: number
}

/** BOM */
export interface Bom {
    id: ID
    parent: string
    child: string
    childName: string
    qty: number
    loss: number
    childType: ItemType
    substitute: string
}

/** 거래처 */
export interface Partner {
    id: ID
    name: string
    contact: string
    /** 수납기일(일) */
    paymentTerms: number
    type: '고객사' | '발주처' | '외주처'
}

/** 공정(Routing) */
export interface Routing {
    id: ID
    item: string
    seq: number
    process: string
    workCenter: string
    stdTime: number
    isSubcontract: boolean
}

// ============================================================
// 영업
// ============================================================

export type QuotationStatus = '작성중' | '발송완료' | '수주완료' | '만료'

export interface Quotation {
    id: ID
    customerId?: number
    paymentTerms?: number
    leadTimeDays?: number
    customer: string
    item: string
    qty: number
    unitPrice: number
    amount: number
    dueDate: string
    validUntil: string
    status: QuotationStatus
}

export type SalesStatus = '대기' | '확정' | '생산중' | '출하완료' | '취소'

export interface SalesOrder {
    id: ID
    customerId?: number
    paymentTerms?: number
    leadTimeDays?: number
    quotationId?: ID
    customer: string
    item: string
    qty: number
    unitPrice: number
    amount: number
    dueDate: string
    status: SalesStatus
    createdAt: string
}

export type ReceivableStatus = '미수' | '수납완료' | '연체'

export interface Receivable {
    id: ID
    customer: string
    order: string
    amount: number
    dueDate: string
    overdueDays: number
    status: ReceivableStatus
}

// ============================================================
// 생산
// ============================================================

export type PlanStatus = '계획' | '확정' | '종결'

export interface ProductionPlan {
    id: ID
    item: string
    month: string
    planQty: number
    orderQty: number
    stockQty: number
    gap: number
    status: PlanStatus
}

export type WorkOrderStatus = '지시' | '진행중' | '완료' | '마감' | '취소'

export interface WorkOrder {
    id: ID
    salesOrderId?: ID
    item: string
    qty: number
    goodQty: number
    defectQty: number
    startDate: string
    dueDate: string
    progress: number
    status: WorkOrderStatus
}

// ============================================================
// 자재·구매
// ============================================================

export type PurchaseStatus = '발주' | '부분입고' | '입고완료' | '취소'

export interface PurchaseOrder {
    id: ID
    vendorId?: number
    paymentTerms?: number
    leadTimeDays?: number
    vendor: string
    item: string
    qty: number
    unitPrice: number
    amount: number
    dueDate: string
    status: PurchaseStatus
    receivedQty: number
}

// ============================================================
// 재고
// ============================================================

export type LotStatus = '정상' | '보류' | '유통기한임박' | '폐기'

export interface Lot {
    id: ID
    item: string
    warehouse: string
    qty: number
    producedAt: string
    expiry: string
    status: LotStatus
}

// ============================================================
// 품질
// ============================================================

export type InspectionResult = '합격' | '부적합' | '재검사'

export interface Inspection {
    id: ID
    type: string
    item: string
    lot: string
    sampleQty: number
    defectQty: number
    inspector: string
    date: string
    result: InspectionResult
}

export type DefectHandling = '재작업' | '폐기' | '특채'

export interface Defect {
    id: ID
    item: string
    lot: string
    defectCode: string
    cause: string
    qty: number
    handling: DefectHandling
    date: string
    status: '처리중' | '완료'
}

// ============================================================
// 공정·설비
// ============================================================

export type EquipmentStatus = '가동' | '유휴' | '점검' | '고장'

export interface Equipment {
    id: ID
    name: string
    workCenter: string
    capacity: number
    uptime: number
    operatingRate: number
    status: EquipmentStatus
}

export interface Maintenance {
    id: ID
    equipmentId: string
    equipmentName: string
    type: string
    scheduledDate: string
    completedDate: string
    result: string
    note: string
}

// ============================================================
// 외주
// ============================================================

export type SubcontractStatus = '반출' | '진행중' | '반입완료' | '정산완료'

export interface Subcontract {
    id: ID
    vendor: string
    item: string
    process: string
    qty: number
    unitPrice: number
    amount: number
    dueDate: string
    status: SubcontractStatus
}

// ============================================================
// 출하
// ============================================================

export type ShipmentStatus = '지시' | '배차' | '출하완료' | '매출반영'

export interface Shipment {
    id: ID
    salesOrder: string
    customer: string
    item: string
    qty: number
    deliveryDate: string
    vehicle: string
    status: ShipmentStatus
    amount: number
}

// ============================================================
// 회계·원가
// ============================================================

export interface Cost {
    id: ID
    order: string
    item: string
    material: number
    labor: number
    overhead: number
    subcontract: number
    total: number
    standard: number
    diff: number
}

export type EntryType = '입금' | '출금' | '대체'

export interface LedgerEntry {
    id: ID
    date: string
    account: string
    description: string
    type: EntryType
    amount: number
}

// ============================================================
// 인사
// ============================================================

export interface Employee {
    id: ID
    name: string
    department: string
    position: string
    workCenter: string
    joinDate: string
    status: '재직' | '휴직' | '퇴사'
}

// ============================================================
// 게시판
// ============================================================

export interface Notice {
    id: ID
    title: string
    author: string
    target: string
    views: number
    date: string
}

export interface Notify {
    id: ID
    type: string
    target: string
    title: string
    channel: string
    sentAt: string
    status: string
}

// ============================================================
// MRP (발주 제안)
// ============================================================

export interface MrpSuggestion {
    id: ID
    item: string
    unit: string
    requirement: number
    onHand: number
    shortfall: number
    /** 발주점 = 안전재고 + 소비 × 리드타임 */
    reorderPoint: number
    leadTime: number
    /** 제안 발주 수량 */
    suggestedQty: number
    reason: string
}
