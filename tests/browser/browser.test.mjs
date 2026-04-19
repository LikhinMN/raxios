import { describe, it, expect } from 'vitest'
import raxios from '../../raxios.browser.js'

const describeIf = typeof fetch === 'function' ? describe : describe.skip

describeIf('browser entrypoint (fetch dispatcher)', () => {
  it('GET returns JSON data', async () => {
    const res = await raxios.get('https://httpbin.org/get')
    expect(res.status).toBe(200)
    expect(res.data.url).toContain('https://httpbin.org/get')
  })

  it('POST sends JSON body', async () => {
    const res = await raxios.post('https://httpbin.org/post', { name: 'raxios' })
    expect(res.status).toBe(200)
    expect(res.data.json).toEqual({ name: 'raxios' })
  })

  it('baseURL + params build the URL', async () => {
    const api = raxios.create({ baseURL: 'https://httpbin.org' })
    const res = await api.get('/get', { params: { page: 1 } })
    expect(res.status).toBe(200)
    expect(res.data.args.page).toBe('1')
  })

  it('arraybuffer responseType returns ArrayBuffer', async () => {
    const res = await raxios.get('https://httpbin.org/bytes/8', {
      responseType: 'arraybuffer'
    })
    expect(res.data).toBeInstanceOf(ArrayBuffer)
    expect(res.data.byteLength).toBe(8)
  })

  it('bytes responseType returns Uint8Array', async () => {
    const res = await raxios.get('https://httpbin.org/bytes/8', {
      responseType: 'bytes'
    })
    expect(res.data).toBeInstanceOf(Uint8Array)
    expect(res.data.length).toBe(8)
  })

  it('blob responseType returns Blob when available', async () => {
    if (typeof Blob !== 'function') {
      return
    }
    const res = await raxios.get('https://httpbin.org/image/png', {
      responseType: 'blob'
    })
    expect(res.data).toBeInstanceOf(Blob)
  })

  it('non-2xx responses throw with status and response', async () => {
    expect.assertions(3)
    try {
      await raxios.get('https://httpbin.org/status/404')
    } catch (err) {
      expect(err.isRaxiosError).toBe(true)
      expect(err.status).toBe(404)
      expect(err.response.status).toBe(404)
    }
  })

  it('AbortController cancels requests', async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 50)
    expect.assertions(1)
    try {
      await raxios.get('https://httpbin.org/delay/3', {
        signal: controller.signal
      })
    } catch (err) {
      expect(err.code).toBe('ERR_CANCELED')
    } finally {
      clearTimeout(timer)
    }
  })

  it('timeout rejects with ECONNABORTED', async () => {
    expect.assertions(1)
    try {
      await raxios.get('https://httpbin.org/delay/3', { timeout: 50 })
    } catch (err) {
      expect(err.code).toBe('ECONNABORTED')
    }
  })
})

