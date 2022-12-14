#!/bin/bash

function init_vars() {
  export COMPOSE_IGNORE_ORPHANS=1

  FILE_PATH=$(
    cd "$(dirname "${BASH_SOURCE[0]}")" || exit
    pwd -P
  )

  readonly COMPOSE_IGNORE_ORPHANS
  readonly FILE_PATH
}

# shellcheck disable=SC1091
function import_sources() {
  source "$FILE_PATH/utils/utils.sh"
}

function deploy_services() {
  docker-compose -p mediator_tests -f "$FILE_PATH"/sante-mpi/docker-compose.sante-mpi.yml up -d &
  docker-compose -p mediator_tests -f "$FILE_PATH"/hapi-fhir/docker-compose.hapi-fhir.yml up -d &
  docker-compose -p mediator_tests -f "$FILE_PATH"/openhim/docker-compose.openhim.yml up -d &
}

function await_sante_mpi() {
  util::await_container_ready santempi-psql-1 running false
  util::await_container_ready santedb-mpi running false
  util::await_container_ready santedb-www running false
  util::await_container_logs_stable santedb-mpi 10
}

function await_hapi_fhir() {
  util::await_container_ready postgres-1 running false
  util::await_container_ready hapi-fhir running true
}

function await_openhim() {
  util::await_container_ready mongo-db running false
  util::await_container_ready openhim-core running true
}

function configure_openhim() {
  node "$FILE_PATH"/openhim/openhimConfig.js
}

main() {
  init_vars

  import_sources

  deploy_services

  await_sante_mpi

  await_hapi_fhir

  await_openhim

  configure_openhim
}

main "$@"
