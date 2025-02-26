import * as frida from 'frida'

let isInt = false

const code = `
const setup = () => {
  Java.perform(() => {
    console.log('===setup===')
  })
}
rpc.exports = {
  setup
}
`

const initApp = async (app: any) => {
  const device = await frida.getUsbDevice()
  const session = await device.attach('MOMO陌陌')
  const script = await session.createScript(code)
  script.load()
  const rpc = script.exports
  app.provide('rpc', rpc)
}

export default defineNuxtPlugin(async (app) => {
  if (!isInt) {
    await initApp(app)
    isInt = true
  }
})
