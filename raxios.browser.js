"use strict";

const { createInstance, fetchDispatcher } = require('./raxios.core')

const raxios = createInstance({ headers: { common: {} } }, fetchDispatcher)
raxios.create = (config) => createInstance({ headers: {}, ...config }, fetchDispatcher)
raxios.request = (config) => raxios(config)
raxios.isRaxiosError = (err) => err?.isRaxiosError === true
raxios.all = (promises) => Promise.all(promises)
raxios.spread = (callback) => (arr) => callback(...arr)

module.exports = raxios
module.exports.default = raxios

