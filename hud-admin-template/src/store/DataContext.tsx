import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react'
import type {
    Bom,
    Cost,
    Defect,
    Employee,
    Equipment,
    Inspection,
    Item,
    LedgerEntry,
    Lot,
    Maintenance,
    Notice,
    Notify,
    Partner,
    ProductionPlan,
    PurchaseOrder,
    Quotation,
    Receiving,
    Receivable,
    Routing,
    SalesOrder,
    Shipment,
    StatusToneKey,
    Subcontract,
    WorkOrder,
} from './types'
import {
    seedBom,
    seedEmployees,
    seedEquipment,
    seedItems,
    seedPartners,
    seedPlans,
    seedPurchaseOrders,
    seedQuotations,
    seedReceivables,
    seedRoutings,
    seedSalesOrders,
    seedWorkOrders,
} from './seed'
import {
    seedCosts,
    seedDefects,
    seedInspections,
    seedLedger,
    seedLots,
    seedMaintenances,
    seedNotices,
    seedNotifies,
    seedReceivings,
    seedShipments,
    seedSubcontracts,
} from './seed2'

// ============================================================
// 유틸
// ============================================================

export const today = () => new Date().toISOString().slice(0, 10)

/** 한국 원화 포맷 */
export const formatWon = (value: number) => `${value.toLocaleString('ko-KR')}원`

