#!/bin/bash

export COMPOSE_IGNORE_ORPHANS=1

FILE_PATH=$(
  cd "$(dirname "${BASH_SOURCE[0]}")" || exit
  pwd -P
)
readonly FILE_PATH

timeout_check() {
  local startTime=$(($1))
  local message=$2
  local exitTime="${3:-300}"
  local warningTime="${4:-60}"

  local timeDiff=$(($(date +%s) - startTime))
  if [[ $timeDiff -ge $warningTime ]] && [[ $timeDiff -lt $((warningTime + 1)) ]]; then
    echo "Warning: Waited $warningTime seconds for $message. This is taking longer than it should..."
  elif [[ $timeDiff -ge $exitTime ]]; then
    echo "Fatal: Waited $exitTime seconds for $message. Exiting..."
    exit 124
  fi
}

await_container_startup() {
  local -r SERVICE_NAME=$1

  local start_time
  start_time=$(date +%s)
  until [[ -n $(docker ps -qf name="${SERVICE_NAME}") ]]; do
    timeout_check "${start_time}" "${SERVICE_NAME} to start"
    sleep 1
  done
}

await_container_status() {
  local -r SERVICE_NAME=$1
  local -r SERVICE_STATUS=$2

  local start_time
  start_time=$(date +%s)
  until [[ $(docker container inspect "${SERVICE_NAME}" -f "{{.State.Status}}" 2>/dev/null) == *"${SERVICE_STATUS}"* ]]; do
    timeout_check "${start_time}" "${SERVICE_NAME} to start"
    sleep 1
  done
}

await_container_healthy() {
  local -r SERVICE_NAME=$1
  local -r SERVICE_STATUS=$2

  local start_time
  start_time=$(date +%s)
  until [[ $(docker container inspect "${SERVICE_NAME}" -f "{{.State.Health.Status}}" 2>/dev/null) == *"${SERVICE_STATUS}"* ]]; do
    timeout_check "${start_time}" "${SERVICE_NAME} to start"
    sleep 1
  done
}

main() {
  docker-compose -p mediator_tests -f "$FILE_PATH"/docker-compose-postgres.yml up -d
  await_container_startup postgres-1
  await_container_status postgres-1 running

  docker-compose -p mediator_tests -f "${FILE_PATH}"/docker-compose.yml up -d
  await_container_startup hapi-fhir
  await_container_status hapi-fhir running
  await_container_healthy hapi-fhir healthy
}

main "$@"
