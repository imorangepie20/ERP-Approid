import type {
    Bom,
    Employee,
    Equipment,
    Item,
    Partner,
    ProductionPlan,
    PurchaseOrder,
    Quotation,
    Receivable,
    Routing,
    SalesOrder,
    WorkOrder,
} from './types'

// ============================================================
// 기준 정보 (마스터)
// ============================================================

export const seedItems: Item[] = [
    { id: 'P-A001', name: '프레임 가조립품 A', spec: '1000×500×200', category: '조립', unit: 'EA', price: 153000, stock: 320, safetyStock: 100, type: '제품', leadTime: 0 },
    { id: 'P-B002', name: '샤시 브라켓 B', spec: 'SUS 304 t2.0', category: '절삭', unit: 'EA', price: 32500, stock: 1450, safetyStock: 400, type: '제품', leadTime: 0 },
    { id: 'P-C003', name: '커버 몸체 C', spec: 'ABS 사출', category: '사출', unit: 'EA', price: 80000, stock: 60, safetyStock: 120, type: '제품', leadTime: 0 },
    { id: 'P-D004', name: '지지대 플레이트', spec: 'SS400 t8', category: '절삭', unit: 'EA', price: 25000, stock: 1820, safetyStock: 500, type: '제품', leadTime: 0 },
    { id: 'P-E100', name: '용접 서브 어셈블리', spec: 'STKR-400', category: '용접', unit: 'EA', price: 96000, stock: 150, safetyStock: 60, type: '반제품', leadTime: 0 },
    { id: 'M-S001', name: '강판 3.0mm', spec: 'SS400 1200×2400', category: '소재', unit: 'SHT', price: 78000, stock: 210, safetyStock: 80, type: '자재', leadTime: 5 },
    { id: 'M-S002', name: '파이프 Ø48.6', spec: 'STKR-400 t2.0', category: '소재', unit: 'M', price: 9200, stock: 1450, safetyStock: 500, type: '자재', leadTime: 7 },
    { id: 'M-C001', name: 'ABS 펠릿', spec: 'LG 화학 15E', category: '원료', unit: 'KG', price: 2600, stock: 480, safetyStock: 600, type: '자재', leadTime: 10 },
]

export const seedPartners: Partner[] = [
    { id: 'C-001', name: '주식회사 대영', contact: '02-1234-1001', paymentTerms: 30, type: '고객사' },
    { id: 'C-002', name: '한솔테크', contact: '031-456-1002', paymentTerms: 45, type: '고객사' },
    { id: 'C-003', name: '강남정밀', contact: '02-987-1003', paymentTerms: 30, type: '고객사' },
    { id: 'C-004', name: '동방산업', contact: '051-333-1004', paymentTerms: 60, type: '고객사' },
    { id: 'V-001', name: '대한강철', contact: '052-222-2001', paymentTerms: 30, type: '발주처' },
    { id: 'V-002', name: '코리아 폴리머', contact: '052-555-2002', paymentTerms: 30, type: '발주처' },
    { id: 'SC-001', name: '정연 용접', contact: '031-777-3001', paymentTerms: 30, type: '외주처' },
]

export const seedBom: Bom[] = [
    { id: 'BOM-001', parent: 'P-A001', child: 'P-E100', childName: '용접 서브 어셈블리', qty: 1, loss: 2, childType: '반제품', substitute: '-' },
    { id: 'BOM-002', parent: 'P-A001', child: 'M-S001', childName: '강판 3.0mm', qty: 2, loss: 5, childType: '자재', substitute: 'M-S001-A' },
    { id: 'BOM-003', parent: 'P-B002', child: 'M-S001', childName: '강판 3.0mm', qty: 0.4, loss: 3, childType: '자재', substitute: '-' },
    { id: 'BOM-004', parent: 'P-B002', child: 'M-S002', childName: '파이프 Ø48.6', qty: 1.2, loss: 2, childType: '자재', substitute: 'M-S002-A' },
    { id: 'BOM-005', parent: 'P-C003', child: 'M-C001', childName: 'ABS 펠릿', qty: 1.5, loss: 4, childType: '자재', substitute: '-' },
    { id: 'BOM-006', parent: 'P-E100', child: 'M-S002', childName: '파이프 Ø48.6', qty: 3, loss: 2, childType: '자재', substitute: '-' },
]

