FROM python:3.12-slim

WORKDIR /app

COPY polymarket/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY polymarket/ .
COPY polymarket.entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
