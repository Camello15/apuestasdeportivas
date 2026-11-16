from datetime import UTC, datetime

from fastapi import FastAPI

app = FastAPI(title="Apuestas - Reportes")


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "reports",
        "timestamp": datetime.now(UTC).isoformat(),
    }
