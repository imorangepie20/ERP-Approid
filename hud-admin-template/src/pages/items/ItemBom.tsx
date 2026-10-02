import { createBom, deleteBom, fetchBomPage, updateBom, type BomRow } from '../../api/boms'
import MasterDataPage from '../../components/common/MasterDataPage'

export default function ItemBom() {
    return <MasterDataPage<BomRow> resource="boms" title="BOM 관리" name="BOM"
        subtitle="모품목 1단위당 소요량 · 손실률(%) · 대체자재 품번을 관리합니다."
        code={row => row.bomNo} defaultSort="bomNo" filterLabel="모품목 필터"
        initialValues={{ bomNo: '', parentId: '', childId: '', qty: '1', lossRate: '0', substituteNo: '' }}
        toValues={row => ({ bomNo: row.bomNo, parentId: String(row.parentId), childId: String(row.childId),
            qty: String(row.qty), lossRate: String(row.lossRate), substituteNo: row.substituteNo })}
        fields={(editing, items) => [
            { key: 'bomNo', label: 'BOM 번호', type: 'text', required: true, maxLength: 32, readOnly: editing },
            { key: 'parentId', label: '모품목', type: 'select', required: true, readOnly: editing,
                options: items.filter(i => i.itemType !== '자재').map(i => ({ label: `${i.itemNo} · ${i.name}`, value: i.id })) },
            { key: 'childId', label: '자품목', type: 'select', required: true, readOnly: editing,
                options: items.map(i => ({ label: `${i.itemNo} · ${i.name} (${i.unit})`, value: i.id })) },
            { key: 'qty', label: '소요량', type: 'number', required: true, min: 0.0001, step: 0.0001 },
            { key: 'lossRate', label: '손실률(%)', type: 'number', min: 0, step: 0.01 },
            { key: 'substituteNo', label: '대체자재 품번', type: 'text', maxLength: 32 },
        ]}
        columns={[
            { key: 'bomNo', label: 'BOM 번호' },
            { key: 'parentItemNo', label: '모품목', render: r => <>{r.parentItemNo} · {r.parentName}</> },
            { key: 'childItemNo', label: '자품목', render: r => <>{r.childItemNo} · {r.childName}</> },
            { key: 'qty', label: '소요량', render: r => <>{r.qty} {r.childUnit}</> },
            { key: 'lossRate', label: '손실률', render: r => <>{r.lossRate}%</> },
            { key: 'childType', label: '유형', sortable: false },
            { key: 'substituteNo', label: '대체자재', render: r => r.substituteNo || '-' },
        ]}
        sortColumns={{ bomNo: 'bomNo', parentItemNo: 'parent.itemNo', childItemNo: 'child.itemNo',
            qty: 'qty', lossRate: 'lossRate', substituteNo: 'substituteNo' }}
        fetchPage={fetchBomPage} remove={deleteBom}
        save={(client, row, v) => {
            const input = { qty: Number(v.qty), lossRate: Number(v.lossRate || 0), substituteNo: v.substituteNo.trim() }
            return row ? updateBom(client, row.id, input)
                : createBom(client, { ...input, bomNo: v.bomNo.trim(), parentId: Number(v.parentId), childId: Number(v.childId) })
        }} />
}
