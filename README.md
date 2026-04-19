# @likhinmn/raxios

Fast, axios-compatible HTTP client for Node.js and browsers, built on Rust.

[![npm](https://img.shields.io/npm/v/@likhinmn/raxios?style=flat-square)](https://www.npmjs.com/package/@likhinmn/raxios)
[![license](https://img.shields.io/npm/l/@likhinmn/raxios?style=flat-square)](LICENSE)
![platform-linux](https://img.shields.io/badge/platform-linux-2ea44f?style=flat-square)
![platform-macos](https://img.shields.io/badge/platform-macos-2ea44f?style=flat-square)
![platform-windows](https://img.shields.io/badge/platform-windows-2ea44f?style=flat-square)

## Why raxios

- Rust core via `reqwest` for consistent, fast HTTP.
- Axios-style API with interceptors, transforms, and defaults.
- Cross-platform native binaries for Linux, Windows, and macOS.
- Browser support via `fetch` with zero-config bundler resolution.

## Install

```bash
npm install @likhinmn/raxios
yarn add @likhinmn/raxios
pnpm add @likhinmn/raxios
```

Supported platforms: Linux x64, Windows x64, macOS x64, macOS arm64.

## Quick start

```js
// ESM
import raxios from '@likhinmn/raxios'

const res = await raxios.get('https://jsonplaceholder.typicode.com/users/1')
console.log(res.status)
console.log(res.data)
```

```js
// CommonJS
const raxios = require('@likhinmn/raxios')

const res = await raxios.get('https://jsonplaceholder.typicode.com/posts/1')
console.log(res.status)
console.log(res.data)
```

## Browser usage

Bundlers that honor `package.json#browser` (Vite, webpack, Rollup) automatically resolve to `raxios.browser.js`, which uses the fetch dispatcher.

```js
import raxios from '@likhinmn/raxios'

const res = await raxios.get('https://httpbin.org/get')
console.log(res.data.url)
```

No config is required; ensure `fetch` is available in the target runtime.

## Full API reference

Each method returns a `Promise<RaxiosResponse>` unless otherwise noted.

### raxios(config)

- **Params**: `config: RaxiosConfig`
- **Returns**: `Promise<RaxiosResponse>`
- **Note**: Defaults to `GET` and does not honor `config.method`

```js
const res = await raxios({
  url: 'https://httpbin.org/get',
  params: { q: 'raxios' }
})
console.log(res.data.args.q)
```

### raxios.request(config)

- **Params**: `config: RaxiosConfig`
- **Returns**: `Promise<RaxiosResponse>`
- **Note**: Defaults to `GET` and does not honor `config.method`

```js
const res = await raxios.request({
  url: 'https://httpbin.org/get',
  params: { page: 1 }
})
console.log(res.data.args.page)
```

### raxios.get(url, config)

- **Params**: `url: string`, `config?: RaxiosConfig`
- **Returns**: `Promise<RaxiosResponse>`

```js
const res = await raxios.get('https://jsonplaceholder.typicode.com/posts/1')
console.log(res.data.title)
```

### raxios.post(url, data, config)

- **Params**: `url: string`, `data: any`, `config?: RaxiosConfig`
- **Returns**: `Promise<RaxiosResponse>`

```js
const res = await raxios.post(
  'https://httpbin.org/post',
  { name: 'Raxios' }
)
console.log(res.data.json.name)
```

### raxios.put(url, data, config)

- **Params**: `url: string`, `data: any`, `config?: RaxiosConfig`
- **Returns**: `Promise<RaxiosResponse>`

```js
const res = await raxios.put(
  'https://httpbin.org/put',
  { name: 'Updated' }
)
console.log(res.data.json.name)
```

### raxios.patch(url, data, config)

- **Params**: `url: string`, `data: any`, `config?: RaxiosConfig`
- **Returns**: `Promise<RaxiosResponse>`

```js
const res = await raxios.patch(
  'https://httpbin.org/patch',
  { status: 'active' }
)
console.log(res.data.json.status)
```

### raxios.delete(url, config)

- **Params**: `url: string`, `config?: RaxiosConfig`
- **Returns**: `Promise<RaxiosResponse>`

```js
const res = await raxios.delete('https://httpbin.org/delete')
console.log(res.status)
```

### raxios.head(url, config)

- **Params**: `url: string`, `config?: RaxiosConfig`
- **Returns**: `Promise<RaxiosResponse>`

```js
const res = await raxios.head('https://httpbin.org/get')
console.log(res.headers['content-type'])
```

### raxios.options(url, config)

- **Params**: `url: string`, `config?: RaxiosConfig`
- **Returns**: `Promise<RaxiosResponse>`

```js
const res = await raxios.options('https://httpbin.org/get')
console.log(res.headers.allow)
```

### raxios.create(config)

- **Params**: `config: RaxiosConfig`
- **Returns**: `RaxiosInstance`

```js
const api = raxios.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 5000
})

const res = await api.get('/users/1')
console.log(res.data.email)
```

### raxios.isRaxiosError(err)

- **Params**: `err: unknown`
- **Returns**: `boolean`

```js
try {
  await raxios.get('https://httpbin.org/status/404')
} catch (err) {
  if (raxios.isRaxiosError(err)) {
    console.log(err.status)
  }
}
```

### raxios.all(promises)

- **Params**: `promises: Promise[]`
- **Returns**: `Promise<any[]>`

```js
const [users, posts] = await raxios.all([
  raxios.get('https://jsonplaceholder.typicode.com/users'),
  raxios.get('https://jsonplaceholder.typicode.com/posts')
])
console.log(users.data.length, posts.data.length)
```

### raxios.spread(callback)

- **Params**: `callback: (...args: any[]) => any`
- **Returns**: `(...args: any[]) => any`

```js
await raxios
  .all([
    raxios.get('https://jsonplaceholder.typicode.com/users/1'),
    raxios.get('https://jsonplaceholder.typicode.com/posts/1')
  ])
  .then(raxios.spread((user, post) => {
    console.log(user.data.name)
    console.log(post.data.title)
  }))
```

## Request config

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | `string` | required | Request URL (absolute or relative if `baseURL` is set). |
| `method` | `string` | `GET` | HTTP method for method helpers; ignored by `raxios(config)` and `raxios.request(config)`. |
| `baseURL` | `string` | `undefined` | Prepended to `url` when `url` is relative. |
| `headers` | `Record<string, string>` | `{}` | Merged with defaults and per-request headers. |
| `params` | `Record<string, string \| number \| boolean>` | `undefined` | Serialized into the query string. |
| `data` | `any` | `undefined` | Request body; objects are JSON-serialized. |
| `timeout` | `number` | `undefined` | Timeout in milliseconds. |
| `responseType` | `'json' \| 'arraybuffer' \| 'buffer' \| 'blob' \| 'bytes'` | `json` | Controls binary/text response parsing. |
| `transformRequest` | `Function \| Function[]` | `undefined` | Run before the request is dispatched. |
| `transformResponse` | `Function \| Function[]` | `undefined` | Run after the response is parsed. |
| `signal` | `AbortSignal` | `undefined` | Cancels requests with `AbortController`. |

## Response object

| Field | Type | Description |
| --- | --- | --- |
| `data` | `any` | Parsed response body. |
| `status` | `number` | HTTP status code. |
| `headers` | `Record<string, string>` | Response headers. |
| `config` | `RaxiosConfig` | Final request config (includes resolved `url`). |

## Error handling

Raxios throws for non-2xx responses, transport errors, timeouts, and cancellations, and tags all errors with `isRaxiosError`.

```js
try {
  await raxios.get('https://httpbin.org/status/404')
} catch (err) {
  if (raxios.isRaxiosError(err)) {
    console.log(err.message)
    console.log(err.status)
    console.log(err.response?.data)
    console.log(err.code)
  }
}
```

Error details:
- Non-2xx responses include `err.response` with `{ status, data, headers }` and set `err.status`.
- Timeouts map to `err.code = 'ECONNABORTED'` when the underlying error message includes "timeout".
- AbortController cancellations throw with `err.code = 'ERR_CANCELED'`.
- Other transport errors may include `err.code` from the runtime.

## Interceptors

```js
const api = raxios.create({ baseURL: 'https://httpbin.org' })

api.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${process.env.TOKEN || 'demo'}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.status === 401) {
      const tokenRes = await raxios.get('https://httpbin.org/uuid')
      const token = tokenRes.data.uuid
      return api.get('/anything', {
        headers: { Authorization: `Bearer ${token}` }
      })
    }
    return Promise.reject(error)
  }
)

const id = api.interceptors.request.use((config) => config)
api.interceptors.request.eject(id)
```

## Binary responses

| responseType | Output |
| --- | --- |
| `json` | Parsed JSON (default) |
| `arraybuffer` | `ArrayBuffer` (browser) / `Buffer` (Node) |
| `buffer` | `Buffer` (Node) / `Buffer` if available (browser) |
| `blob` | `Blob` (browser) / `Buffer` (Node) |
| `bytes` | `Uint8Array` (browser) / `Buffer` (Node) |

```js
const res = await raxios.get('https://httpbin.org/image/png', {
  responseType: 'arraybuffer'
})
console.log(res.data.byteLength)
```

## AbortController

```js
const controller = new AbortController()

setTimeout(() => controller.abort(), 50)

try {
  await raxios.get('https://httpbin.org/delay/5', {
    signal: controller.signal
  })
} catch (err) {
  if (raxios.isRaxiosError(err)) {
    console.log(err.code)
  }
}
```

## Concurrent requests

```js
const [users, posts] = await raxios.all([
  raxios.get('https://jsonplaceholder.typicode.com/users'),
  raxios.get('https://jsonplaceholder.typicode.com/posts')
])

await raxios
  .all([
    raxios.get('https://jsonplaceholder.typicode.com/users/1'),
    raxios.get('https://jsonplaceholder.typicode.com/posts/1')
  ])
  .then(raxios.spread((user, post) => {
    console.log(user.data.name)
    console.log(post.data.title)
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

const res = await raxios.get<User>('https://jsonplaceholder.typicode.com/users/1')
console.log(res.data.name)
```

## vs axios

| Feature | raxios | axios |
| --- | --- | --- |
| Core | Rust (`reqwest`) + NAPI | JavaScript (Node http / fetch) |
| Browser support | Yes (via `fetch` entrypoint) | Yes |
| Native binaries | Yes (Linux/Windows/macOS) | No |
| API surface | Axios-style helpers and interceptors | Axios-style helpers and interceptors |
| `raxios(config)` method behavior | Always `GET` | Honors `method` |
| Binary response helpers | `responseType` (`arraybuffer`, `buffer`, `blob`, `bytes`) | `responseType` support |

## Benchmarks

Benchmarked against a local Express server on Node.js 22, AMD Ryzen 5 7235HS.

| Test | raxios | axios | speedup |
| --- | --- | --- | --- |
| GET | 522 µs | 824 µs | 1.58x |
| GET w/ params | 479 µs | 736 µs | 1.54x |
| POST JSON | 534 µs | 825 µs | 1.55x |
| Concurrent x5 | 1.48 ms | 2.85 ms | 1.93x |

> Run benchmarks yourself: `node benchmarks/http.bench.mjs`

## Contributing

Build locally:

```bash
npm run build
npm run build:debug
```

Run tests:

```bash
npm test
npm run test:watch
```

## License

MIT