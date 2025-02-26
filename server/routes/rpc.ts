
import * as frida from 'frida'

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

const createRPC = async () => {
  const device = await frida.getUsbDevice()
  const session = await device.attach('MOMO陌陌')
  const script = await session.createScript(code)
  script.load()
  return script.exports
}


export default defineWebSocketHandler({
  open() {
    console.log('open websocket')
    createRPC().then((rpc) => {
      console.log(rpc)
    })
  },
  message(peer: any, message: any) {
    peer.send('message ' + message)
  },
  close() {
    console.log('close websocket')
  }
})
