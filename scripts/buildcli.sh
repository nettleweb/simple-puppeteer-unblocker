#!/bin/sh
baseDir=$(dirname $(realpath -s $0))/..

cd $baseDir
rm -rf out/client
set -e

if ! [ -e node_modules ]; then
	npm update -g
	npm install
fi

rm -rf "./node_modules/@types/node"
cd $baseDir/src/client && webpack; cd $baseDir
cp -fl out/client/out.js static/main.js
