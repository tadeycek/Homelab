# Open WebUI

> A ChatGPT-style web interface for local models, with document upload and search.

| | |
|---|---|
| Status | Running (healthy) |
| Address | http://<server>:3000 |
| Defined in | `docker-compose.yml` (`open-webui:`) |
| Image | `ghcr.io/open-webui/open-webui:main` |
| Data | `/mnt/data/docker/open-webui` (about 0.9 GB) |

## What it does

- Chat interface with accounts, saved conversations, model switching, and retrieval over uploaded documents.

## Why it is here

- It is the friendly front end for [Ollama](ollama.md).

## How it is set up

- `depends_on: ollama`; port 3000 to container 8080.
- Environment: `OLLAMA_BASE_URL=http://ollama:11434`, `WEBUI_SECRET_KEY` from `.env` (`OPEN_WEBUI_SECRET_KEY`), `RAG_EMBEDDING_ENGINE=ollama`, `RAG_EMBEDDING_MODEL=nomic-embed-text`.
- Data (users, chats, uploaded documents, vector store) in `/app/backend/data`.

## First run

- The first account created becomes the administrator.
- Make sure the embedding model is present (`ollama pull nomic-embed-text`) or document search will fail.

## Data and backups

- `open-webui/` is included in the [backup](../backup.md).

## Operating notes

- Keep `OPEN_WEBUI_SECRET_KEY` stable; changing it invalidates existing login sessions.
- Uses the moving `main` tag, so upgrades are immediate on pull.

## Related

- [Ollama](ollama.md)
