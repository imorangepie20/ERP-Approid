import type {
    Defect,
    Inspection,
    LedgerEntry,
    Lot,
    Maintenance,
    Notice,
    Notify,
    Receiving,
    Shipment,
    Subcontract,
} from './types'

// ============================================================
// 자재·구매
// ============================================================

export const seedReceivings: Receiving[] = [
    { id: 'RC-2610-001', purchaseOrder: 'PO-2610-001', vendor: '대한강철', item: '강판 3.0mm', orderQty: 200, receivedQty: 200, defectQty: 0, date: '2026-10-04', status: '합격' },
    { id: 'RC-2610-002', purchaseOrder: 'PO-2610-002', vendor: '대한강철', item: '파이프 Ø48.6', orderQty: 1500, receivedQty: 1000, defectQty: 12, date: '2026-10-06', status: '부분합격' },
    { id: 'RC-2610-003', purchaseOrder: 'PO-2610-003', vendor: '코리아 폴리머', item: 'ABS 펠릿', orderQty: 800, receivedQty: 800, defectQty: 5, date: '2026-10-07', status: '합격' },
    { id: 'RC-2609-004', purchaseOrder: 'PO-2609-004', vendor: '코리아 폴리머', item: 'ABS 펠릿', orderQty: 500, receivedQty: 500, defectQty: 0, date: '2026-09-14', status: '합격' },
    { id: 'RC-2609-005', purchaseOrder: 'PO-2609-005', vendor: '대한강철', item: '강판 3.0mm', orderQty: 120, receivedQty: 120, defectQty: 3, date: '2026-09-18', status: '부분합격' },
]

// ============================================================
// 재고
// ============================================================

export const seedLots: Lot[] = [
    { id: 'LOT-2610-001', item: 'P-A001', warehouse: '완제품창고', qty: 320, producedAt: '2026-10-02', expiry: '9999-12-31', status: '정상' },
    { id: 'LOT-2610-002', item: 'P-B002', warehouse: '완제품창고', qty: 1450, producedAt: '2026-10-01', expiry: '9999-12-31', status: '정상' },
    { id: 'LOT-2610-003', item: 'P-C003', warehouse: '완제품창고', qty: 60, producedAt: '2026-09-29', expiry: '9999-12-31', status: '보류' },
    { id: 'LOT-2610-004', item: 'M-S001', warehouse: '자재창고', qty: 210, producedAt: '2026-10-04', expiry: '9999-12-31', status: '정상' },
    { id: 'LOT-2610-005', item: 'M-S002', warehouse: '자재창고', qty: 1450, producedAt: '2026-10-06', expiry: '9999-12-31', status: '정상' },
    { id: 'LOT-2610-006', item: 'M-C001', warehouse: '자재창고', qty: 480, producedAt: '2026-10-07', expiry: '2027-10-07', status: '정상' },
    { id: 'LOT-2610-007', item: 'P-E100', warehouse: '반제품창고', qty: 150, producedAt: '2026-09-30', expiry: '9999-12-31', status: '정상' },
]

// ============================================================
// 품질
// ============================================================

export const seedInspections: Inspection[] = [
    { id: 'INS-2610-001', type: '완제품검사', item: '샤시 브라켓 B', lot: 'LOT-2610-002', sampleQty: 30, defectQty: 0, inspector: '정품질', date: '2026-10-01', result: '합격' },
    { id: 'INS-2610-002', type: '공정검사', item: '프레임 가조립품 A', lot: 'LOT-2610-001', sampleQty: 20, defectQty: 4, inspector: '정품질', date: '2026-10-02', result: '부적합' },
    { id: 'INS-2610-003', type: '입고검사', item: 'ABS 펠릿', lot: 'LOT-2610-006', sampleQty: 50, defectQty: 5, inspector: '최자재', date: '2026-10-07', result: '부적합' },
    { id: 'INS-2610-004', type: '완제품검사', item: '용접 서브 어셈블리', lot: 'LOT-2610-007', sampleQty: 24, defectQty: 6, inspector: '정품질', date: '2026-09-30', result: '부적합' },
    { id: 'INS-2609-005', type: '입고검사', item: '강판 3.0mm', lot: 'LOT-2610-004', sampleQty: 10, defectQty: 0, inspector: '최자재', date: '2026-10-04', result: '합격' },
    { id: 'INS-2610-006', type: '공정검사', item: '커버 몸체 C', lot: 'LOT-2610-003', sampleQty: 15, defectQty: 2, inspector: '정품질', date: '2026-09-29', result: '재검사' },
]

