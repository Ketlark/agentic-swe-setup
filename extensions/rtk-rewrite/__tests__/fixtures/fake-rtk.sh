#!/bin/bash
# Fake RTK binary for testing. Simulates `rtk rewrite <command>`.

if [ "$1" = "--version" ]; then
  echo "rtk 0.99.0-fake"
  exit 0
fi

if [ "$1" = "rewrite" ]; then
  shift
  cmd="$*"
  case "$cmd" in
    "git status")     echo "rtk git status" ;;
    "ls -la")         echo "rtk ls -la" ;;
    "cargo test")     echo "rtk cargo test" ;;
    "echo hello")     echo "echo hello" ;;
    "SLEEP_FOREVER")  sleep 60 ;;
    "FAIL_EXIT")      exit 1 ;;
    *)                echo "$cmd" ;;
  esac
  exit 0
fi

echo "usage: rtk <command>" >&2
exit 1
