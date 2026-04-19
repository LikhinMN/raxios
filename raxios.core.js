"use strict";

class InterceptorManager {
    constructor() {
        this.handlers = []
    }

    use(fulfilled, rejected) {
        this.handlers.push({ fulfilled, rejected })
        return this.handlers.length - 1  // id for ejecting
    }

    eject(id) {
        this.handlers[id] = null
    }

    forEach(fn) {
        this.handlers.forEach(h => h && fn(h))
    }
}

const createAbortError = (config, url) => {
    const err = new Error('Request canceled')
    err.code = 'ERR_CANCELED'
    err.config = { ...config, url }
    err.isRaxiosError = true
    return err
}

function tryParseJSON(value) {
    if (typeof value !== 'string') {
        return value
    }
    try { return JSON.parse(value) }
    catch { return value }
}

async function fetchDispatcher(config) {
    if (typeof fetch !== 'function') {
        throw new Error('fetch is not available in this environment')
    }

    let url = config.url
    if (config.baseURL && !/^https?:\/\//i.test(url)) {
        url = config.baseURL.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '')
    }

    if (config.params) {
        const params = new URLSearchParams()
        for (const [key, value] of Object.entries(config.params)) {
            params.append(key, value)
        }
        const queryString = params.toString()
        if (queryString) {
            url += (url.includes('?') ? '&' : '?') + queryString
        }
    }

    if (config.signal?.aborted) {
        throw createAbortError(config, url)
    }

    let headers = { ...config.headers }
    let data = config.data

    if (data && typeof data === 'object' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
    }

    if (config.transformRequest) {
        const transforms = Array.isArray(config.transformRequest)
            ? config.transformRequest
            : [config.transformRequest]
        transforms.forEach(fn => {
            data = fn(data, headers)
        })
    }

    const body = (data && typeof data === 'object') ? JSON.stringify(data) : data

    const controller = new AbortController()
    let didTimeout = false
    let timeoutId
    let abortHandler

    if (config.timeout) {
        timeoutId = setTimeout(() => {
            didTimeout = true
            controller.abort()
        }, config.timeout)
    }

    if (config.signal) {
        abortHandler = () => controller.abort()
        config.signal.addEventListener('abort', abortHandler, { once: true })
    }

    try {
        const response = await fetch(url, {
            method: config.method,
            headers,
            body: body == null ? undefined : body,
            signal: controller.signal,
        })

        const responseHeaders = {}
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value
        })

        const responseType = config.responseType
        const isBinary = responseType === 'arraybuffer'
            || responseType === 'buffer'
            || responseType === 'blob'
            || responseType === 'bytes'

        let rawData
        if (isBinary) {
            if (responseType === 'blob') {
                rawData = await response.blob()
            } else {
                const arrayBuffer = await response.arrayBuffer()
                if (responseType === 'buffer' && typeof Buffer !== 'undefined') {
                    rawData = Buffer.from(arrayBuffer)
                } else if (responseType === 'bytes') {
                    rawData = new Uint8Array(arrayBuffer)
                } else {
                    rawData = arrayBuffer
                }
            }
        } else {
            rawData = await response.text()
        }

        if (!response.ok) {
            const err = new Error(`Request failed with status code ${response.status}`)
            err.response = {
                status: response.status,
                data: tryParseJSON(rawData),
                headers: responseHeaders,
                config: { ...config, url }
            }
            err.status = response.status
            err.config = { ...config, url }
            err.isRaxiosError = true
            throw err
        }

        let responseData = tryParseJSON(rawData)
        if (config.transformResponse) {
            const transforms = Array.isArray(config.transformResponse)
                ? config.transformResponse
                : [config.transformResponse]
            transforms.forEach(fn => {
                responseData = fn(responseData)
            })
        }

        return {
            data: responseData,
            status: response.status,
            headers: responseHeaders,
            config: { ...config, url },
        }
    } catch (e) {
        if (e && e.name === 'AbortError') {
            if (config.signal?.aborted) {
                throw createAbortError(config, url)
            }
            if (didTimeout) {
                const err = new Error('timeout')
                err.code = 'ECONNABORTED'
                err.config = { ...config, url }
                err.isRaxiosError = true
                throw err
            }
            throw createAbortError(config, url)
        }

        if (e && e.isRaxiosError) {
            throw e
        }

        const err = new Error(e?.message || String(e))
        err.code = e?.code
        err.config = { ...config, url }
        err.isRaxiosError = true
        throw err
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
        if (config.signal && abortHandler) {
            config.signal.removeEventListener('abort', abortHandler)
        }
    }
}

function createInstance(defaults, dispatcher = fetchDispatcher) {
    const interceptors = {
        request: new InterceptorManager(),
        response: new InterceptorManager(),
    }

    async function dispatch(config) {
        const { common = {}, ...restDefaults } = defaults.headers || {}
        const headers = {
            ...common,
            ...restDefaults,
            ...config.headers
        }

        const cfg = { ...defaults, ...config, headers }

        const chain = [dispatcher, undefined]

        interceptors.request.forEach(({ fulfilled, rejected }) => {
            chain.unshift(fulfilled, rejected)
        })

        interceptors.response.forEach(({ fulfilled, rejected }) => {
            chain.push(fulfilled, rejected)
        })

        let promise = Promise.resolve(cfg)
        while (chain.length) {
            promise = promise.then(chain.shift(), chain.shift())
        }

        return promise
    }

    const instance = (urlOrConfig, config) => {
        if (typeof urlOrConfig === 'string') {
            return dispatch({ method: 'GET', ...config, url: urlOrConfig })
        }
        return dispatch({ method: 'GET', ...urlOrConfig })
    }

    Object.assign(instance, {
        interceptors,
        defaults,
        get: (url, config) => dispatch({ ...config, method: 'GET', url }),
        post: (url, data, config) => dispatch({ ...config, method: 'POST', url, data }),
        put: (url, data, config) => dispatch({ ...config, method: 'PUT', url, data }),
        patch: (url, data, config) => dispatch({ ...config, method: 'PATCH', url, data }),
        delete: (url, config) => dispatch({ ...config, method: 'DELETE', url }),
        head: (url, config) => dispatch({ ...config, method: 'HEAD', url }),
        options: (url, config) => dispatch({ ...config, method: 'OPTIONS', url }),
    })

    return instance
}

module.exports = {
    InterceptorManager,
    createAbortError,
    tryParseJSON,
    fetchDispatcher,
    createInstance,
}