export const seedRoutings: Routing[] = [
    { id: 'RT-001', item: 'P-A001', seq: 10, process: '절단', workCenter: 'WC-CUT', stdTime: 0.5, isSubcontract: false },
    { id: 'RT-002', item: 'P-A001', seq: 20, process: '용접', workCenter: 'WC-WLD', stdTime: 1.2, isSubcontract: false },
    { id: 'RT-003', item: 'P-A001', seq: 30, process: '조립', workCenter: 'WC-ASM', stdTime: 0.8, isSubcontract: false },
    { id: 'RT-004', item: 'P-B002', seq: 10, process: '프레스', workCenter: 'WC-PRS', stdTime: 0.3, isSubcontract: false },
    { id: 'RT-005', item: 'P-B002', seq: 20, process: '연마', workCenter: 'WC-POL', stdTime: 0.2, isSubcontract: true },
    { id: 'RT-006', item: 'P-C003', seq: 10, process: '사출', workCenter: 'WC-INJ', stdTime: 0.25, isSubcontract: false },
    { id: 'RT-007', item: 'P-C003', seq: 20, process: '검사', workCenter: 'WC-QC', stdTime: 0.1, isSubcontract: false },
    { id: 'RT-008', item: 'P-D004', seq: 10, process: '레이저 절단', workCenter: 'WC-CUT', stdTime: 0.15, isSubcontract: false },
    { id: 'RT-009', item: 'P-E100', seq: 10, process: '용접', workCenter: 'WC-WLD', stdTime: 1.0, isSubcontract: false },
]

export const seedEquipment: Equipment[] = [
    { id: 'EQ-CUT-01', name: '레이저 절단기 3kW', workCenter: 'WC-CUT', capacity: 200, uptime: 92, operatingRate: 88, status: '가동' },
    { id: 'EQ-PRS-01', name: '프레스 200T', workCenter: 'WC-PRS', capacity: 150, uptime: 0, operatingRate: 0, status: '고장' },
    { id: 'EQ-INJ-01', name: '사출기 200T', workCenter: 'WC-INJ', capacity: 120, uptime: 95, operatingRate: 91, status: '가동' },
    { id: 'EQ-WLD-01', name: '용접 로봇', workCenter: 'WC-WLD', capacity: 80, uptime: 89, operatingRate: 85, status: '가동' },
    { id: 'EQ-POL-01', name: '연마기', workCenter: 'WC-POL', capacity: 60, uptime: 0, operatingRate: 0, status: '유휴' },
]

export const seedEmployees: Employee[] = [
    { id: 'EMP-001', name: '김대표', department: '경영', position: '대표이사', workCenter: '-', joinDate: '2018-03-01', status: '재직' },
    { id: 'EMP-002', name: '이영업', department: '영업', position: '과장', workCenter: '-', joinDate: '2019-06-15', status: '재직' },
    { id: 'EMP-003', name: '박생관', department: '생산', position: '차장', workCenter: 'WC-WLD', joinDate: '2017-11-01', status: '재직' },
    { id: 'EMP-004', name: '최자재', department: '자재', position: '대리', workCenter: 'WC-CUT', joinDate: '2021-02-10', status: '재직' },
    { id: 'EMP-005', name: '정품질', department: '품질', position: '과장', workCenter: 'WC-QC', joinDate: '2020-04-01', status: '재직' },
    { id: 'EMP-006', name: '강회계', department: '회계', position: '대리', workCenter: '-', joinDate: '2019-09-01', status: '재직' },
    { id: 'EMP-007', name: '윤현장', department: '생산', position: '작업자', workCenter: 'WC-ASM', joinDate: '2023-01-05', status: '재직' },
]

// ============================================================
// 영업
// ============================================================

