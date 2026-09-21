#!/bin/sh
set -e
mkdir -p /data
# Redirect portfolio.db and bot.log to the persistent data volume
[ -f /app/portfolio.db ] || touch /data/portfolio.db
ln -sf /data/portfolio.db /app/portfolio.db
ln -sf /data/bot.log /app/bot.log
exec python main.py
