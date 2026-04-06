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
        const body = typeof config.data === 'object' ? JSON.stringify(config.data) : config.data

        let res
        try {
            res = await request(
                config.method,
                config.url,
                config.headers || null,
                body || null
            )
        } catch (e) {
            const err = new Error(e.message)
            err.code = e.code
            err.config = config
            err.isRaxiosError = true
            throw err
        }

        return {
            data: tryParseJSON(res.data),
            status: res.status,
            headers: res.headers,
            config,
        }
    }

    function tryParseJSON(str) {
        try { return JSON.parse(str) }
        catch { return str }
    }

    // the core dispatch function
    async function dispatch(config) {
        const cfg = { ...defaults, ...config,
            headers: { ...defaults.headers, ...config.headers }
        }

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
    const instance = dispatch.bind(null)
    Object.assign(instance, {
        interceptors,
        defaults,
        get: (url, config) => dispatch({ ...config, method: 'GET', url }),
        post: (url, data, config) => dispatch({ ...config, method: 'POST', url, data }),
        put: (url, data, config) => dispatch({ ...config, method: 'PUT', url, data }),
        delete: (url, config) => dispatch({ ...config, method: 'DELETE', url }),
    })

    return instance
}

const raxios = createInstance({ headers: {} })
raxios.create = (config) => createInstance({ headers: {}, ...config })
raxios.isRaxiosError = (err) => err?.isRaxiosError === true

module.exports = raxios
module.exports.default = raxios