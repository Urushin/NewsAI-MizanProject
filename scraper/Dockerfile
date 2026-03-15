FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy both scraper app and the original collector logic
COPY scraper/app.py .
COPY backend/collector.py .
COPY backend/models.py .
COPY backend/database.py .
COPY backend/config.json .

# Create dummy .env if needed or pass via K8s
RUN touch .env

EXPOSE 8001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
