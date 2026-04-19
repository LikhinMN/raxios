"use strict";

const { request } = require('./index')
const { createAbortError, createInstance, tryParseJSON } = require('./raxios.core')

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
raxios.create = (config) => createInstance({ headers: {}, ...config }, rustDispatcher)
raxios.request = (config) => raxios(config)
raxios.isRaxiosError = (err) => err?.isRaxiosError === true
raxios.all = (promises) => Promise.all(promises)
raxios.spread = (callback) => (arr) => callback(...arr)

module.exports = raxios
module.exports.default = raxios