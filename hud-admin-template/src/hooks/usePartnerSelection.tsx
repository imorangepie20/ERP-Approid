import { useQuery } from '@tanstack/react-query'
import { fetchPartnerOptions, type PartnerType } from '../api/partners'
import { useAuth } from '../auth/AuthContext'
import { AsyncState } from '../components/common/AsyncState'
import type { ModalField } from '../components/common/FormModal'

export function dateAfterDays(days: number, base = new Date()): string {
    const date = new Date(base)
    date.setDate(date.getDate() + days)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function usePartnerSelection(partnerType: PartnerType) {
    const { core } = useAuth()
    const query = useQuery({ queryKey: ['partners', 'options', partnerType],
        queryFn: ({ signal }) => fetchPartnerOptions(core, partnerType, signal) })
    const partners = query.data ?? []
    const ready = query.isSuccess && !query.isFetching && partners.length > 0

    const find = (id: string) => partners.find(partner => String(partner.id) === id)
    const field = (key: string, label: string, suggestDueDate = false): ModalField => ({
        key, label, type: 'select', required: true,
        options: partners.map(partner => ({ label: `${partner.partnerNo} · ${partner.name}`, value: partner.id })),
        onChange: (id, setField) => {
            const partner = find(id)
            if (!partner) return
            setField('paymentTerms', partner.paymentTerms)
            setField('leadTimeDays', partner.leadTimeDays)
            if (suggestDueDate) setField('dueDate', dateAfterDays(partner.leadTimeDays))
        },
    })
    // Existing prototype documents store names; resolve them only when opening an edit form.
    const toValues = (record: object, key: string, name: string): Record<string, string> => {
        const values = Object.fromEntries(Object.entries(record).map(([k, v]) => [k, v == null ? '' : String(v)]))
        const partner = values[key] ? find(values[key]) : partners.find(p => p.name === name)
        values[key] = partner ? String(partner.id) : ''
        values.paymentTerms = values.paymentTerms || String(partner?.paymentTerms ?? '')
        values.leadTimeDays = values.leadTimeDays || String(partner?.leadTimeDays ?? '')
        return values
    }
    const termsFields: ModalField[] = [
        { key: 'paymentTerms', label: '결제조건(일)', type: 'number', readOnly: true },
        { key: 'leadTimeDays', label: '리드타임(일)', type: 'number', readOnly: true },
    ]
    const status = <AsyncState isLoading={query.isPending} error={query.error}
        isEmpty={query.isSuccess && partners.length === 0}
        loadingMessage="거래처를 불러오는 중..." emptyMessage="선택할 거래처가 없습니다. 거래처 마스터에서 등록하세요."
        onRetry={() => { void query.refetch() }} />

    return { partners, ready, find, field, termsFields, toValues, status }
}
