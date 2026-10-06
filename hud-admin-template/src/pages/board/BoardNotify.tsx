import { Send } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import StatusBadge, { StatusTone } from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'

interface NotifyRow {
    id: string
    type: string
    target: string
    title: string
    channel: string
    sentAt: string
    status: string
}

const notifications: NotifyRow[] = [
    { id: 'NT-001', type: '납기지연위험', target: '영업팀', title: 'WO-2610-003 납기 지연 위험', channel: 'LMS', sentAt: '2026-10-05 09:12', status: '발송성공' },
    { id: 'NT-002', type: '자재부족', target: '자재팀', title: 'ABS 펠릿 안전재고 미달', channel: '문자', sentAt: '2026-10-04 16:40', status: '발송성공' },
    { id: 'NT-003', type: '설비고장', target: '생산부서', title: '프레스 200T 고장 접수', channel: '이메일', sentAt: '2026-09-28 11:05', status: '발송성공' },
    { id: 'NT-004', type: '미납독촉', target: '주식회사 대영', title: 'AR-001 수납 독촉', channel: '이메일', sentAt: '2026-09-20 14:30', status: '발송실패' },
    { id: 'NT-005', type: '불량급증', target: '품질팀', title: '용접불량률 급증 경고', channel: 'LMS', sentAt: '2026-10-05 18:22', status: '예약' },
]

const statusToneMap: Record<string, StatusTone> = {
    '발송성공': 'success',
    '발송실패': 'danger',
    '예약': 'warning',
}

const BoardNotify = () => {
    const columns: DataTableColumn<NotifyRow>[] = [
        { key: 'id', label: '알림ID', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'type', label: '알림유형' },
        { key: 'target', label: '수신대상' },
        { key: 'title', label: '제목', render: row => <span className="text-hud-text-primary">{row.title}</span> },
        { key: 'channel', label: '채널' },
        { key: 'sentAt', label: '발송시각' },
        { key: 'status', label: '결과', render: row => <StatusBadge tone={statusToneMap[row.status] ?? 'muted'}>{row.status}</StatusBadge> },
    ]

    return (
        <DataTable<NotifyRow>
            title="알림 발송"
            subtitle="현장/관리자 알림 발송 이력과 템플릿을 관리합니다."
            columns={columns}
            data={notifications}
            rowKey="id"
            searchPlaceholder="알림ID, 유형, 제목 검색..."
            toolbar={<Button variant="primary" glow leftIcon={<Send size={18} />} disabled title="준비 중">알림 발송</Button>}
        />
    )
}

export default BoardNotify
