import { describe, it, expect } from 'vitest'
import raxios from '../../raxios.js'

describe('binary error handling', () => {
  it('surfaces status and response data on 404', async () => {
    try {
      await raxios.get('https://httpbin.org/status/404', {
        responseType: 'arraybuffer'
      })
      throw new Error('Expected request to fail')
    } catch (err) {
      expect(err.isRaxiosError).toBe(true)
      expect(err.status).toBe(404)
      expect(err.response).toBeDefined()
    }
  })
})

