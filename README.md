# Cascade

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Apache Kafka](https://img.shields.io/badge/Kafka-231F20?logo=apachekafka&logoColor=white)](https://kafka.apache.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-000000?logo=opentelemetry&logoColor=white)](https://opentelemetry.io/)

Cascade is a CDC (Change Data Capture) pipeline that replicates PostgreSQL changes using Postgres WAL to construct SQL statements to read replicas via Kafka events stream.

## Architecture

<img width="1190" height="406" alt="image" src="https://github.com/user-attachments/assets/f7c74e77-30cc-4eb9-b5d0-4d7699ffdc16" />


## Components

- **cdc/** - Captures WAL changes and publishes to Kafka
- **shard-router/** - Consumes Kafka messages and applies to replicas
- **shared/** - Common OpenTelemetry instrumentation

## Features

- **Scalable**: Spin up as many replica routers as you need
- **Database Agnostic**: Replica databases can be any SQL database (MySQL, MariaDB, SQLite, etc.) as long as the value types are supported

## Prerequisites

The primary PostgreSQL database must have the [wal2json](https://github.com/eulerto/wal2json) extension installed and logical replication enabled. See the `main-db/` directory for an example setup.

## Quick Start

The included `docker-compose.yml` provides a complete demo environment with:
- **main-db** - Example primary PostgreSQL with wal2json enabled
- **shard1-db** - Example read replica
- **Kafka, Jaeger, Prometheus, Grafana** - Supporting infrastructure

> **Note**: The databases are included as examples. In production, you would connect to your own PostgreSQL instances.

```bash
docker compose up --build
```

## Observability

- **Jaeger**: http://localhost:16686 (traces)
- **Prometheus**: http://localhost:9090 (metrics)
- **Grafana**: http://localhost:3000 (dashboards)

This project uses [Bun](https://bun.sh) runtime.
