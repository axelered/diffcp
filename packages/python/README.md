# diffcp

Differential Context Protocol (DCP) implementation in Python.

This package provides a way to stream real-time updates to JSON objects using deltas, reducing bandwidth and keeping state in sync between server and client.

## Installation

```bash
pip install diffcp
```

## Usage

### Client Side

```python
import asyncio
from diffcp import fetch_object_stream

async def main():
    async for data in fetch_object_stream("https://api.example.com/stream"):
        print("Received update:", data)

asyncio.run(main())
```

### Core Logic

```python
from diffcp import diff_create, diff_apply

obj1 = {"a": 1, "b": [1, 2, 3]}
obj2 = {"a": 1, "b": [1, 2, 3, 4]}

# Create a diff
diff = diff_create(obj1, obj2)

# Apply a diff
result = diff_apply(obj1, diff)
assert result == obj2
```

## Features

- **Efficient Deltas**: Only sends what changed.
- **Path Compression**: Uses dictionary-based compression for JSON paths.
- **NDJSON Transport**: Built on top of Newline Delimited JSON.
- **Async First**: Designed for modern async Python (using `httpx`).