export const seedDefects: Defect[] = [
    { id: 'DF-2610-001', item: '프레임 가조립품 A', lot: 'LOT-2610-001', defectCode: 'WELD-01', cause: '용접 불량', qty: 4, handling: '재작업', date: '2026-10-02', status: '처리중' },
    { id: 'DF-2610-002', item: 'ABS 펠릿', lot: 'LOT-2610-006', defectCode: 'MTRL-04', cause: '수분 함량 초과', qty: 5, handling: '폐기', date: '2026-10-07', status: '완료' },
    { id: 'DF-2610-003', item: '용접 서브 어셈블리', lot: 'LOT-2610-007', defectCode: 'WELD-02', cause: '기공 발생', qty: 6, handling: '재작업', date: '2026-09-30', status: '완료' },
    { id: 'DF-2610-004', item: '파이프 Ø48.6', lot: 'LOT-2610-005', defectCode: 'MTRL-01', cause: '치수 불량', qty: 12, handling: '특채', date: '2026-10-06', status: '완료' },
    { id: 'DF-2610-005', item: '커버 몸체 C', lot: 'LOT-2610-003', defectCode: 'INJ-03', cause: '플로우 마크', qty: 2, handling: '폐기', date: '2026-09-29', status: '처리중' },
    { id: 'DF-2609-006', item: '강판 3.0mm', lot: 'LOT-2610-004', defectCode: 'MTRL-02', cause: '표면 스크래치', qty: 3, handling: '특채', date: '2026-09-18', status: '완료' },
]

// ============================================================
// 공정·설비 / 외주
// ============================================================

export const seedMaintenances: Maintenance[] = [
    { id: 'MN-2610-001', equipmentId: 'EQ-PRS-01', equipmentName: '프레스 200T', type: '고장수리', scheduledDate: '2026-10-06', completedDate: '', result: '유압 펌프 교체중', note: '유압 펌프 교체' },
    { id: 'MN-2609-002', equipmentId: 'EQ-CUT-01', equipmentName: '레이저 절단기 3kW', type: '예방보전', scheduledDate: '2026-09-20', completedDate: '2026-09-20', result: '정상', note: '렌즈 세정 및 교정' },
    { id: 'MN-2609-003', equipmentId: 'EQ-INJ-01', equipmentName: '사출기 200T', type: '예방보전', scheduledDate: '2026-09-05', completedDate: '2026-09-05', result: '정상', note: '오일 교환' },
    { id: 'MN-2610-004', equipmentId: 'EQ-WLD-01', equipmentName: '용접 로봇', type: '정기점검', scheduledDate: '2026-10-15', completedDate: '', result: '점검 예정', note: '토치 점검' },
    { id: 'MN-2608-005', equipmentId: 'EQ-PRS-01', equipmentName: '프레스 200T', type: '예방보전', scheduledDate: '2026-08-15', completedDate: '2026-08-15', result: '정상', note: '금구 조정' },
    { id: 'MN-2608-006', equipmentId: 'EQ-CUT-01', equipmentName: '레이저 절단기 3kW', type: '고장수리', scheduledDate: '2026-08-02', completedDate: '2026-08-03', result: '수리 완료', note: '콜드 스타트 고장' },
]

export const seedSubcontracts: Subcontract[] = [
    { id: 'SC-2610-001', vendor: '정연 용접', item: '샤시 브라켓 B', process: '연마', qty: 300, unitPrice: 4500, amount: 1350000, dueDate: '2026-10-08', status: '반입완료' },
    { id: 'SC-2610-002', vendor: '정연 용접', item: '용접 서브 어셈블리', process: '용접', qty: 240, unitPrice: 12000, amount: 2880000, dueDate: '2026-09-30', status: '정산완료' },
    { id: 'SC-2610-003', vendor: '정연 용접', item: '프레임 가조립품 A', process: '도장', qty: 120, unitPrice: 8500, amount: 1020000, dueDate: '2026-10-05', status: '진행중' },
    { id: 'SC-2610-004', vendor: '정연 용접', item: '커버 몸체 C', process: '연마', qty: 80, unitPrice: 4000, amount: 320000, dueDate: '2026-10-12', status: '반출' },
    { id: 'SC-2610-005', vendor: '정연 용접', item: '지지대 플레이트', process: '절단', qty: 450, unitPrice: 3200, amount: 1440000, dueDate: '2026-10-18', status: '반출' },
]

// ============================================================
// 출하
// ============================================================

