#!/bin/bash

export COMPOSE_IGNORE_ORPHANS=1

FILE_PATH=$(
  cd "$(dirname "${BASH_SOURCE[0]}")" || exit
  pwd -P
)
readonly FILE_PATH

ROOT_PATH="${FILE_PATH}/.."
. "${ROOT_PATH}/utils/utils.sh"

main() {
  docker-compose -p mediator_tests -f "$FILE_PATH"/docker-compose.postgres.yml up -d
  util::await_container_ready postgres-1 running false

  docker-compose -p mediator_tests -f "${FILE_PATH}"/docker-compose.hapi-fhir.yml up -d
  util::await_container_ready hapi-fhir running true
}

main "$@"