/** 시퀀스 생성: 기존 ID 중 최대 순번 + 1 */
export const nextId = (prefix: string, existing: { id: string }[], pad = 3) => {
    const max = existing.reduce((acc, cur) => {
        const n = Number(cur.id.split('-').pop())
        return Number.isFinite(n) && n > acc ? n : acc
    }, 0)
    const head = prefix.split('-')[0]
    const yearMonth = `${new Date().getFullYear().toString().slice(2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    return `${head}-${yearMonth}-${String(max + 1).padStart(pad, '0')}`
}

// ============================================================
// 스토어 상태
// ============================================================

export interface DataState {
    // 마스터
    items: Item[]
    partners: Partner[]
    boms: Bom[]
    routings: Routing[]
    equipment: Equipment[]
    employees: Employee[]
    // 영업
    quotations: Quotation[]
    salesOrders: SalesOrder[]
    receivables: Receivable[]
    shipments: Shipment[]
    // 생산
    plans: ProductionPlan[]
    workOrders: WorkOrder[]
    // 자재·구매
    purchaseOrders: PurchaseOrder[]
    receivings: Receiving[]
    lots: Lot[]
    // 품질
    inspections: Inspection[]
    defects: Defect[]
    // 설비·외주
    maintenances: Maintenance[]
    subcontracts: Subcontract[]
    // 회계
    costs: Cost[]
    ledger: LedgerEntry[]
    // 게시판
    notices: Notice[]
    notifies: Notify[]
}

const initialState: DataState = {
    items: seedItems,
    partners: seedPartners,
    boms: seedBom,
    routings: seedRoutings,
    equipment: seedEquipment,
    employees: seedEmployees,
    quotations: seedQuotations,
    salesOrders: seedSalesOrders,
    receivables: seedReceivables,
    shipments: seedShipments,
    plans: seedPlans,
    workOrders: seedWorkOrders,
    purchaseOrders: seedPurchaseOrders,
    receivings: seedReceivings,
    lots: seedLots,
    inspections: seedInspections,
    defects: seedDefects,
    maintenances: seedMaintenances,
    subcontracts: seedSubcontracts,
    costs: seedCosts as Cost[],
    ledger: seedLedger,
    notices: seedNotices,
    notifies: seedNotifies,
}

// ============================================================
// CRUD 액션
// ============================================================

interface DataContextValue extends DataState {
    /** 컬렉션에 레코드 추가 */
    create: <K extends keyof DataState>(collection: K, record: DataState[K][number]) => void
    /** 레코드 수정 */
    update: <K extends keyof DataState>(collection: K, id: string, patch: Partial<DataState[K][number]>) => void
    /** 레코드 삭제 */
    remove: <K extends keyof DataState>(collection: K, id: string) => void
    // ============================================================
    // 업무 흐름 액션 (데이터가 쌓이는 파이프라인)
    // ============================================================
    /** 견적 → 수주 */
    quotationToOrder: (quotationId: string) => string | null
    /** 수주 확정 → 작업오더 생성 + 상태 변경 */
    confirmSalesOrder: (salesOrderId: string) => string | null
    /** 발주 → 입고 등록 (재고/아이템 증가, 검수) */
    receivePurchaseOrder: (purchaseOrderId: string, receivedQty: number, defectQty: number) => string | null
    /** 작업오더 완료 → 완제품 입고(LOT) + 원가 집계 + 매출 출하 연결 */
    completeWorkOrder: (workOrderId: string) => void
    /** 출하 확정 → 매출 반영(매출전표) + 수주 완료 */
    confirmShipment: (shipmentId: string) => void
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

export const DataProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<DataState>(initialState)

    const create = useCallback(<K extends keyof DataState>(collection: K, record: DataState[K][number]) => {
        setState(prev => ({ ...prev, [collection]: [...prev[collection], record] }))
    }, [])

    const update = useCallback(<K extends keyof DataState>(collection: K, id: string, patch: Partial<DataState[K][number]>) => {
        setState(prev => ({
            ...prev,
            [collection]: (prev[collection] as { id: string }[]).map(r => (r.id === id ? { ...r, ...patch } : r)),
        }))
    }, [])

    const remove = useCallback(<K extends keyof DataState>(collection: K, id: string) => {
        setState(prev => ({
            ...prev,
            [collection]: (prev[collection] as { id: string }[]).filter(r => r.id !== id),
        }))
    }, [])

    // ============================================================
    // 흐름 1: 견적 → 수주
    // ============================================================
    const quotationToOrder = useCallback((quotationId: string): string | null => {
        const q = state.quotations.find(x => x.id === quotationId)
        if (!q) return null
        if (q.status === '수주완료') return null

        const newId = nextId('SO', state.salesOrders)
        const order: SalesOrder = {
            id: newId,
            quotationId: q.id,
            customerId: q.customerId,
            paymentTerms: q.paymentTerms,
            leadTimeDays: q.leadTimeDays,
            customer: q.customer,
            item: q.item,
            qty: q.qty,
            unitPrice: q.unitPrice,
            amount: q.amount,
            dueDate: q.dueDate,
            status: '대기',
            createdAt: today(),
        }
        setState(prev => ({
            ...prev,
            quotations: prev.quotations.map(x => (x.id === quotationId ? { ...x, status: '수주완료' } : x)),
            salesOrders: [...prev.salesOrders, order],
        }))
        return newId
    }, [state.quotations, state.salesOrders])

    // ============================================================
    // 흐름 2: 수주 확정 → 작업오더 생성
    // ============================================================
    const confirmSalesOrder = useCallback((salesOrderId: string): string | null => {
        const so = state.salesOrders.find(x => x.id === salesOrderId)
        if (!so) return null
        if (so.status !== '대기') return null

        const newId = nextId('WO', state.workOrders)
        const wo: WorkOrder = {
            id: newId,
            salesOrderId: so.id,
            item: so.item,
            qty: so.qty,
            goodQty: 0,
            defectQty: 0,
            startDate: today(),
            dueDate: so.dueDate,
            progress: 0,
            status: '지시',
        }
        setState(prev => ({
            ...prev,
            salesOrders: prev.salesOrders.map(x => (x.id === salesOrderId ? { ...x, status: '확정' } : x)),
            workOrders: [...prev.workOrders, wo],
        }))
        return newId
    }, [state.salesOrders, state.workOrders])

    // ============================================================
    // 흐름 3: 발주 → 입고 → 재고 증가
    // ============================================================
    const receivePurchaseOrder = useCallback((purchaseOrderId: string, receivedQty: number, defectQty: number): string | null => {
        const po = state.purchaseOrders.find(x => x.id === purchaseOrderId)
        if (!po) return null

        const receivingId = nextId('RC', state.receivings)
        const totalReceived = po.receivedQty + receivedQty
        const status: PurchaseOrder['status'] =
            totalReceived >= po.qty ? '입고완료' : '부분입고'
        const receivingStatus: Receiving['status'] =
            defectQty === 0 ? '합격' : receivedQty - defectQty > 0 ? '부분합격' : '반품'

        const receiving: Receiving = {
            id: receivingId,
            purchaseOrder: po.id,
            vendor: po.vendor,
            item: po.item,
            orderQty: po.qty,
            receivedQty,
            defectQty,
            date: today(),
            status: receivingStatus,
        }

        // 입고된 자재의 재고/LOT 반영
        const targetItem = state.items.find(i => i.name === po.item)
        const newLot: Lot = {
            id: nextId('LOT', state.lots),
            item: targetItem?.id ?? po.item,
            warehouse: '자재창고',
            qty: receivedQty - defectQty,
            producedAt: today(),
            expiry: '9999-12-31',
            status: '정상',
        }

        const ledgerEntry: LedgerEntry = {
            id: nextId('LE', state.ledger),
            date: today(),
            account: '매입원가',
            description: `${po.id} ${po.item} ${receivedQty}${targetItem?.unit ?? ''}`,
            type: '출금',
            amount: po.unitPrice * receivedQty,
        }

        setState(prev => ({
            ...prev,
            purchaseOrders: prev.purchaseOrders.map(x =>
                x.id === purchaseOrderId
                    ? { ...x, receivedQty: totalReceived, status }
                    : x
            ),
            receivings: [...prev.receivings, receiving],
            lots: [...prev.lots, newLot],
            items: prev.items.map(i =>
                i.name === po.item ? { ...i, stock: i.stock + (receivedQty - defectQty) } : i
            ),
            ledger: [...prev.ledger, ledgerEntry],
        }))
        return receivingId
    }, [state.purchaseOrders, state.receivings, state.lots, state.items, state.ledger])

    // ============================================================
    // 흐름 4: 작업오더 완료 → 완제품 입고 + 원가 집계
    // ============================================================
    const completeWorkOrder = useCallback((workOrderId: string) => {
        const wo = state.workOrders.find(x => x.id === workOrderId)
        if (!wo) return
        if (wo.status === '완료' || wo.status === '마감') return

        const targetItem = state.items.find(i => i.name === wo.item)
        const warehouse = targetItem?.type === '자재' ? '자재창고' : targetItem?.type === '반제품' ? '반제품창고' : '완제품창고'
        const newLot: Lot = {
            id: nextId('LOT', state.lots),
            item: targetItem?.id ?? wo.item,
            warehouse,
            qty: wo.goodQty,
            producedAt: today(),
            expiry: '9999-12-31',
            status: '정상',
        }

        // 표준원가 = 재료비(BOM×단가) + 노무비(표준시간×임율) + 경비 + 외주비 (간이 산정)
        const routing = state.routings.filter(r => r.item === (targetItem?.id ?? wo.item))
        const stdTime = routing.reduce((acc, r) => acc + r.stdTime, 0)
        const laborRate = 25000
        const overheadRate = 0.5
        const material = targetItem ? targetItem.price * wo.goodQty * 0.4 : 0
        const labor = Math.round(stdTime * laborRate * wo.goodQty)
        const overhead = Math.round(labor * overheadRate)
        const subcontract = state.subcontracts
            .filter(sc => sc.item === wo.item)
            .reduce((acc, sc) => acc + sc.unitPrice * wo.goodQty, 0)
        const total = material + labor + overhead + subcontract
        const standard = targetItem ? targetItem.price * wo.goodQty : total
        const cost: Cost = {
            id: nextId('CST', state.costs),
            order: wo.id,
            item: wo.item,
            material,
            labor,
            overhead,
            subcontract,
            total,
            standard,
            diff: total - standard,
        }

        setState(prev => ({
            ...prev,
            workOrders: prev.workOrders.map(x =>
                x.id === workOrderId
                    ? { ...x, status: '완료', progress: 100 }
                    : x
            ),
            lots: [...prev.lots, newLot],
            items: prev.items.map(i =>
                i.name === wo.item ? { ...i, stock: i.stock + wo.goodQty } : i
            ),
            costs: [...prev.costs, cost],
        }))
    }, [state.workOrders, state.routings, state.items, state.subcontracts, state.lots, state.costs])

    // ============================================================
    // 흐름 5: 출하 확정 → 매출 전표 + 수주 완료
    // ============================================================
    const confirmShipment = useCallback((shipmentId: string) => {
        const sh = state.shipments.find(x => x.id === shipmentId)
        if (!sh) return
        if (sh.status === '출하완료' || sh.status === '매출반영') return

        const so = state.salesOrders.find(x => x.id === sh.salesOrder)
        const partner = state.partners.find(p => p.name === sh.customer)

        const salesEntry: LedgerEntry = {
            id: nextId('LE', state.ledger),
            date: today(),
            account: '매출액',
            description: `${sh.salesOrder} ${sh.item} ${sh.qty}EA`,
            type: '입금',
            amount: sh.amount,
        }

        const receivable: Receivable = {
            id: nextId('RV', state.receivables),
            customer: sh.customer,
            order: sh.salesOrder,
            amount: sh.amount,
            dueDate: new Date(Date.now() + (so?.paymentTerms ?? partner?.paymentTerms ?? 30) * 86400000).toISOString().slice(0, 10),
            overdueDays: 0,
            status: '미수',
        }

        setState(prev => ({
            ...prev,
            shipments: prev.shipments.map(x =>
                x.id === shipmentId ? { ...x, status: '출하완료', deliveryDate: today() } : x
            ),
            salesOrders: prev.salesOrders.map(x =>
                x.id === sh.salesOrder ? { ...x, status: '출하완료' } : x
            ),
            ledger: [...prev.ledger, salesEntry],
            receivables: [...prev.receivables, receivable],
            items: prev.items.map(i =>
                i.name === sh.item ? { ...i, stock: Math.max(0, i.stock - sh.qty) } : i
            ),
        }))
    }, [state.shipments, state.salesOrders, state.partners, state.ledger, state.receivables, state.items])

    const value = useMemo<DataContextValue>(() => ({
        ...state,
        create,
        update,
        remove,
        quotationToOrder,
        confirmSalesOrder,
        receivePurchaseOrder,
        completeWorkOrder,
        confirmShipment,
    }), [state, create, update, remove, quotationToOrder, confirmSalesOrder, receivePurchaseOrder, completeWorkOrder, confirmShipment])

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// ============================================================
// 훅
// ============================================================

export const useData = () => {
    const ctx = useContext(DataContext)
    if (!ctx) throw new Error('useData must be used within DataProvider')
    return ctx
}

/** 특정 컬렉션만 구독 */
export function useCollection<K extends keyof DataState>(collection: K): DataState[K] {
    const { [collection]: data } = useData()
    return data
}

/** 파생 데이터 헬퍼 */
export const useDerived = () => {
    const { items, workOrders, salesOrders } = useData()
    return useMemo(() => ({
        lowStockItems: items.filter(i => i.stock < i.safetyStock),
        activeWorkOrders: workOrders.filter(w => w.status === '진행중' || w.status === '지시'),
        openSalesOrders: salesOrders.filter(s => s.status === '대기' || s.status === '확정'),
    }), [items, workOrders, salesOrders])
}

// ============================================================
// 상태별 톤 매핑 (공용)
// ============================================================

export const statusTone: Record<string, StatusToneKey> = {
    // 공통
    '대기': 'warning', '지시': 'warning', '계획': 'warning', '작성중': 'warning', '발송완료': 'info',
    '확정': 'primary', '진행중': 'info', '생산중': 'info', '반출': 'info', '배차': 'info', '검수중': 'info',
    '완료': 'success', '출하완료': 'success', '입고완료': 'success', '반입완료': 'success', '합격': 'success',
    '수납완료': 'success', '정상': 'success', '재직': 'success', '가동': 'success', '수주완료': 'success',
    '취소': 'danger', '연체': 'danger', '반품': 'danger', '폐기': 'danger', '고장': 'danger', '퇴사': 'danger',
    '부적합': 'danger', '발송실패': 'danger', '유통기한임박': 'warning',
    '마감': 'primary', '종결': 'primary', '정산완료': 'primary', '매출반영': 'primary',
    '부분입고': 'info', '부분합격': 'warning', '재검사': 'warning', '보류': 'warning', '유휴': 'muted',
    '점검': 'warning', '휴직': 'warning', '처리중': 'warning', '만료': 'muted', '미수': 'info',
}
