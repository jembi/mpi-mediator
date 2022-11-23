import { RequestHandler } from 'express';
import logger from '../logger';
import { buildOpenhimResponseObject } from '../routes/utils';
import { OAuth2Error } from '../utils/client-oauth2';
import { fetchSanteMpiPatientLinks } from '../utils/sante-mpi';

/**
 * Express middleware in order to perform MDM expansion requests using Sante MPI
 * So that :
 *  >> GET http://example.com:8000/Observation?subject:mdm=Patient/1
 * Becomes
 *  >> GET http://example.com:8000/Observation?subject=Patient/1,Patient/2,Patient/3
 *
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
export const santeMpiMdmQueryLinksMiddleware: RequestHandler = async (req, res, next) => {
  const mdmParam = Object.keys(req.query).find((q) => q.endsWith(':mdm'));
  if (!mdmParam) {
    logger.info(
      `${req.method} ${req.path} request to SanteMPI MDM Middleware - No MDM expansion taking place`
    );
    // No MDM expansion, we forward request as it is directly to FHIR Datastore
    return next();
  }
  // MDM expansion requested
  try {
    const patientRef = req.query[mdmParam] as string;
    const searchParam = mdmParam.replace(':mdm', '');
    const patientRefs: string[] = [];
    logger.info(
      `${req.method} ${req.path} request - MDM expansion ${patientRef} using ${mdmParam}`
    );
    await fetchSanteMpiPatientLinks(patientRef, patientRefs);
    // Substitue the mdm search param and expand the list of patients
    req.query[searchParam] = patientRefs.join(',');
    delete req.query[mdmParam];
    logger.debug(
      `${req.method} ${req.path} request - MDM expanded ${searchParam}=${req.query[searchParam]}`
    );
    // Proxy request to FHIR Datastore
    next();
  } catch (e) {
    const error = e as OAuth2Error | Error;
    logger.error(e, 'Unable to perform an MDM expansion request');
    const status = 500;
    const body = buildOpenhimResponseObject(status.toString(), status, error);
    res.status(status).send(body);
  }
};
