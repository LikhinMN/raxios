import express from 'express'
import { bench, run, group } from 'mitata'
import raxios from '../raxios.js'
import axios from 'axios'

// Start local server
const app = express()
app.use(express.json())
app.get('/get', (req, res) => res.json({ args: req.query }))
app.post('/post', (req, res) => res.json({ json: req.body }))
const server = app.listen(3333)

const BASE = 'http://localhost:3333'
group('GET', () => {
    bench('raxios', async () => {
        await raxios.get(`${BASE}/get`)
    })
    bench('axios', async () => {
        await axios.get(`${BASE}/get`)
    })
})

group('GET with params', () => {
    bench('raxios', async () => {
        await raxios.get(`${BASE}/get`, { params: { foo: 'bar', page: 1 } })
    })
    bench('axios', async () => {
        await axios.get(`${BASE}/get`, { params: { foo: 'bar', page: 1 } })
    })
})

group('POST JSON', () => {
    bench('raxios', async () => {
        await raxios.post(`${BASE}/post`, { name: 'raxios', version: '0.1.0' })
    })
    bench('axios', async () => {
        await axios.post(`${BASE}/post`, { name: 'axios', version: '0.1.0' })
    })
})

group('Concurrent x5', () => {
    bench('raxios', async () => {
        await raxios.all([
            raxios.get(`${BASE}/get`),
            raxios.get(`${BASE}/get`),
            raxios.get(`${BASE}/get`),
            raxios.get(`${BASE}/get`),
            raxios.get(`${BASE}/get`),
        ])
    })
    bench('axios', async () => {
        await Promise.all([
            axios.get(`${BASE}/get`),
            axios.get(`${BASE}/get`),
            axios.get(`${BASE}/get`),
            axios.get(`${BASE}/get`),
            axios.get(`${BASE}/get`),
        ])
    })
})

await run()
server.close()