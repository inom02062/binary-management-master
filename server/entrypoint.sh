#!/bin/sh
set -e

echo "[entrypoint] generate prisma client"
./node_modules/.bin/prisma generate

if [ "$NODE_ENV" = "production" ]; then
	echo "[entrypoint] applying tracked migrations"
	./node_modules/.bin/prisma migrate deploy
else
	echo "[entrypoint] syncing schema for development"
	./node_modules/.bin/prisma db push
fi

echo "[entrypoint] starting server"
./node_modules/.bin/nodemon server/index.js
