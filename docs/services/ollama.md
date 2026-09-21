# Ollama

> Runs large language models locally on the server.

| | |
|---|---|
| Status | Running |
| Address | http://<server>:11434 (API only) |
| Defined in | `docker-compose.yml` (`ollama:`) |
| Image | `ollama/ollama:latest` |
| Data | `/mnt/data/docker/ollama` (about 14 GB of models) |

## What it does

- Serves an HTTP API for downloading and running open-weight models such as Llama or Gemma. [Open WebUI](open-webui.md) and the [dashboard](dashboard.md) talk to it.

## Why it is here

- Keeps prompts and documents on the local machine instead of sending them to a cloud service.

## How it is set up

- Port 11434; models stored in `/root/.ollama` on the data disk.
- CPU only. The commented-out block in the compose file is for an NVIDIA GPU; this machine has only an Intel UHD (Tiger Lake) integrated GPU, which Ollama does not use here.
- Currently installed models: `nomic-embed-text` (used by Open WebUI for document search), `gemma3:12b`, and a Llama 3.1 8B variant.

## First run

- Pull a model: `docker exec ollama ollama pull <model>`; or use the dashboard's Models page.

## Data and backups

- Deliberately **excluded** from the [backup](../backup.md): the models are large and can simply be pulled again.

## Operating notes

- The API has no authentication and port 11434 is published, so anything on the LAN can use it.
- Larger models on a CPU are slow; the 12B model needs roughly 8 GB of RAM at typical quantisation.

## Related

- [Open WebUI](open-webui.md), [Dashboard](dashboard.md)
