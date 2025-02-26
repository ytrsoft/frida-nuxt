export default defineWebSocketHandler({
  open() {
    console.log('开启RPC')
  },
  message(peer: any, message: any) {
    peer.send('=> ' + message)
  },
  close() {
    console.log('关闭RPC')
  }
})
