import { describe, it, expect } from 'vitest'
import raxios from '../../raxios.js'

describe('interceptors', () => {
  it('runs request and response interceptors', async () => {
    const api = raxios.create({ baseURL: 'https://httpbin.org' })
    let responseSeen = false

    const requestId = api.interceptors.request.use(config => {
      config.headers = { ...config.headers, 'X-Intercepted': 'yes' }
      return config
    })

    const responseId = api.interceptors.response.use(response => {
      responseSeen = true
      return response
    })

    const res = await api.get('/headers')
    expect(res.data.headers['X-Intercepted']).toBe('yes')
    expect(responseSeen).toBe(true)

    api.interceptors.request.eject(requestId)
    api.interceptors.response.eject(responseId)
  })
})

