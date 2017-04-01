#! /bin/bash

SASS=./node_modules/.bin/node-sass
LOG=./running.log
PID=./running.pid

if [[ $1 == 'start' ]]
  then
  echo 'Compiling styles'
  $SASS --output dist --recursive sass
fi

if [[ $1 == 'stop' ]]
  then
  echo 'Done watching style changes'
  kill $(cat $PID)
  rm -f $LOG $PID
fi

# start the watcher in the background, capturing the process PID for easy kill
if [[ $1 == 'watch' ]]
  then
  echo 'Watching style changes'
  $SASS --output dist --recursive sass --watch > $LOG 2>&1 &
  echo $! > $PID
fi
