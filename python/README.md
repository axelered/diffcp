# ☄️ Diffcp Python

Diffcp (Differential Context Protocol) is the new standard to stream AI Agent state to the user interface. This is the Python implementation, purpose-built for FastAPI and high-efficiency streaming (95%+ compression).

- [GitHub](https://github.com/axelered/diffcp)
- [Issues](https://github.com/axelered/diffcp/issues)

## Installation

```bash
pip install diffcp-fastapi
# or with uv
uv add diffcp-fastapi
```

## Quick Start

Convert your existing APIs to a streaming endpoint with **one line** and a simple generator which **yields updated state objects**.

```python
from fastapi import FastAPI
from pydantic import BaseModel
from diffcp import ObjectStreamResponse

app = FastAPI()

class ChatState(BaseModel):
    text: str

async def state_generator():
    yield ChatState(text="Hello")
    yield ChatState(text="Hello world")

@app.get("/stream")
async def stream():
    return ObjectStreamResponse(state_generator())
```

Then on the client, just **consume an updating state stream**:

```python
from diffcp import fetch_object_stream

async def main():
    async for data in fetch_object_stream("http://localhost:8000/stream"):
        print("State update:", data)
```

---

## API Reference

### `ObjectStreamResponse`

```python
class ObjectStreamResponse(
    content: AsyncIterable[T | StreamReinit | StreamEvent],
    status_code: int = 200,
    headers: dict[str, str] | None = None,
    ping_interval: int | float = 15,
    send_data_on_done: bool = False,
    compressed: bool = True,
    **kwargs: Any
)
```

FastAPI/Starlette response implementation for the Differential Context Protocol (DCP).

#### Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `content` | `AsyncIterable` | Stream of objects, `StreamReinit`, or `StreamEvent` |
| `ping_interval` | `int \| float` | Heartbeat interval in seconds. Default: `15` |
| `send_data_on_done`| `bool` | Send final state on completion. Default: `False` |
| `compressed` | `bool` | Enable dictionary-based path compression. Default: `True` |

---

### `fetch_object_stream`

```python
async def fetch_object_stream[T, E](
    url: str,
    *,
    on_data: Callable[[T], None] | None = None,
    on_event: Callable[[E], None] | None = None,
    on_frame: Callable[[dict[str, Any]], None] | None = None,
    fallback_plain_json: bool = True,
    **kwargs: Any
) -> AsyncIterable[T]
```

Fetches and processes a DCP object stream, automatically reconstructing the state from deltas.

#### Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `url` | `str` | Request target URL |
| `on_data` | `Callable` | Called per data update |
| `on_event` | `Callable` | Called per custom event |
| `fallback_plain_json`| `bool` | Accept plain `application/json`. Default: `True` |

---

### `NDJSONStreamingResponse`

```python
class NDJSONStreamingResponse(
    content: AsyncIterable[Any],
    status_code: int = 200,
    headers: dict[str, str] | None = None,
    ping_interval: int | float = 15,
    **kwargs: Any
)
```

Utility for streaming newline-delimited JSON messages with heartbeats.

---

### `fetch_ndjson`

```python
async def fetch_ndjson[T](
    url: str,
    *,
    on_line: Callable[[T], None] | None = None,
    **kwargs: Any
) -> AsyncIterable[T]
```

Fetches and parses a standard NDJSON stream.

---

### `diff_create` & `diff_apply`

```python
def diff_create(from_val: Any | None, to_val: Any) -> ObjectPatchDiff
def diff_apply(value: Any, diff: ObjectPatchDiff) -> Any
```

Low-level utilities for calculating and applying DCP-optimized patches.

---

## Features

- **FastAPI Integration**: Built directly on top of FastAPI/Starlette for high-performance streaming.
- **Pydantic Integration**: Seamlessly handles `BaseModel` instances in streams.
- **Efficient Deltas**: Uses JSON Pointer (RFC 6901) and string-append optimizations.
- **Path Compression**: Transparently compresses repetitive JSON paths during transmission.
- **Heartbeats**: Built-in `\n` pings to keep connections alive through proxies and load balancers.
- **Lightweight**: Optimized for low overhead and high concurrency.
