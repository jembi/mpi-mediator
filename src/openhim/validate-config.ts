import { createValidator } from "@typeonly/validator";

import { join } from "path";
import { MediatorConfig } from '../types/mediatorConfig';

export function validateConfiguration(data: unknown): asserts data is MediatorConfig {
    const validator = createValidator({
        bundle: require(join(__dirname, '..', 'types', 'conf-types.to.json'))
    })

    const result = validator.validate("MediatorConfig", data)
    if (!result.valid) {
        throw `invalid config file: ${result.error}`
    }
}
