#!/bin/sh
set -e

echo "[entrypoint] generate prisma client"
case "${DB_PROVIDER:-}:${DATABASE_URL:-}" in
	postgresql:*|*:postgres://*|*:postgresql://*)
		./node_modules/.bin/prisma generate --schema prisma/postgres/schema.prisma
		echo "[entrypoint] starting PostgreSQL server"
		if [ "$NODE_ENV" = "production" ]; then
			exec node server/index.js
		fi
		exec ./node_modules/.bin/nodemon server/index.js
		;;
	*)
		./node_modules/.bin/prisma generate

		if [ "$NODE_ENV" = "production" ]; then
			echo "[entrypoint] applying tracked migrations"
			./node_modules/.bin/prisma migrate deploy
			exec node server/index.js
		else
			echo "[entrypoint] syncing schema for development"
			./node_modules/.bin/prisma db push
			exec ./node_modules/.bin/nodemon server/index.js
		fi
		;;
esac
