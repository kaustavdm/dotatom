#!/bin/sh

set -e

for dir in packages/*/
do
    pushd "$dir"
    apm install
    popd
done