export const seedShipments: Shipment[] = [
    { id: 'SH-2610-001', salesOrder: 'SO-2609-005', customer: '동방산업', item: '지지대 플레이트', qty: 450, deliveryDate: '2026-10-18', vehicle: '화물차 25T', status: '출하완료', amount: 11250000 },
    { id: 'SH-2610-002', salesOrder: 'SO-2609-002', customer: '한솔테크', item: '샤시 브라켓 B', qty: 300, deliveryDate: '2026-10-08', vehicle: '화물차 5T', status: '출하완료', amount: 9750000 },
    { id: 'SH-2610-003', salesOrder: 'SO-2609-001', customer: '주식회사 대영', item: '프레임 가조립품 A', qty: 120, deliveryDate: '2026-10-05', vehicle: '화물차 11T', status: '배차', amount: 18360000 },
    { id: 'SH-2610-004', salesOrder: 'SO-2609-006', customer: '한솔테크', item: '샤시 브라켓 B', qty: 150, deliveryDate: '2026-10-20', vehicle: '', status: '지시', amount: 4875000 },
]

// ============================================================
// 회계·원가 (원가는 작업오더 완료 시 자동 생성)
// ============================================================

export const seedCosts = [
    { id: 'CST-2610-002', order: 'WO-2610-002', item: '샤시 브라켓 B', material: 6240000, labor: 1560000, overhead: 780000, subcontract: 1350000, total: 9930000, standard: 10200000, diff: -270000 },
    { id: 'CST-2610-005', order: 'WO-2610-005', item: '용접 서브 어셈블리', material: 6624000, labor: 2880000, overhead: 1152000, subcontract: 2880000, total: 13536000, standard: 13000000, diff: 536000 },
] as { id: string; order: string; item: string; material: number; labor: number; overhead: number; subcontract: number; total: number; standard: number; diff: number }[]

export const seedLedger: LedgerEntry[] = [
    { id: 'LE-2610-001', date: '2026-10-07', account: '매입원가', description: 'PO-2610-003 ABS 펠릿 800kg', type: '출금', amount: 2080000 },
    { id: 'LE-2610-002', date: '2026-10-06', account: '외주비', description: 'SC-2610-002 용접 서브 어셈블리', type: '출금', amount: 2880000 },
    { id: 'LE-2610-003', date: '2026-10-05', account: '매출액', description: 'SO-2609-005 지지대 플레이트 450EA', type: '입금', amount: 11250000 },
    { id: 'LE-2610-004', date: '2026-10-04', account: '매입원가', description: 'PO-2610-001 강판 3.0mm 200SHT', type: '출금', amount: 15600000 },
]

// ============================================================
// 게시판
// ============================================================

export const seedNotices: Notice[] = [
    { id: 'NT-2610-001', title: '2026년 10월 생산계획 확정 안내', author: '박생관', target: '전체', views: 42, date: '2026-10-01' },
    { id: 'NT-2610-002', title: 'EQ-PRS-01 프레스 200T 고장 수리 중', author: '박생관', target: '생산', views: 28, date: '2026-10-06' },
    { id: 'NT-2609-003', title: '9월 정기 안전 점검 결과', author: '정품질', target: '전체', views: 65, date: '2026-09-25' },
    { id: 'NT-2609-004', title: 'ABS 펠릿 단가 인상 안내', author: '최자재', target: '구매', views: 31, date: '2026-09-18' },
    { id: 'NT-2609-005', title: '추석 연휴 출입 통제 안내', author: '김대표', target: '전체', views: 88, date: '2026-09-12' },
]

export const seedNotifies: Notify[] = [
    { id: 'NF-2610-001', type: '자재 부족', target: '자재팀', title: 'ABS 펠릿 안전재고 미달', channel: 'LMS', sentAt: '2026-10-07 09:12', status: '발송성공' },
    { id: 'NF-2610-002', type: '납기 지연', target: '영업팀', title: 'WO-2610-003 납기 지연 위험', channel: '이메일', sentAt: '2026-10-06 17:40', status: '발송성공' },
    { id: 'NF-2610-003', type: '설비 고장', target: '생산팀', title: 'EQ-PRS-01 가동 중단', channel: 'LMS', sentAt: '2026-10-06 08:05', status: '발송성공' },
    { id: 'NF-2609-004', type: '불량 급증', target: '품질팀', title: '용접 공정 불량률 임계 초과', channel: '이메일', sentAt: '2026-09-30 11:20', status: '발송성공' },
    { id: 'NF-2609-005', type: '결산 대기', target: '회계팀', title: '9월 결산 자료 입력 요청', channel: '이메일', sentAt: '2026-09-30 16:00', status: '발송실패' },
]
