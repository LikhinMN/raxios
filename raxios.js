"use strict";

/** @typedef {import('./raxios.core').RaxiosConfig} RaxiosConfig */
/** @typedef {import('./raxios.core').RaxiosResponse} RaxiosResponse */
/** @typedef {import('./raxios.core').RaxiosError} RaxiosError */

const { request } = require('./index')
const { createAbortError, createInstance, tryParseJSON } = require('./raxios.core')

/**
 * Dispatch a request using the Rust binding.
 * @param {RaxiosConfig} config
 * @returns {Promise<RaxiosResponse>}
 */
async function rustDispatcher(config) {
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

    let res
    let abortHandler
    const abortPromise = config.signal
        ? new Promise((_, reject) => {
            abortHandler = () => reject(createAbortError(config, url))
            config.signal.addEventListener('abort', abortHandler, { once: true })
        })
        : null
    try {
        const requestPromise = request(
            config.method,
            url,
            headers || null,
            body || null,
            config.timeout || null,
            config.responseType || null
        )
        res = await (abortPromise ? Promise.race([requestPromise, abortPromise]) : requestPromise)
    } catch (e) {
        if (e && e.code === 'ERR_CANCELED') {
            throw e
        }
        let err;
        try {
            // Try to parse error message as JSON (for response errors from Rust)
            const errorData = JSON.parse(e.message)
            err = new Error(`Request failed with status code ${errorData.status}`)
            err.response = {
                status: errorData.status,
                data: tryParseJSON(errorData.data),
                headers: errorData.headers,
                config: { ...config, url }
            }
            err.status = errorData.status
        } catch {
            // Not a JSON error, likely a connection/timeout/generic error
            err = new Error(e.message)
            err.code = e.message.includes('timeout') ? 'ECONNABORTED' : e.code
        }

        err.config = { ...config, url }
        err.isRaxiosError = true
        throw err
    } finally {
        if (config.signal && abortHandler) {
            config.signal.removeEventListener('abort', abortHandler)
        }
    }

    let responseData = tryParseJSON(res.data)
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
        status: res.status,
        headers: res.headers,
        config: { ...config, url },
    }
}

const raxios = createInstance({ headers: { common: {} } }, rustDispatcher)

/**
 * Create a new raxios instance.
 * @param {RaxiosConfig} config
 * @returns {Function}
 * @example
 * const api = raxios.create({ baseURL: 'https://api.example.com' })
 */
raxios.create = (config) => createInstance({ headers: {}, ...config }, rustDispatcher)

/**
 * Dispatch a request config (defaults to GET).
 * @param {RaxiosConfig} config
 * @returns {Promise<RaxiosResponse>}
 */
raxios.request = (config) => raxios(config)

/**
 * Check if an error is a RaxiosError.
 * @param {unknown} err
 * @returns {boolean}
 * @example
 * if (raxios.isRaxiosError(err)) console.log(err.code)
 */
raxios.isRaxiosError = (err) => err?.isRaxiosError === true

/**
 * Resolve multiple requests at once.
 * @param {Promise[]} promises
 * @returns {Promise<*>}
 * @example
 * const [users, posts] = await raxios.all([raxios.get('/users'), raxios.get('/posts')])
 */
raxios.all = (promises) => Promise.all(promises)

/**
 * Spread a resolved array into a callback.
 * @param {Function} callback
 * @returns {Function}
 */
raxios.spread = (callback) => (arr) => callback(...arr)

module.exports = raxios
module.exports.default = raxios