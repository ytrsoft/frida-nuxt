import { create } from '@/server/utils/momo'

export default defineEventHandler(() => {
  create().then(() => {
    console.log('OK')
  })
  return { message: 'OK' }
})
