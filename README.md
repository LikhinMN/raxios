# Raxios

Raxios is a Node.js HTTP client built with Rust + NAPI-RS. It wraps `reqwest` and exposes an axios-like JavaScript API with interceptors, transforms, and binary response support.

## Install

```bash
npm install @likhinmn/raxios
```

## Quick start

ESM:

```js
import raxios from '@likhinmn/raxios'

const res = await raxios.get('https://httpbin.org/get')
console.log(res.status)
console.log(res.data)
```

CommonJS:

```js
const raxios = require('@likhinmn/raxios')

const res = await raxios.get('https://httpbin.org/get')
console.log(res.status)
console.log(res.data)
```

## Common usage

```js
const api = raxios.create({ baseURL: 'https://httpbin.org' })

// Query params
const res = await api.get('/get', { params: { foo: 'bar' } })

// JSON body
await api.post('/post', { name: 'raxios' })

// Custom headers
await api.get('/headers', { headers: { 'X-Custom-Header': 'raxios' } })
```

## Binary downloads

```js
const res = await raxios.get('https://httpbin.org/image/png', {
  responseType: 'arraybuffer'
})

// res.data is a Buffer
console.log(Buffer.isBuffer(res.data), res.data.length)
```

Supported binary `responseType` values: `arraybuffer`, `buffer`, `blob`, `bytes`.

## Interceptors

```js
const api = raxios.create()

api.interceptors.request.use(config => {
  config.headers = { ...config.headers, 'X-Intercepted': 'yes' }
  return config
})

api.interceptors.response.use(response => {
  return response
})
```

## Error handling

```js
try {
  await raxios.get('https://httpbin.org/status/404')
} catch (err) {
  if (raxios.isRaxiosError(err)) {
    console.log(err.status)
    console.log(err.response?.data)
  }
}
```

## Build

```bash
npm run build
npm run build:debug
```

## Test

```bash
npm test
```

Tests live under `tests/integration` and call real HTTP endpoints (httpbin.org, jsonplaceholder.typicode.com).
