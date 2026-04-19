"use strict";

/**
 * @typedef {Object} RaxiosConfig
 * @property {string} url
 * @property {string} [method]
 * @property {string} [baseURL]
 * @property {Record<string, string>} [headers]
 * @property {Record<string, string|number|boolean>} [params]
 * @property {*} [data]
 * @property {number} [timeout]
 * @property {string} [responseType]
 * @property {Function|Function[]} [transformRequest]
 * @property {Function|Function[]} [transformResponse]
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {Object} RaxiosResponse
 * @property {*} data
 * @property {number} status
 * @property {Record<string, string>} headers
 * @property {RaxiosConfig} config
 */

/**
 * @typedef {Object} RaxiosError
 * @property {string} message
 * @property {string} [code]
 * @property {number} [status]
 * @property {{ status: number, data: *, headers: Record<string, string>, config: RaxiosConfig }} [response]
 * @property {RaxiosConfig} config
 * @property {boolean} isRaxiosError
 */

/**
 * Manages interceptor handlers for requests and responses.
 * @example
 * const api = raxios.create({ baseURL: 'https://api.example.com' })
 * api.interceptors.request.use((config) => config)
 */
class InterceptorManager {
    constructor() {
        this.handlers = []
    }

    /**
     * Register an interceptor handler.
     * @param {Function} fulfilled
     * @param {Function} [rejected]
     * @returns {number} id
     */
    use(fulfilled, rejected) {
        this.handlers.push({ fulfilled, rejected })
        return this.handlers.length - 1  // id for ejecting
    }

    /**
     * Remove an interceptor by id.
     * @param {number} id
     * @returns {void}
     */
    eject(id) {
        this.handlers[id] = null
    }

    /**
     * Iterate over active interceptor handlers.
     * @param {Function} fn
     * @returns {void}
     */
    forEach(fn) {
        this.handlers.forEach(h => h && fn(h))
    }
}

/**
 * Create a cancellation error for aborted requests.
 * @param {RaxiosConfig} config
 * @param {string} url
 * @returns {RaxiosError}
 */
const createAbortError = (config, url) => {
    const err = new Error('Request canceled')
    err.code = 'ERR_CANCELED'
    err.config = { ...config, url }
    err.isRaxiosError = true
    return err
}

/**
 * Parse JSON strings while leaving other values untouched.
 * @param {*} value
 * @returns {*}
 */
function tryParseJSON(value) {
    if (typeof value !== 'string') {
        return value
    }
    try { return JSON.parse(value) }
    catch { return value }
}

/**
 * Dispatch a request using fetch.
 * @param {RaxiosConfig} config
 * @returns {Promise<RaxiosResponse>}
 */
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

/**
 * Create a raxios instance with a custom dispatcher.
 * @param {RaxiosConfig} defaults
 * @param {Function} dispatcher
 * @returns {Function}
 */
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
        /**
         * Send a GET request.
         * @param {string} url
         * @param {RaxiosConfig} [config]
         * @returns {Promise<RaxiosResponse>}
         * @example
         * const res = await raxios.get('https://api.example.com/users')
         */
        get: (url, config) => dispatch({ ...config, method: 'GET', url }),
        /**
         * Send a POST request.
         * @param {string} url
         * @param {*} data
         * @param {RaxiosConfig} [config]
         * @returns {Promise<RaxiosResponse>}
         * @example
         * const res = await raxios.post('https://api.example.com/users', { name: 'Likhin' })
         */
        post: (url, data, config) => dispatch({ ...config, method: 'POST', url, data }),
        /**
         * Send a PUT request.
         * @param {string} url
         * @param {*} data
         * @param {RaxiosConfig} [config]
         * @returns {Promise<RaxiosResponse>}
         */
        put: (url, data, config) => dispatch({ ...config, method: 'PUT', url, data }),
        /**
         * Send a PATCH request.
         * @param {string} url
         * @param {*} data
         * @param {RaxiosConfig} [config]
         * @returns {Promise<RaxiosResponse>}
         */
        patch: (url, data, config) => dispatch({ ...config, method: 'PATCH', url, data }),
        /**
         * Send a DELETE request.
         * @param {string} url
         * @param {RaxiosConfig} [config]
         * @returns {Promise<RaxiosResponse>}
         */
        delete: (url, config) => dispatch({ ...config, method: 'DELETE', url }),
        /**
         * Send a HEAD request.
         * @param {string} url
         * @param {RaxiosConfig} [config]
         * @returns {Promise<RaxiosResponse>}
         */
        head: (url, config) => dispatch({ ...config, method: 'HEAD', url }),
        /**
         * Send an OPTIONS request.
         * @param {string} url
         * @param {RaxiosConfig} [config]
         * @returns {Promise<RaxiosResponse>}
         */
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
