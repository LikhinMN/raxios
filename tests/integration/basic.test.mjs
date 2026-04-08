import { describe, it, expect } from 'vitest'
import raxios from '../../raxios.js'

describe('basic requests', () => {
  it('GET returns JSON data', async () => {
    const res = await raxios.get('https://httpbin.org/get')
    expect(res.status).toBe(200)
    expect(res.data.url).toContain('https://httpbin.org/get')
  })

  it('GET works with jsonplaceholder', async () => {
    const res = await raxios.get('https://jsonplaceholder.typicode.com/todos/1')
    expect(res.status).toBe(200)
    expect(res.data).toHaveProperty('id', 1)
  })

  it('POST sends JSON body', async () => {
    const res = await raxios.post('https://httpbin.org/post', { name: 'likhin' })
    expect(res.status).toBe(200)
    expect(res.data.json).toEqual({ name: 'likhin' })
  })

  it('passes custom headers', async () => {
    const res = await raxios.get('https://httpbin.org/headers', {
      headers: { 'X-Custom-Header': 'raxios' }
    })
    expect(res.data.headers['X-Custom-Header']).toBe('raxios')
  })

  it('create() returns a client instance', async () => {
    const api = raxios.create({ baseURL: 'https://httpbin.org' })
    expect(typeof api.get).toBe('function')
    const res = await api.get('/get')
    expect(res.status).toBe(200)
  })

  it('request(config) sends a request', async () => {
    const res = await raxios.request({
      method: 'GET',
      url: 'https://httpbin.org/get'
    })
    expect(res.status).toBe(200)
    expect(res.data.url).toContain('https://httpbin.org/get')
  })
})
