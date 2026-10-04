import assert from 'node:assert/strict'
import { test } from 'node:test'
import openapiTS, { astToString } from 'openapi-typescript'
import { generatorArgs } from './generate-api-types.mjs'

const schema = properties => ({
    openapi: '3.0.3', info: { title: 'Order stability regression', version: '1' }, paths: {},
    components: { schemas: { Page: { type: 'object', properties, required: ['qty'] } } },
})
const generate = async properties => astToString(await openapiTS(schema(properties), {
    alphabetize: generatorArgs('input.json', 'output.ts').includes('--alphabetize'),
}))

test('the production generator requests stable alphabetic ordering', () => {
    assert.deepEqual(generatorArgs('input.json', 'output.ts').slice(1),
        ['input.json', '--alphabetize', '--output', 'output.ts'])
})

test('identical schema with reordered Page and nested Pageable properties generates identical types', async () => {
    const first = await generate({
        last: { type: 'boolean' }, qty: { type: 'number' }, first: { type: 'boolean' },
        pageable: { type: 'object', properties: { unpaged: { type: 'boolean' }, paged: { type: 'boolean' } } },
    })
    const reordered = await generate({
        first: { type: 'boolean' }, pageable: { type: 'object', properties: { paged: { type: 'boolean' }, unpaged: { type: 'boolean' } } },
        qty: { type: 'number' }, last: { type: 'boolean' },
    })
    assert.equal(first, reordered)
})

test('actual property type changes still produce drift', async () => {
    const original = await generate({ qty: { type: 'number' } })
    const changed = await generate({ qty: { type: 'string' } })
    assert.notEqual(original, changed)
    assert.match(original, /qty: number/)
    assert.match(changed, /qty: string/)
})
