export default defineWebSocketHandler({
  open() {
    console.log('open websocket')
  },
  message(peer: any, message: any) {
    peer.send('message ' + message)
  },
  close() {
    console.log('close websocket')
  }
})
