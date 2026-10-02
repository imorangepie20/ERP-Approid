import { createRouting, deleteRouting, fetchRoutingPage, updateRouting, type RoutingRow } from '../../api/routings'
import MasterDataPage from '../../components/common/MasterDataPage'

export default function ProductionRouting() {
    return <MasterDataPage<RoutingRow> resource="routings" title="공정 라우팅" name="공정"
        subtitle="품목별 공정 순서 · 작업장 · 1단위당 표준시간(h) · 외주 여부를 관리합니다."
        code={row => row.routingNo} defaultSort="routingNo" filterLabel="공정 품목 필터"
        initialValues={{ routingNo: '', itemId: '', seq: '10', process: '', workCenter: '', stdTime: '0', isSubcontract: 'false' }}
        toValues={r => ({ routingNo: r.routingNo, itemId: String(r.itemId), seq: String(r.seq),
            process: r.process, workCenter: r.workCenter, stdTime: String(r.stdTime), isSubcontract: String(r.isSubcontract) })}
        fields={(editing, items) => [
            { key: 'routingNo', label: '공정 번호', type: 'text', required: true, maxLength: 32, readOnly: editing },
            { key: 'itemId', label: '품목', type: 'select', required: true, readOnly: editing,
                options: items.filter(i => i.itemType !== '자재').map(i => ({ label: `${i.itemNo} · ${i.name}`, value: i.id })) },
            { key: 'seq', label: '공정 순서', type: 'number', required: true, min: 1, step: 1 },
            { key: 'process', label: '공정명', type: 'text', required: true, maxLength: 64 },
            { key: 'workCenter', label: '작업장', type: 'text', required: true, maxLength: 32 },
            { key: 'stdTime', label: '표준시간(h)', type: 'number', min: 0, step: 0.001 },
            { key: 'isSubcontract', label: '외주 여부', type: 'select', required: true,
                options: [{ label: '자체', value: 'false' }, { label: '외주', value: 'true' }] },
        ]}
        columns={[
            { key: 'routingNo', label: '공정 번호' },
            { key: 'itemNo', label: '품목', render: r => <>{r.itemNo} · {r.itemName}</> },
            { key: 'seq', label: '순서' }, { key: 'process', label: '공정명' },
            { key: 'workCenter', label: '작업장' }, { key: 'stdTime', label: '표준시간(h)' },
            { key: 'isSubcontract', label: '외주 여부', render: r => r.isSubcontract ? '외주' : '자체' },
        ]}
        sortColumns={{ routingNo: 'routingNo', itemNo: 'item.itemNo', seq: 'seq', process: 'process',
            workCenter: 'workCenter', stdTime: 'stdTime', isSubcontract: 'isSubcontract' }}
        fetchPage={fetchRoutingPage} remove={deleteRouting}
        save={(client, row, v) => {
            const input = { seq: Number(v.seq), process: v.process.trim(), workCenter: v.workCenter.trim(),
                stdTime: Number(v.stdTime || 0), isSubcontract: v.isSubcontract === 'true' }
            return row ? updateRouting(client, row.id, input)
                : createRouting(client, { ...input, routingNo: v.routingNo.trim(), itemId: Number(v.itemId) })
        }} />
}
