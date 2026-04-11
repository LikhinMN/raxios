# Raxios Agent Guide

**Raxios** is a Node.js HTTP client library built with Rust + NAPI-RS. It wraps the Rust `reqwest` HTTP client to provide JavaScript/TypeScript APIs similar to axios.

## Architecture Overview

### The Three-Layer Stack
1. **Rust Core** (`src/lib.rs`): Low-level HTTP client using `reqwest` + `tokio`. Exposes a single async function: `request(method, url, headers?, body?, timeout?, responseType?)` via NAPI-RS.
2. **Native Binding** (`index.js`): Auto-generated platform-specific loader that selects `.node` binary based on OS/arch (Linux GNU/musl, macOS universal, Windows MSVC, etc.).
3. **JavaScript Wrapper** (`raxios.js`): Thin wrapper over raw native binding that adds axios-like API (methods: `.get()`, `.post()`, `.create()`, interceptors, config transforms).

### Key Design Patterns

**OnceLock HTTP Client**: `src/lib.rs` uses `static CLIENT: OnceLock<reqwest::Client>` to maintain a global, thread-safe connection pool. The client is initialized once on first request—do not create new clients per request.

**Error Handling Split**: Non-2xx responses are serialized as JSON strings in Rust error messages. JavaScript (`raxios.js` around lines 96-120) parses these to reconstruct `err.response` with `{status, data, headers}` and always marks errors with `isRaxiosError = true`. Transport/timeout errors come through as `RaxiosError` strings from Rust and are mapped to `err.code` in JS.

**Data Type Duality**: `RaxiosResponse.data` in Rust is `Either<String, Buffer>` (lines 18-21), determined by `responseType` param. Binary types (`"arraybuffer"`, `"buffer"`, `"blob"`, `"bytes"`) return Buffers; text (default) returns strings. JavaScript side (`tryParseJSON` around lines 145-154) passes Buffers through and attempts JSON.parse on strings.

**Interceptor Chain Pattern**: Interceptors implemented as promise chain reduction (raxios.js around lines 167-184). Request interceptors prepended to chain, response interceptors appended. Each handler can transform or reject the promise.

## Development Workflow

### Building
```bash
npm run build        # Release build (optimized, platform-specific .node binary)
npm run build:debug  # Debug build (faster iteration, larger binary)
```
NAPI-RS CLI handles platform detection and compilation. Binaries output to `raxios.{platform}-{arch}-{abi}.node` or fallback npm packages.

### Testing
```bash
npm test         # Vitest suite (tests/integration/*.test.mjs)
npm run test:watch
```
Tests are ESM modules using actual HTTP calls to httpbin.org and jsonplaceholder—not mocked. Tests validate status codes, headers, custom headers, and `create()` config inheritance.

### Debugging
- **Rust compilation errors**: Check `Cargo.toml` deps (napi, reqwest, tokio, serde). NAPI-RS build script in `build.rs` is minimal—setup-only.
- **Native binding load failures**: The `index.js` platform detector has fallback chains per OS. Missing libc versions (musl vs glibc) cause silent fallback to npm packages.
- **Type mismatches**: NAPI type marshalling in `src/lib.rs` uses `#[napi]` derive macros. Validate all input/output types match `index.d.ts`.

## Critical Implementation Details

### HTTP Method Routing
`src/lib.rs` line 33-40: Method string matched case-insensitively against uppercase ("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"). Unknown methods return `napi::Status::GenericFailure` error.

### Request Building
Config fields are transformed to low-level params before native call (raxios.js around lines 39-95):
- **baseURL** + **params**: URL construction with query strings
- **headers**: Merged from defaults + instance defaults + request config
- **data**: Objects are JSON-serialized before native call; `Content-Type: application/json` is added only if not already set
- **transformRequest**: Applied before sending (user-defined transforms)
- **timeout**: Milliseconds converted to Duration in Rust (line 49)
- **signal**: AbortController-supported; abort rejects with `code: 'ERR_CANCELED'` before or during the native call

### Response Parsing
Rust side (lines 82-99):
- Binary detection: `response_type` param checked for "arraybuffer" | "buffer" | "blob" | "bytes"
- Text auto-parsed as UTF-8; binary returned as-is
- Headers collected into `HashMap<String, String>`

JavaScript side (lines 127-143):
- Binary Buffers passed through
- Strings attempted JSON.parse, fallback to raw string
- **transformResponse** hook applied after parse

### Error Flow
1. **Rust non-2xx** → serialized as JSON in error message: `{"status": N, "data": "...", "headers": {}}`
2. **JavaScript catches** → parses JSON, reconstructs `err.response` object, sets `err.status`
3. **Transport/timeout** → JS uses Rust error text; timeout is mapped to `code: 'ECONNABORTED'` when the message includes "timeout"
4. **AbortController** → JS throws early with `code: 'ERR_CANCELED'` and `isRaxiosError = true`

### Interceptor Execution Order
```
Request Interceptors (in registration order)
  ↓
dispatchRequest (native HTTP call)
  ↓
Response Interceptors (in registration order)
```
Promise chain is built with request interceptors unshifted (prepended) and response interceptors pushed (appended), then reduced via Promise.then() chain (raxios.js around lines 167-184).

## File Reference

- **`src/lib.rs`**: NAPI Rust bindings, HTTP request handler, response marshalling
- **`src/error.rs`**: Reqwest error mapping for Rust-side `RaxiosError`
- **`raxios.js`**: Main JavaScript API, interceptor logic, config merging, error parsing, AbortController handling
- **`index.js`**: Platform-specific native binding loader (auto-generated by NAPI-RS)
- **`index.d.ts`**: TypeScript type definitions (auto-generated)
- **`Cargo.toml`**: Rust dependencies (napi, reqwest, tokio, serde)
- **`build.rs`**: NAPI build setup script
- **`package.json`**: npm scripts and NAPI-RS CLI config

## Common Patterns for Agents

**Adding a new HTTP method**: Add case to method router in `src/lib.rs` line 33, add `.method()` shortcut to raxios.js line 199+ instance object.

**Modifying error handling**: Update JSON error serialization in `src/lib.rs` lines 102-117, then update JavaScript parsing in raxios.js around lines 96-120.

**Adding request/response transform hooks**: Config fields already passed through (transformRequest, transformResponse). Add execution in dispatchRequest before/after native call (raxios.js lines 67-135).

**Binary data handling**: Response type "arraybuffer" | "buffer" | "blob" | "bytes" triggers binary path in Rust (line 82-92). JavaScript receives Buffer object directly—no parsing needed.

**Abortable requests**: Pass `signal` in request config; JS races the native request against the abort signal and returns `code: 'ERR_CANCELED'` on cancellation (raxios.js lines 80-99).

**Testing new features**: Use the Vitest suite under `tests/integration/*.test.mjs` (e.g., `tests/integration/basic.test.mjs`). Tests hit real endpoints—validate status and data structure. No mocking framework; add console.log for debugging.
