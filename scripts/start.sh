#!/bin/sh
baseDir=$(dirname $(realpath -s $0))/..
cd $baseDir
set -e
node . > /dev/null 2>&1&
