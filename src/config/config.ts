export const getConfig = () => {
  return Object.freeze({
    port: process.env.SERVER_PORT || 3000,
    logLevel: process.env.LOG_LEVEL || 'info',
    registerMediator: !!process.env.REGISTER_MEDIATOR
  });
};

/* ---------------------------- Openhim Config -------------------------------------- */
export const OPENHIM_MEDIATOR_URL = process.env.OPENHIM_MEDIATOR_URL || 'https://localhost:8080';

export const OPENHIM_USERNAME = process.env.OPENHIM_USERNAME || 'root@openhim.org';

export const OPENHIM_PASSWORD = process.env.OPENHIM_PASSWORD || 'instant101';

export const OPENHIM_CLIENT_CUSTOM_TOKEN = process.env.OPENHIM_CLIENT_CUSTOM_TOKEN || 'test';

export const REGISTER_MEDIATOR = process.env.REGISTER_MEDIATOR === 'false' ? false : true;

export const TRUST_SELF_SIGNED = process.env.TRUST_SELF_SIGNED === 'true' ? true : false;
/* ---------------------------------------------------------------------------------- */
