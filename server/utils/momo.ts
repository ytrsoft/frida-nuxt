import * as frida from 'frida'

export const create = async (code: string) => {
  const device = await frida.getUsbDevice()
  const session = await device.attach('MOMO陌陌')
  const script = await session.createScript(code)
  script.load()
  const rpc = script.exports
  return {
    rpc,
    unload: () => {
      script.unload()
    }
  }
}