export const seedQuotations: Quotation[] = [
    { id: 'QT-2609-001', customer: '주식회사 대영', item: '프레임 가조립품 A', qty: 120, unitPrice: 153000, amount: 18360000, dueDate: '2026-10-05', validUntil: '2026-09-28', status: '수주완료' },
    { id: 'QT-2609-002', customer: '한솔테크', item: '샤시 브라켓 B', qty: 300, unitPrice: 32500, amount: 9750000, dueDate: '2026-10-08', validUntil: '2026-09-30', status: '수주완료' },
    { id: 'QT-2609-003', customer: '강남정밀', item: '커버 몸체 C', qty: 80, unitPrice: 80000, amount: 6400000, dueDate: '2026-10-12', validUntil: '2026-10-05', status: '발송완료' },
    { id: 'QT-2609-004', customer: '동방산업', item: '지지대 플레이트', qty: 500, unitPrice: 25000, amount: 12500000, dueDate: '2026-10-25', validUntil: '2026-10-18', status: '작성중' },
    { id: 'QT-2609-005', customer: '주식회사 대영', item: '용접 서브 어셈블리', qty: 100, unitPrice: 96000, amount: 9600000, dueDate: '2026-10-30', validUntil: '2026-10-23', status: '작성중' },
]

export const seedSalesOrders: SalesOrder[] = [
    { id: 'SO-2609-001', quotationId: 'QT-2609-001', customer: '주식회사 대영', item: '프레임 가조립품 A', qty: 120, unitPrice: 153000, amount: 18360000, dueDate: '2026-10-05', status: '생산중', createdAt: '2026-09-26' },
    { id: 'SO-2609-002', quotationId: 'QT-2609-002', customer: '한솔테크', item: '샤시 브라켓 B', qty: 300, unitPrice: 32500, amount: 9750000, dueDate: '2026-10-08', status: '생산중', createdAt: '2026-09-26' },
    { id: 'SO-2609-003', customer: '강남정밀', item: '커버 몸체 C', qty: 80, unitPrice: 80000, amount: 6400000, dueDate: '2026-10-12', status: '대기', createdAt: '2026-09-28' },
    { id: 'SO-2609-004', customer: '주식회사 대영', item: '프레임 가조립품 A', qty: 60, unitPrice: 153000, amount: 9180000, dueDate: '2026-10-15', status: '확정', createdAt: '2026-09-29' },
    { id: 'SO-2609-005', customer: '동방산업', item: '지지대 플레이트', qty: 450, unitPrice: 25000, amount: 11250000, dueDate: '2026-10-18', status: '출하완료', createdAt: '2026-09-22' },
    { id: 'SO-2609-006', customer: '한솔테크', item: '샤시 브라켓 B', qty: 150, unitPrice: 32500, amount: 4875000, dueDate: '2026-10-20', status: '생산중', createdAt: '2026-09-30' },
    { id: 'SO-2609-007', customer: '강남정밀', item: '커버 몸체 C', qty: 200, unitPrice: 80000, amount: 16000000, dueDate: '2026-10-22', status: '대기', createdAt: '2026-09-30' },
    { id: 'SO-2609-008', customer: '동방산업', item: '지지대 플레이트', qty: 90, unitPrice: 25000, amount: 2250000, dueDate: '2026-10-25', status: '취소', createdAt: '2026-10-01' },
]

export const seedReceivables: Receivable[] = [
    { id: 'RV-001', customer: '주식회사 대영', order: 'SO-2508-014', amount: 24500000, dueDate: '2026-09-25', overdueDays: 8, status: '연체' },
    { id: 'RV-002', customer: '한솔테크', order: 'SO-2609-002', amount: 9750000, dueDate: '2026-10-12', overdueDays: 0, status: '미수' },
    { id: 'RV-003', customer: '강남정밀', order: 'SO-2609-003', amount: 6400000, dueDate: '2026-10-11', overdueDays: 0, status: '미수' },
    { id: 'RV-004', customer: '동방산업', order: 'SO-2609-005', amount: 11250000, dueDate: '2026-11-17', overdueDays: 0, status: '미수' },
    { id: 'RV-005', customer: '주식회사 대영', order: 'SO-2508-009', amount: 15200000, dueDate: '2026-09-10', overdueDays: 23, status: '연체' },
    { id: 'RV-006', customer: '한솔테크', order: 'SO-2507-021', amount: 8400000, dueDate: '2026-09-30', overdueDays: 3, status: '연체' },
]

// ============================================================
// 생산
// ============================================================

