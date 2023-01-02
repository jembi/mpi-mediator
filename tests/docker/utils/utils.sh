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

# A function that will return a message called when of parameter not provided
#
# Arguments:
# - $1 : optional - function name missing the parameter
# - $2 : optional - name of the parameter missing
missing_param() {
  local FUNC_NAME=${1:-""}
  local ARG_NAME=${2:-""}

  echo "FATAL: ${FUNC_NAME} parameter ${ARG_NAME} not provided"
}

# Waits for a container to be up
#
# Arguments:
# - $1 : service name (eg. hapi-fhir)
#
util::await_container_startup() {
  local -r SERVICE_NAME=${1:?$(missing_param await_container_startup)}

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
  local -r SERVICE_NAME=${1:?$(missing_param await_container_status SERVICE_NAME)}
  local -r SERVICE_STATUS=${2:?$(missing_param await_container_status SERVICE_STATUS)}

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
  local -r SERVICE_NAME=${1:?$(missing_param await_container_healthy)}

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
  local -r SERVICE_NAME=${1:?$(missing_param await_container_ready SERVICE_NAME)}
  local -r SERVICE_STATUS=${2:?$(missing_param await_container_ready SERVICE_STATUS)}
  local -r HEALTH_CHECK=${3:?$(missing_param await_container_ready HEALTH_CHECK)}

  echo -n "Waiting for $SERVICE_NAME to be ready..."

  util::await_container_startup "$SERVICE_NAME"
  util::await_container_status "$SERVICE_NAME" "$SERVICE_STATUS"

  if [[ $HEALTH_CHECK == "true" ]]; then
    util::await_container_healthy "$SERVICE_NAME"
  fi

  echo -e "\rWaiting for $SERVICE_NAME to be ready... Done"
}

# Waits for a container's startup logs to stabilize
#
# Arguments:
# - $1 : service name (eg. hapi-fhir)
# - $2 : stable time, if the logs remain stable for this time, the function passes
#
util::await_container_logs_stable() {
  local -r SERVICE_NAME=${1:?$(missing_param await_container_logs_stable SERVICE_NAME)}
  local -r STABLE_TIME=${2:?$(missing_param await_container_logs_stable STABLE_TIME)}

  local start_time
  start_time=$(date +%s)
  local tried_for=0
  local prev_count=0
  until [[ $tried_for -ge $STABLE_TIME ]]; do
    local curr_count
    curr_count=$(docker logs "$SERVICE_NAME" | wc | sed -e 's/^[ \t]*//' | sed -e 's/ .*//')

    if [[ $curr_count -ne $prev_count ]]; then
      tried_for=0
    fi

    util::timeout_check "${start_time}" "${SERVICE_NAME} logs to stabilize"

    tried_for=$((tried_for + 1))
    prev_count=$curr_count

    sleep 1
  done
}
