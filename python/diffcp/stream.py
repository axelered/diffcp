from collections.abc import AsyncIterable, Callable
from typing import Any, TypeVar

from pydantic import BaseModel
from pydantic_core import to_jsonable_python

from .diff import diff_apply, diff_create
from .ndjson import NDJSONStreamingResponse, PlainJsonError, fetch_ndjson
from .zip import deflate, inflate

T = TypeVar('T')
E = TypeVar('E')


class StreamEvent:
    """
    Emit an event via DCP.
    """

    def __init__(self, data: Any):
        self.data = data


class StreamReinit:
    """
    Force a complete object update.
    """

    def __init__(self, data: Any):
        self.data = data


async def fetch_object_stream[T, E](
    url: str,
    *,
    on_data: Callable[[T], None] | None = None,
    on_event: Callable[[E], None] | None = None,
    on_frame: Callable[[dict[str, Any]], None] | None = None,
    fallback_plain_json: bool = True,
    **kwargs: Any,
) -> AsyncIterable[T]:
    data_value: Any = None
    done = False

    try:
        nd_stream = fetch_ndjson(url, **kwargs)
        async for frame in inflate(nd_stream):
            if on_frame:
                on_frame(frame)

            t = frame['t']
            d: Any = frame.get('d')

            if t == 'init':
                data_value = d
                if on_data:
                    on_data(data_value)
                yield data_value
            elif t == 'delta':
                data_value = diff_apply(data_value, d)
                if on_data:
                    on_data(data_value)
                yield data_value
            elif t == 'event':
                if on_event:
                    on_event(d)
            elif t == 'done':
                if d is not None:
                    data_value = d
                done = True
    except PlainJsonError as e:
        if fallback_plain_json:
            yield e.data
            return
        else:
            raise e

    if data_value is None:
        raise Exception('Object stream ended without any data')
    if not done:
        raise Exception('Object stream ended without done signal')


class ObjectStreamResponse(NDJSONStreamingResponse):
    """
    Differential Context Protocol (DCP) streaming response.
    """

    def __init__(
        self,
        content: AsyncIterable[T | StreamReinit | StreamEvent],
        status_code: int = 200,
        headers: dict[str, str] | None = None,
        ping_interval: int | float = 15,
        send_data_on_done: bool = False,
        compressed: bool = False,
        **kwargs: Any,
    ) -> None:
        async def _diff_wrapper() -> AsyncIterable[dict[str, Any]]:
            last: Any | None = None
            async for chunk in content:
                # Send custom events
                if isinstance(chunk, StreamEvent):
                    event_data = chunk.data
                    if isinstance(event_data, BaseModel):
                        event_data = event_data.model_dump(mode='json', by_alias=True)
                    yield {'t': 'event', 'd': to_jsonable_python(event_data)}
                    continue

                # Perform reinit
                if isinstance(chunk, StreamReinit):
                    chunk = chunk.data
                    last = None

                # Handle Pydantic models
                if isinstance(chunk, BaseModel):
                    current = chunk.model_dump(mode='json', by_alias=True)
                else:
                    current = to_jsonable_python(chunk)

                if last is None:
                    yield {'t': 'init', 'd': current}
                else:
                    diff = diff_create(last, current)
                    if len(diff) > 0:
                        yield {'t': 'delta', 'd': diff}
                last = current

            # Finalize
            if send_data_on_done and last is not None:
                yield {'t': 'done', 'd': last}
            else:
                yield {'t': 'done'}

        # Apply compression if requested
        wrapped_content = deflate(_diff_wrapper()) if compressed else _diff_wrapper()

        super().__init__(
            content=wrapped_content,
            status_code=status_code,
            headers={'X-Diff-Version': '1; compressed' if compressed else '1', **(headers or {})},
            ping_interval=ping_interval,
            **kwargs,
        )
