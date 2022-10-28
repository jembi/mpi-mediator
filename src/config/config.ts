export const getConfig = () => {
  return Object.freeze({
    port: process.env.SERVER_PORT || 3000,
    logLevel: process.env.LOG_LEVEL || 'info',
    registerMediator: !!process.env.REGISTER_MEDIATOR,
    openhimMediatorUrl: process.env.OPENHIM_MEDIATOR_URL || 'https://localhost:8080',
    openhimUsername: process.env.OPENHIM_USERNAME || 'root@openhim.org',
    openhimPassword: process.env.OPENHIM_PASSWORD || 'instant101',
    trustSelfSigned: !!process.env.TRUST_SELF_SIGNED
  });
};
