#!/bin/bash
# Set Node.js to treat all files as CommonJS with ES module support
export NODE_OPTIONS="--loader=ts-node/esm"
npx prisma generate
