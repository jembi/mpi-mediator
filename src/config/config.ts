export const getConfig = () => {
  return Object.freeze({
    port: process.env.SERVER_PORT || 3000,
    logLevel: process.env.LOG_LEVEL || 'info',
    registerMediator: !!process.env.REGISTER_MEDIATOR
  })
}
