#!/bin/bash

# A function that exists in a loop to see how long that loop has run for, providing a warning
# at the time specified in argument $3, and exits with code 124 after the time specified in argument $4.
#
# Arguments:
# - $1 : start time of the timeout check
# - $2 : a message containing reference to the loop that timed out
# - $3 : timeout time in seconds, default is 300 seconds
# - $4 : elapsed time to issue running-for-longer-than-expected warning (in seconds), default is 60 seconds
util::timeout_check() {
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

# Waits for a container to be up
#
# Arguments:
# - $1 : service name (eg. hapi-fhir)
#
util::await_container_startup() {
  local -r SERVICE_NAME=${1:?"FATAL: await_container_startup parameter not provided"}

  local start_time
  start_time=$(date +%s)
  until [[ -n $(docker ps -qf name="${SERVICE_NAME}") ]]; do
    util::timeout_check "${start_time}" "${SERVICE_NAME} to start"
    sleep 1
  done
}

# Waits for a container to be up
#
# Arguments:
# - $1 : service name (eg. hapi-fhir)
# - $2 : service status (eg. running)
#
util::await_container_status() {
  local -r SERVICE_NAME=${1:?"FATAL: await_container_status parameter not provided"}
  local -r SERVICE_STATUS=${2:?"FATAL: await_container_status parameter not provided"}

  local start_time
  start_time=$(date +%s)
  until [[ $(docker container inspect "${SERVICE_NAME}" -f "{{.State.Status}}" 2>/dev/null) == *"${SERVICE_STATUS}"* ]]; do
    util::timeout_check "${start_time}" "${SERVICE_NAME} to start"
    sleep 1
  done
}

# Waits for a container's health check to pass
#
# Arguments:
# - $1 : service name (eg. hapi-fhir)
#
util::await_container_healthy() {
  local -r SERVICE_NAME=${1:?"FATAL: await_container_healthy parameter not provided"}

  local start_time
  start_time=$(date +%s)
  until [[ $(docker container inspect "${SERVICE_NAME}" -f "{{.State.Health.Status}}" 2>/dev/null) == *"healthy"* ]]; do
    util::timeout_check "${start_time}" "${SERVICE_NAME} to start"
    sleep 1
  done
}

# An aggregate function to do multiple service ready checks in one function
#
# Arguments:
# - $1 : service name (eg. hapi-fhir)
# - $2 : service status (eg. running)
# - $3 : with health check, true to run util::await_container_healthy(), anything else to not await healthcheck
#
util::await_container_ready() {
  local -r SERVICE_NAME=${1:?"FATAL: await_container_ready parameter not provided"}
  local -r SERVICE_STATUS=${2:?"FATAL: await_container_ready parameter not provided"}
  local -r HEALTH_CHECK=${3:?"FATAL: await_container_ready parameter not provided"}

  util::await_container_startup "$SERVICE_NAME"
  util::await_container_status "$SERVICE_NAME" "$SERVICE_STATUS"

  if [[ $HEALTH_CHECK == "true" ]]; then
    util::await_container_healthy "$SERVICE_NAME"
  fi
}
