FROM python:3.12-slim

WORKDIR /app

COPY tradingbot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY tradingbot/ .
COPY tradingbot.entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
