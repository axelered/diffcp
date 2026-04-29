import asyncio
import json
from collections.abc import AsyncIterable, Callable
from typing import Any, TypeVar

import httpx
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

T = TypeVar('T')


class PlainJsonError(Exception):
    def __init__(self, data: Any):
        self.data = data
        super().__init__('fetch failed: received plain application/json response')


def parse_content_type(value: str) -> tuple[str, str]:
    parts = value.split(';')
    type_part = parts[0].strip().lower()
    parameters: dict[str, str] = {}
    for part in parts[1:]:
        if '=' not in part:
            continue
        key, val = part.split('=', 1)
        key = key.strip().lower()
        val = val.strip()
        if val.startswith('"') and val.endswith('"'):
            val = val[1:-1]
        parameters[key] = val
    return type_part, parameters.get('charset', 'utf-8')


async def fetch_ndjson[T](url: str, *, on_line: Callable[[T], None] | None = None, **kwargs: Any) -> AsyncIterable[T]:
    async with httpx.AsyncClient() as client:
        async with client.stream('GET', url, **kwargs) as res:
            if not res.is_success:
                raise Exception(f'fetch failed: {res.status_code} {res.reason_phrase}')

            ct_header = res.headers.get('content-type', '')
            content_type, encoding = parse_content_type(ct_header)

            if content_type == 'application/x-ndjson':
                res.encoding = encoding
                buffer = ''
                async for chunk in res.aiter_text():
                    buffer += chunk
                    lines = buffer.split('\n')
                    buffer = lines.pop()
                    for line in lines:
                        trimmed = line.strip()
                        if not trimmed:
                            continue
                        val = json.loads(trimmed)
                        if on_line:
                            on_line(val)
                        yield val

                tail = buffer.strip()
                if tail:
                    val = json.loads(tail)
                    if on_line:
                        on_line(val)
                    yield val
            elif content_type == 'application/json':
                await res.aread()
                data = res.json()
                raise PlainJsonError(data)
            else:
                raise Exception(f'fetch failed: invalid response content type {ct_header}')


class NDJSONStreamingResponse(StreamingResponse):
    """
    Utility for creating an application/x-ndjson streaming response with periodic heartbeats.
    """

    def __init__(
        self,
        content: AsyncIterable[Any],
        status_code: int = 200,
        headers: dict[str, str] | None = None,
        ping_interval: int | float = 15,
        **kwargs: Any,
    ) -> None:
        async def _data_stream():
            iterator = content.__aiter__()
            while True:
                try:
                    data = await asyncio.wait_for(iterator.__anext__(), timeout=ping_interval)
                    if isinstance(data, BaseModel):
                        yield data.model_dump_json() + '\n'
                    elif isinstance(data, (dict, list)):
                        yield json.dumps(data) + '\n'
                    else:
                        yield str(data) + '\n'
                except TimeoutError:
                    yield '\n'  # Heartbeat
                except StopAsyncIteration:
                    break

        super().__init__(
            content=_data_stream(),
            status_code=status_code,
            headers={
                'Content-Type': 'application/x-ndjson; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
                **(headers or {}),
            },
            **kwargs,
        )
