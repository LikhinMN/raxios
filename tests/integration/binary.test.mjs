import { describe, it, expect } from 'vitest'
import raxios from '../../raxios.js'

describe('binary responses', () => {
  it('downloads an image as Buffer', async () => {
    const res = await raxios.get('https://httpbin.org/image/png', {
      responseType: 'arraybuffer'
    })

    expect(res.status).toBe(200)
    expect(Buffer.isBuffer(res.data)).toBe(true)
    expect(res.data.length).toBeGreaterThan(0)
  })

  it('text responses still parse JSON', async () => {
    const res = await raxios.get('https://httpbin.org/get')
    expect(res.status).toBe(200)
    expect(typeof res.data).toBe('object')
  })
})

