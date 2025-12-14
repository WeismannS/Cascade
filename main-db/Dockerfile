FROM postgres:18

# Install wal2json plugin for logical replication
RUN apt-get update && apt-get install -y postgresql-18-wal2json && rm -rf /var/lib/apt/lists/*
