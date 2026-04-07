"use strict";

const { request } = require('./index')

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

function createInstance(defaults) {
    // interceptors
    const interceptors = {
        request: new InterceptorManager(),
        response: new InterceptorManager(),
    }

    async function dispatchRequest(config) {
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
        try {
            res = await request(
                config.method,
                url,
                headers || null,
                body || null,
                config.timeout || null
            )
        } catch (e) {
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

    function tryParseJSON(str) {
        try { return JSON.parse(str) }
        catch { return str }
    }

    // the core dispatch function
    async function dispatch(config) {
        const { common = {}, ...restDefaults } = defaults.headers || {}
        const headers = { 
            ...common,
            ...restDefaults,
            ...config.headers 
        }

        const cfg = { ...defaults, ...config, headers }

        // seed the chain with the real request in the middle
        const chain = [dispatchRequest, undefined]

        // push request interceptors to the FRONT
        interceptors.request.forEach(({ fulfilled, rejected }) => {
            chain.unshift(fulfilled, rejected)
        })

        // push response interceptors to the BACK
        interceptors.response.forEach(({ fulfilled, rejected }) => {
            chain.push(fulfilled, rejected)
        })

        // reduce into a promise chain
        let promise = Promise.resolve(cfg)
        while (chain.length) {
            promise = promise.then(chain.shift(), chain.shift())
        }

        return promise
    }

    // the instance object
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

const raxios = createInstance({ headers: { common: {} } })
raxios.create = (config) => createInstance({ headers: {}, ...config })
raxios.isRaxiosError = (err) => err?.isRaxiosError === true
raxios.all = (promises) => Promise.all(promises)
raxios.spread = (callback) => (arr) => callback(...arr)

module.exports = raxios
module.exports.default = raxios