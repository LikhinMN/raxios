"use strict";

/** @typedef {import('./raxios.core').RaxiosConfig} RaxiosConfig */
/** @typedef {import('./raxios.core').RaxiosResponse} RaxiosResponse */
/** @typedef {import('./raxios.core').RaxiosError} RaxiosError */

const { createInstance, fetchDispatcher } = require('./raxios.core')

const raxios = createInstance({ headers: { common: {} } }, fetchDispatcher)

/**
 * Create a new raxios instance.
 * @param {RaxiosConfig} config
 * @returns {Function}
 * @example
 * const api = raxios.create({ baseURL: 'https://api.example.com' })
 */
raxios.create = (config) => createInstance({ headers: {}, ...config }, fetchDispatcher)

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
