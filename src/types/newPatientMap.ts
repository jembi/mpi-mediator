import { Patient } from 'fhir/r3';
import { MpiTransformResult } from './response';

export interface NewPatientMap {
  [key: string]: PatientData;
}

export interface PatientData {
  mpiTransformResult?: MpiTransformResult;
  mpiResponsePatient?: Patient;
  restoredPatient?: Patient;
}
