# @likhinmn/raxios

Fast, axios-compatible HTTP client for Node.js built on Rust.

Raxios wraps `reqwest` via NAPI-RS and exposes an axios-like API with a Rust-powered HTTP core.

```bash
npm install @likhinmn/raxios
```

Supported platforms: Linux x64, Windows x64, macOS x64, macOS arm64.

## Table of Contents

- [Quick Start](#quick-start)
- [API Overview](#api-overview)
- [Request Config](#request-config)
- [Response Object](#response-object)
- [Instances and Defaults](#instances-and-defaults)
- [Interceptors](#interceptors)
- [Transforms](#transforms)
- [Error Handling](#error-handling)
- [Binary Responses](#binary-responses)
- [Concurrency Helpers](#concurrency-helpers)
- [TypeScript](#typescript)
- [Compatibility Notes](#compatibility-notes)

## Quick Start

```js
// ESM
import raxios from '@likhinmn/raxios'

// CommonJS
const raxios = require('@likhinmn/raxios')

const res = await raxios.get('https://api.example.com/users')
console.log(res.status)
console.log(res.data)
```

## API Overview

Raxios exposes a callable instance with axios-style helpers:

- `raxios(config)` or `raxios.request(config)`
- `raxios.get(url, config)`
- `raxios.post(url, data, config)`
- `raxios.put(url, data, config)`
- `raxios.patch(url, data, config)`
- `raxios.delete(url, config)`
- `raxios.head(url, config)`
- `raxios.options(url, config)`
- `raxios.create(config)`

Note: `raxios(config)` and `raxios.request(config)` currently default to `GET` and do not honor a custom `method`. Use the method helpers for non-GET requests.

Examples:

```js
const users = await raxios.get('https://api.example.com/users')

const created = await raxios.post('https://api.example.com/users', {
  name: 'Likhin',
  email: 'likhin@example.com'
})

const removed = await raxios.delete('https://api.example.com/users/1')

const head = await raxios.head('https://api.example.com/users/1')
const options = await raxios.options('https://api.example.com/users')

const byConfig = await raxios.request({
  method: 'GET',
  url: 'https://api.example.com/users',
  params: { page: 1, limit: 10 }
})
```

## Request Config

```js
{
  url: 'https://api.example.com/users',
  method: 'POST',
  baseURL: 'https://api.example.com',
  headers: {
    Authorization: 'Bearer token',
    'X-Custom-Header': 'value'
  },
  params: {
    page: 1,
    limit: 10
  },
  data: {
    name: 'Likhin'
  },
  timeout: 5000,
  responseType: 'arraybuffer',
  signal: abortController.signal,
  transformRequest: [(data, headers) => data],
  transformResponse: [(data) => data]
}
```

Notes:
- Objects are JSON-serialized before the native call. If no `Content-Type` header is provided, `application/json` is set automatically.
- `baseURL` is prepended when `url` is relative.
- `params` are URL-encoded and appended to the final URL.
- `signal` supports AbortController. Aborted requests reject with `code: 'ERR_CANCELED'` and `isRaxiosError: true`.

## Response Object

```js
const res = await raxios.get('https://api.example.com/users/1')

res.data
res.status
res.headers
res.config
```

## Instances and Defaults

```js
const api = raxios.create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    Authorization: `Bearer ${process.env.API_TOKEN}`,
    Accept: 'application/json'
  }
})

const users = await api.get('/users')
const user = await api.get('/users/1')
const res = await api.post('/users', { name: 'Likhin' })
```

Set defaults on the global instance or per instance:

```js
raxios.defaults.headers.common.Authorization = `Bearer ${token}`
raxios.defaults.timeout = 5000

const api = raxios.create({ baseURL: 'https://api.example.com' })
api.defaults.headers.common['X-App-Version'] = '1.0.0'
```

Header merge order (highest priority wins):

```
raxios.defaults.headers.common
+ instance config headers
+ per-call headers
```

## Interceptors

```js
const api = raxios.create({ baseURL: 'https://api.example.com' })

api.interceptors.request.use(
  (config) => {
    config.headers.Authorization = `Bearer ${getToken()}`
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
)

const id = api.interceptors.request.use((config) => config)
api.interceptors.request.eject(id)
```

## Transforms

```js
const api = raxios.create({
  transformRequest: [
    (data, headers) => data
  ],
  transformResponse: [
    (data) => data
  ]
})
```

## Error Handling

Raxios throws for non-2xx responses, network errors, timeouts, and cancellations. All errors are tagged with `isRaxiosError`.

```js
try {
  await raxios.get('https://api.example.com/users/999')
} catch (err) {
  if (raxios.isRaxiosError(err)) {
    console.log(err.message)
    console.log(err.status)
    console.log(err.response?.data)
    console.log(err.config)
    console.log(err.code)
  }
}
```

Error behavior details:
- Non-2xx responses include `err.response` with `{ status, data, headers }` and set `err.status`.
- Timeouts map to `err.code = 'ECONNABORTED'` when the underlying error message includes "timeout".
- AbortController cancellations throw with `err.code = 'ERR_CANCELED'`.
- Other transport errors may set `err.code` if provided by the underlying runtime.

## Binary Responses

```js
const res = await raxios.get('https://example.com/image.png', {
  responseType: 'arraybuffer'
})

console.log(Buffer.isBuffer(res.data))
```

Supported `responseType` values: `json` (default), `arraybuffer`, `buffer`, `blob`, `bytes`.

## Concurrency Helpers

```js
const [users, posts] = await raxios.all([
  raxios.get('https://api.example.com/users'),
  raxios.get('https://api.example.com/posts')
])

await raxios.all([
  raxios.get('/users'),
  raxios.get('/posts')
]).then(raxios.spread((users, posts) => {
  console.log(users.data)
  console.log(posts.data)
}))
```

## TypeScript

```ts
import raxios from '@likhinmn/raxios'

interface User {
  id: number
  name: string
  email: string
}

const res = await raxios.get<User>('/users/1')
console.log(res.data.name)
```

## Compatibility Notes

- Node.js only (no browser build).
- Axios-like API surface: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `create`, `request`.
- Rust core uses a shared connection pool for efficient reuse.

## License

MIT