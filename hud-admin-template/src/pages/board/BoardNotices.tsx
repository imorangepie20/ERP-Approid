import { Plus } from 'lucide-react'
import DataTable, { DataTableColumn } from '../../components/common/DataTable'
import Button from '../../components/common/Button'

interface NoticeRow {
    id: string
    title: string
    author: string
    target: string
    views: number
    date: string
}

const notices: NoticeRow[] = [
    { id: 'N-001', title: '[긴급] 프레스 200T 고장 복구 완료 안내', author: '박생산', target: '전체', views: 48, date: '2026-09-30' },
    { id: 'N-002', title: '2026년 10월 생산계획 배포', author: '박생산', target: '생산부서', views: 32, date: '2026-09-28' },
    { id: 'N-003', title: 'ABS 펠릿 이물혼입으로 인한 Lot 보류 조치', author: '윤품질', target: '전체', views: 65, date: '2026-10-04' },
    { id: 'N-004', title: '추석 연휴 기간 자재 입출고 중단 안내', author: '강자재', target: '전체', views: 91, date: '2026-09-12' },
    { id: 'N-005', title: '용접 로봇 #1 정기점검 일정 안내', author: '박생산', target: '생산1팀', views: 21, date: '2026-09-14' },
]

const BoardNotices = () => {
    const columns: DataTableColumn<NoticeRow>[] = [
        { key: 'id', label: '번호', render: row => <span className="font-mono text-hud-text-muted">{row.id}</span> },
        { key: 'title', label: '제목', render: row => <span className="text-hud-text-primary">{row.title}</span> },
        { key: 'author', label: '작성자' },
        { key: 'target', label: '대상' },
        { key: 'views', label: '조회수', render: row => <span className="font-mono">{row.views.toLocaleString()}</span> },
        { key: 'date', label: '등록일' },
    ]

    return (
        <DataTable<NoticeRow>
            title="공지사항"
            subtitle="전체/공장/부서별 공지와 알림을 관리합니다."
            columns={columns}
            data={notices}
            rowKey="id"
            searchPlaceholder="제목, 작성자 검색..."
            toolbar={<Button variant="primary" glow leftIcon={<Plus size={18} />} disabled title="준비 중">공지 등록</Button>}
        />
    )
}

export default BoardNotices
