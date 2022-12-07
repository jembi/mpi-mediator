#!/bin/bash

set -e

export COMPOSE_IGNORE_ORPHANS=1

FILE_PATH=$(
  cd "$(dirname "${BASH_SOURCE[0]}")" || exit
  pwd -P
)
readonly FILE_PATH

ROOT_PATH="${FILE_PATH}/.."
. "${ROOT_PATH}/utils/utils.sh"

main() {
  docker-compose -p mediator_tests -f "$FILE_PATH"/docker-compose.mongo-db.yml up -d
  util::await_container_ready mongo-db running false

  docker-compose -p mediator_tests -f "${FILE_PATH}"/docker-compose.openhim-core.yml up -d
  util::await_container_ready openhim-core running true

  node "$FILE_PATH"/openhimConfig.js
}

main "$@"
