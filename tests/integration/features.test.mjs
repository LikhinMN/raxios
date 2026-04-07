import { describe, it, expect } from 'vitest'
import raxios from '../../raxios.js'

describe('feature coverage', () => {
  it('resolves baseURL + url', async () => {
    const api = raxios.create({ baseURL: 'https://httpbin.org' })
    const res = await api.get('/get')
    expect(res.config.url).toBe('https://httpbin.org/get')
  })

  it('serializes params into query string', async () => {
    const api = raxios.create({ baseURL: 'https://httpbin.org' })
    const res = await api.get('/get', { params: { foo: 'bar', baz: 123 } })
    expect(res.data.args.foo).toBe('bar')
    expect(res.data.args.baz).toBe('123')
  })

  it('auto-sets Content-Type for JSON bodies', async () => {
    const api = raxios.create({ baseURL: 'https://httpbin.org' })
    const res = await api.post('/post', { foo: 'bar' })
    expect(res.data.headers['Content-Type']).toBe('application/json')
  })

  it('runs transformRequest chain', async () => {
    const res = await raxios.post('https://httpbin.org/post', { foo: 'bar' }, {
      transformRequest: [
        (data) => {
          data.transformed = true
          return data
        },
        (data) => JSON.stringify(data)
      ]
    })
    expect(res.data.json.transformed).toBe(true)
  })

  it('runs transformResponse chain', async () => {
    const api = raxios.create({ baseURL: 'https://httpbin.org' })
    const res = await api.get('/get', {
      transformResponse: [(data) => {
        data.transformed = true
        return data
      }]
    })
    expect(res.data.transformed).toBe(true)
  })

  it('times out requests', async () => {
    const api = raxios.create({ baseURL: 'https://httpbin.org' })
    try {
      await api.get('/delay/2', { timeout: 1000 })
      throw new Error('Expected timeout')
    } catch (err) {
      expect(err.message.includes('timeout') || err.code === 'ECONNABORTED').toBe(true)
    }
  })

  it('respects defaults.headers.common', async () => {
    const api = raxios.create({ headers: { common: {} } })
    api.defaults.headers.common['X-Common'] = 'common-value'
    const res = await api.get('https://httpbin.org/headers')
    expect(res.data.headers['X-Common']).toBe('common-value')
  })

  it('supports instance invocation with url', async () => {
    const api = raxios.create({ baseURL: 'https://httpbin.org' })
    const res = await api('/get')
    expect(res.config.url).toBe('https://httpbin.org/get')
  })

  it('supports all() and spread()', async () => {
    const api = raxios.create({ baseURL: 'https://httpbin.org' })
    const [res1, res2] = await raxios.all([
      api.get('/get?id=1'),
      api.get('/get?id=2')
    ])
    expect(res1.data.args.id).toBe('1')
    expect(res2.data.args.id).toBe('2')

    const spreadResult = raxios.spread((a, b) => {
      return a.data.args.id + b.data.args.id
    })([res1, res2])

    expect(spreadResult).toBe('12')
  })
})

