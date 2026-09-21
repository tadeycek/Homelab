#!/bin/sh
set -e
mkdir -p /data
ln -sf /data/trading_bot.log /app/trading_bot.log
exec python main.py
