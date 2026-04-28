# diffcp

Differential Context Protocol (DCP) implementation in Python.

This package provides a high-performance implementation of the Differential Context Protocol (DCP), allowing you to stream real-time updates to JSON objects using deltas. It significantly reduces bandwidth by sending only what changed and employs dictionary-based path compression.

## Installation

```bash
pip install diffcp
# or with uv
uv add diffcp
```

## Usage

### Backend (FastAPI / Starlette)

The `ObjectStreamResponse` handles the diff calculation, state management, and heartbeats automatically. It has built-in support for **Pydantic** models.

```python
import asyncio
from fastapi import FastAPI
from pydantic import BaseModel
from diffcp import ObjectStreamResponse, StreamEvent, StreamReinit

app = FastAPI()

class ChatState(BaseModel):
    text: str
    tokens: int

async def state_generator():
    state = ChatState(text="Hello", tokens=1)
    yield state # First yield is sent as 'init'
    
    for i in range(2, 6):
        await asyncio.sleep(0.5)
        # Just yield the new state; diffcp calculates the delta automatically
        state = ChatState(text="Hello world", tokens=i)
        yield state 
    
    # Send a custom side-channel event
    yield StreamEvent(data={"status": "completed"})

@app.get("/stream")
async def stream():
    return ObjectStreamResponse(state_generator())
```

### Client Side

```python
import asyncio
from diffcp import fetch_object_stream

async def main():
    # Automatically reconstructs the object from deltas
    async for data in fetch_object_stream("http://localhost:8000/stream"):
        print("Updated state:", data)

asyncio.run(main())
```

### Core Logic (Manual)

If you need to handle diffs manually without the streaming response:

```python
from diffcp import diff_create, diff_apply

obj1 = {"a": 1, "b": [1, 2, 3], "text": "Hello"}
obj2 = {"a": 1, "b": [1, 2, 3, 4], "text": "Hello World"}

# Create an optimized diff
# Result: [('a', '/b/-', 4), ('a', '/text/-', ' World')]
diff = diff_create(obj1, obj2)

# Apply it back
result = diff_apply(obj1, diff)
assert result == obj2
```

## Features

- **Pydantic Integration**: Seamlessly handles `BaseModel` instances in streams.
- **Efficient Deltas**: Uses JSON Pointer (RFC 6901) and string-append optimizations.
- **Path Compression**: Transparently compresses repetitive JSON paths during transmission.
- **Heartbeats**: Built-in `\n` pings to keep connections alive through proxies and load balancers.
- **Zero-Dep Core**: The diff engine and server logic are lightweight, requiring only `pydantic`. The client uses `httpx`.