export const seedPlans: ProductionPlan[] = [
    { id: 'PL-2610-001', item: '프레임 가조립품 A', month: '2026-10', planQty: 200, orderQty: 180, stockQty: 320, gap: 60, status: '확정' },
    { id: 'PL-2610-002', item: '샤시 브라켓 B', month: '2026-10', planQty: 500, orderQty: 450, stockQty: 1450, gap: 1500, status: '확정' },
    { id: 'PL-2610-003', item: '커버 몸체 C', month: '2026-10', planQty: 300, orderQty: 280, stockQty: 60, gap: 80, status: '계획' },
    { id: 'PL-2610-004', item: '지지대 플레이트', month: '2026-10', planQty: 600, orderQty: 540, stockQty: 1820, gap: 130, status: '계획' },
    { id: 'PL-2610-005', item: '용접 서브 어셈블리', month: '2026-10', planQty: 250, orderQty: 250, stockQty: 150, gap: 0, status: '종결' },
    { id: 'PL-2609-006', item: '프레임 가조립품 A', month: '2026-09', planQty: 180, orderQty: 165, stockQty: 250, gap: 0, status: '종결' },
]

export const seedWorkOrders: WorkOrder[] = [
    { id: 'WO-2610-001', salesOrderId: 'SO-2609-001', item: '프레임 가조립품 A', qty: 120, goodQty: 96, defectQty: 4, startDate: '2026-09-28', dueDate: '2026-10-05', progress: 80, status: '진행중' },
    { id: 'WO-2610-002', salesOrderId: 'SO-2609-002', item: '샤시 브라켓 B', qty: 300, goodQty: 300, defectQty: 0, startDate: '2026-09-26', dueDate: '2026-10-08', progress: 100, status: '완료' },
    { id: 'WO-2610-003', item: '커버 몸체 C', qty: 80, goodQty: 24, defectQty: 2, startDate: '2026-10-01', dueDate: '2026-10-12', progress: 30, status: '진행중' },
    { id: 'WO-2610-004', item: '지지대 플레이트', qty: 450, goodQty: 0, defectQty: 0, startDate: '2026-10-06', dueDate: '2026-10-18', progress: 0, status: '지시' },
    { id: 'WO-2610-005', item: '용접 서브 어셈블리', qty: 240, goodQty: 240, defectQty: 6, startDate: '2026-09-20', dueDate: '2026-09-30', progress: 100, status: '마감' },
    { id: 'WO-2610-006', item: '커버 몸체 C', qty: 200, goodQty: 0, defectQty: 0, startDate: '2026-10-10', dueDate: '2026-10-22', progress: 0, status: '지시' },
]

// ============================================================
// 자재·구매
// ============================================================

export const seedPurchaseOrders: PurchaseOrder[] = [
    { id: 'PO-2610-001', vendor: '대한강철', item: '강판 3.0mm', qty: 200, unitPrice: 78000, amount: 15600000, dueDate: '2026-10-05', status: '입고완료', receivedQty: 200 },
    { id: 'PO-2610-002', vendor: '대한강철', item: '파이프 Ø48.6', qty: 1500, unitPrice: 9200, amount: 13800000, dueDate: '2026-10-07', status: '부분입고', receivedQty: 1000 },
    { id: 'PO-2610-003', vendor: '코리아 폴리머', item: 'ABS 펠릿', qty: 800, unitPrice: 2600, amount: 2080000, dueDate: '2026-10-07', status: '입고완료', receivedQty: 800 },
    { id: 'PO-2610-004', vendor: '코리아 폴리머', item: 'ABS 펠릿', qty: 600, unitPrice: 2600, amount: 1560000, dueDate: '2026-10-18', status: '발주', receivedQty: 0 },
    { id: 'PO-2610-005', vendor: '대한강철', item: '강판 3.0mm', qty: 150, unitPrice: 78000, amount: 11700000, dueDate: '2026-10-20', status: '발주', receivedQty: 0 },
    { id: 'PO-2609-006', vendor: '대한강철', item: '강판 3.0mm', qty: 100, unitPrice: 78000, amount: 7800000, dueDate: '2026-09-15', status: '취소', receivedQty: 0 },
]
