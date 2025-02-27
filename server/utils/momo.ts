import * as frida from 'frida'

const inject = `
let LOGIN_USER = null
const USER_CACHE = {}

const API_BASE = 'https://api.immomo.com'
const USER_API = API_BASE + '/v3/user/profile/info'
const NEARLY_API = API_BASE + '/v2/nearby/people/lists'

const TYPES = {
  INIT: 0,
  MESSAGE: 1
}

const PKGS = {
  IMJ: 'com.immomo.momo.im.e$1',
  IM_APP: 'com.immomo.momo.im.b',
  HASH_MAP: 'java.util.HashMap',
  ARRAY_LIST: 'java.util.ArrayList',
  HTTP_CLIENT: 'com.immomo.momo.protocol.http.a',
  MSG_SERVICE: 'com.immomo.momo.messages.service.l',
  USER_SERVICE: 'com.immomo.momo.service.user.UserService',
  MSG_HELPER: 'com.immomo.momo.message.helper.p',
  MSG_SENDER: 'com.immomo.momo.mvp.message.task.c',
  MESSAGE: 'com.immomo.momo.service.bean.Message',
  CODEC: 'com.immomo.momo.util.g'
}

const serialize = (instance) => {
  const json = {}
  const className = instance.getClass()
  const fields = className.getDeclaredFields()
  fields.forEach((field) => {
    field.setAccessible(true)
    const name = field.getName()
    const value = field.get(instance)
    json[name] = value && value.toString()
  })
  return json
}

const postRequest = (url, args) => {
  const HashMap = Java.use(PKGS.HASH_MAP)
  const map = HashMap.$new()
  Object.keys(args).forEach(key => map.put(key, args[key]))
  const httpClient = Java.use(PKGS.HTTP_CLIENT).$new()
  return httpClient.doPost(url, map)
}

const parsePopularity = (text) => {
  const match = text.match(/([\d\.]+)(万)?获赞\s·\s([\d\.]+)(万)?粉丝/)
  if (!match) return { likes: 0, followers: 0 }

  const likes = parseFloat(match[1]) * (match[2] ? 10000 : 1)
  const followers = parseFloat(match[3]) * (match[4] ? 10000 : 1)
  return { likes, followers }
}

const parseUserProfile = (profile) => {
  return {
    id: profile?.momoid,
    name: profile?.name,
    age: profile?.age,
    sex: profile?.sex === 'F' ? 0 : 1,
    constellation: profile?.constellation,
    sign: profile?.sign,
    avatar: profile?.photos[0],
    device: profile?.device_info?.device,
    popular: profile?.user_popular_text,
  }
}

const getUserProfile = (id) => {
  const body = postRequest(USER_API, { remoteid: id })
  const json = JSON.parse(body || '{}')
  return parseUserProfile(json.data.profile)
}

const getNearly = (lng, lat) => {
  const body = postRequest(NEARLY_API, {
    online_time: '1',
    lat,
    lng,
    age_min: '18',
    age_max: '100',
    sex: LOGIN_USER.sex !== 0 ? 'F' : 'M'
  })
  const json = JSON.parse(body || '{}')
  return json.data.lists.map(({ source }) => {
    const desc = source.signex.desc.split('：')[1]
    const constellation = (source?.sex === 'F' ? '她是' : '他是') + source.constellation
    return {
      use: false,
      id: source.momoid,
      age: source.age,
      sex: source?.sex === 'F' ? 0 : 1,
      sign: source.sign || desc || constellation,
      name: source.name,
      avatar: source.photos[0],
      momoid: LOGIN_USER.id
    }
  })
}

const initLoginEnv = () => {
  const IMApp = Java.use(PKGS.IM_APP)
  const id = IMApp.a().c().getId()
  if (!LOGIN_USER) {
    LOGIN_USER = getUserProfile(id)
    send({ type: TYPES.INIT, data: LOGIN_USER })
  }
}

const nearly = (lng, lat) => {
  const ref = { value: null }
  Java.perform(() => {
    initLoginEnv()
    ref.value = getNearly(lng, lat)
  })
  return ref
}

const post = (message) => {
  Java.perform(() => {
    let msg
    const MessageSender = Java.use(PKGS.MSG_SENDER)
    const MessageHelper = Java.use(PKGS.MSG_HELPER)
    const UserService = Java.use(PKGS.USER_SERVICE)
    const US = UserService.getInstance()
    const owner = US.get(message.momoid)
    const remote = US.get(message.remoteId)
    if (remote != null) {
      const helper = MessageHelper.a()
      msg = helper.a(message.content, remote, null, 1)
      msg.owner.value = owner
    } else {
      msg = newMessage(message, owner)
    }
    const sender = MessageSender.$new()
    sender.b(msg)
  })
}

const newMessage = (message, owner) => {
  const AppCodec = Java.use(PKGS.CODEC)
  const Message = Java.use(PKGS.MESSAGE)
  const msg = Message.$new()
  msg.content.value = message.content
  msg.remoteId.value = message.remoteId
  const messageTime = AppCodec.c()
  msg.customBubbleStyle.value = ''
  msg.messageTime.value = messageTime
  msg.msgId.value = AppCodec.a(message.momoid, message.content, message.remoteId, messageTime)
  msg.owner.value = owner
  return msg
}

const handleMesage = (message, handle) => {
  const json = serialize(message)
  const id = json.remoteId
  const msg = {
    id: json.msgId,
    distance: json.distance,
    content: json.content,
    fromId: json.remoteId,
    toId: json.myMomoId,
    type: Number(json.contentType)
  }
  // 只有文本模式才回传
  if (msg.type === 0) {
    if (!USER_CACHE[id]) {
      USER_CACHE[id] = getUserProfile(id)
    }
    msg.remoteUser = USER_CACHE[id]
    handle && handle(msg)
  }
}

const onMessage = (handle) => {
  const Im = Java.use(PKGS.IMJ)
  const List = Java.use(PKGS.ARRAY_LIST)
  const classes = [
    'java.lang.String',
    'android.os.Bundle',
    'java.lang.Object'
  ]
  const overload = Im.a.overload(...classes)
  overload.implementation = function(...args) {
    const keys = args[1].keySet().toArray().toString()
    if (keys.includes('msgs')) {
      const msgs = args[1].get('msgs')
      const list = List.$new(msgs)
      for (let i = 0; i < list.size(); i++) {
        handleMesage(list.get(i), handle)
      }
    }
    return this.a(...args)
  }
}

const init = () => {
  Java.perform(() => {
    initLoginEnv()
  })
}

const receive = () => {
  Java.perform(() => {
    onMessage((message) => {
      send({ type: TYPES.MESSAGE, data: message })
    })
  })
}

rpc.exports = {
  receive,
  post,
  init,
  nearly
}
`

export const create = async () => {
  const device = await frida.getUsbDevice()
  const session = await device.attach('MOMO陌陌')
  const script = await session.createScript(inject)
  script.load()
  const rpc = script.exports
  return {
    rpc,
    unload: () => {
      script.unload()
    }
  }
}
