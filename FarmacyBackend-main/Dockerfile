# -------- Build stage --------
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
 && rm -rf /var/lib/apt/lists/*

# Copy only requirements and install into a temporary folder
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# -------- Final stage --------
FROM python:3.11-slim

WORKDIR /app

# Install runtime-only system packages
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    postgresql-client \
 && rm -rf /var/lib/apt/lists/*

# Copy installed python packages
COPY --from=builder /install /usr/local

# Create credentials directory and copy file(s)
RUN mkdir -p /app/credentials
COPY farmacy-3e39b-firebase-adminsdk-fbsvc-e7fe7a6753.json /app/credentials/

# Copy app code
COPY . .

EXPOSE 5000
CMD ["python", "-m", "app.main"]