import DataTable, { DataTableColumn } from '../../components/common/DataTable'

interface RoutingRow {
    id: string
    item: string
    seq: number
    process: string
    workCenter: string
    stdTime: number
    isSubcontract: string
}

const routings: RoutingRow[] = [
    { id: 'RT-A001-10', item: '프레임 가조립품 A', seq: 10, process: '절단', workCenter: 'WC-CUT-01', stdTime: 0.5, isSubcontract: '자체' },
    { id: 'RT-A001-20', item: '프레임 가조립품 A', seq: 20, process: '용접', workCenter: 'WC-WLD-02', stdTime: 1.2, isSubcontract: '자체' },
    { id: 'RT-A001-30', item: '프레임 가조립품 A', seq: 30, process: '도장', workCenter: 'WC-OUT-01', stdTime: 0.8, isSubcontract: '외주' },
    { id: 'RT-B002-10', item: '샤시 브라켓 B', seq: 10, process: '프레스', workCenter: 'WC-PRS-01', stdTime: 0.3, isSubcontract: '자체' },
    { id: 'RT-B002-20', item: '샤시 브라켓 B', seq: 20, process: '용접', workCenter: 'WC-WLD-01', stdTime: 0.6, isSubcontract: '자체' },
    { id: 'RT-C003-10', item: '커버 몸체 C', seq: 10, process: '사출', workCenter: 'WC-INJ-03', stdTime: 0.4, isSubcontract: '자체' },
    { id: 'RT-C003-20', item: '커버 몸체 C', seq: 20, process: '검사', workCenter: 'WC-QC-01', stdTime: 0.2, isSubcontract: '자체' },
    { id: 'RT-D004-10', item: '지지대 플레이트', seq: 10, process: '레이저절단', workCenter: 'WC-CUT-02', stdTime: 0.7, isSubcontract: '자체' },
    { id: 'RT-D004-20', item: '지지대 플레이트', seq: 20, process: '용접', workCenter: 'WC-WLD-02', stdTime: 0.9, isSubcontract: '자체' },
]

const ProductionRouting = () => {
    const columns: DataTableColumn<RoutingRow>[] = [
        { key: 'id', label: '공정ID', render: row => <span className="font-mono text-hud-accent-primary">{row.id}</span> },
        { key: 'item', label: '품목', render: row => <span className="text-hud-text-primary">{row.item}</span> },
        { key: 'seq', label: '순서', render: row => <span className="font-mono">{row.seq}</span> },
        { key: 'process', label: '공정명' },
        { key: 'workCenter', label: '작업장', render: row => <span className="font-mono text-hud-text-secondary">{row.workCenter}</span> },
        { key: 'stdTime', label: '표준시간(h)', render: row => <span className="font-mono">{row.stdTime.toFixed(1)}</span> },
        { key: 'isSubcontract', label: '외주여부', render: row => (
            <span className={`text-xs ${row.isSubcontract === '외주' ? 'text-hud-accent-warning' : 'text-hud-text-muted'}`}>{row.isSubcontract}</span>
        ) },
    ]

    return (
        <DataTable<RoutingRow>
            title="공정 현황"
            subtitle="제품별 공정 순서, 작업장, 표준시간을 관리합니다."
            columns={columns}
            data={routings}
            rowKey="id"
            searchPlaceholder="공정ID, 품목, 공정명 검색..."
        />
    )
}

export default ProductionRouting
