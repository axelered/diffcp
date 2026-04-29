import httpx
import pytest
import respx
from httpx import Response

from diffcp import (
    ObjectStreamResponse,
    StreamEvent,
    StreamReinit,
    fetch_object_stream,
)


@pytest.mark.asyncio
async def test_fetch_object_stream_reinit_e2e(respx_mock):
    async def source():
        yield {'val': 1}
        yield StreamReinit(data={'val': 100})
        yield {'val': 101}

    response = ObjectStreamResponse(source(), compressed=False)
    body = await collect_body(response)

    respx_mock.get('http://test/stream').mock(
        return_value=Response(200, headers={'Content-Type': 'application/x-ndjson'}, content=body)
    )

    results = []
    async for data in fetch_object_stream('http://test/stream'):
        results.append(data)

    assert len(results) == 3
    assert results[0] == {'val': 1}
    assert results[1] == {'val': 100}
    assert results[2] == {'val': 101}


@pytest.mark.asyncio
async def test_fetch_object_stream_heartbeats_e2e(respx_mock):
    # Manually construct body with extra newlines (pings)
    body = '{"t": "init", "d": {"a": 1}}\n\n\n{"t": "delta", "d": [["s", "/a", 2]]}\n{"t": "done"}\n'

    respx_mock.get('http://test/stream').mock(
        return_value=Response(200, headers={'Content-Type': 'application/x-ndjson'}, content=body)
    )

    results = []
    async for data in fetch_object_stream('http://test/stream'):
        results.append(data)

    assert results == [{'a': 1}, {'a': 2}]


@pytest.mark.asyncio
async def test_fetch_object_stream_fallback_json_e2e(respx_mock):
    respx_mock.get('http://test/stream').mock(
        return_value=Response(200, headers={'Content-Type': 'application/json'}, json={'error': 'not found'})
    )

    results = []
    async for data in fetch_object_stream('http://test/stream', fallback_plain_json=True):
        results.append(data)

    assert results == [{'error': 'not found'}]


async def collect_body(response: ObjectStreamResponse) -> str:
    body = b''
    async for chunk in response.body_iterator:
        if isinstance(chunk, str):
            body += chunk.encode()
        else:
            body += chunk
    return body.decode()


@pytest.mark.asyncio
async def test_fetch_object_stream_e2e(respx_mock):
    async def source():
        yield {'count': 0, 'tags': ['a']}
        yield {'count': 1, 'tags': ['a', 'b']}
        yield StreamEvent(data={'type': 'notification'})
        yield {'count': 2, 'tags': ['a', 'b', 'c']}

    # Create the protocol body
    response = ObjectStreamResponse(source(), compressed=False)
    body = await collect_body(response)

    respx_mock.get('http://test/stream').mock(
        return_value=Response(200, headers={'Content-Type': 'application/x-ndjson'}, content=body)
    )

    results = []
    events = []
    async for data in fetch_object_stream('http://test/stream', on_event=lambda e: events.append(e)):
        results.append(data)

    assert len(results) == 3
    assert results[0] == {'count': 0, 'tags': ['a']}
    assert results[1] == {'count': 1, 'tags': ['a', 'b']}
    assert results[2] == {'count': 2, 'tags': ['a', 'b', 'c']}
    assert events == [{'type': 'notification'}]


@pytest.mark.asyncio
async def test_fetch_object_stream_compressed_e2e(respx_mock):
    async def source():
        yield {'a': 1}
        yield {'a': 2}

    # Create the protocol body with compression enabled
    response = ObjectStreamResponse(source(), compressed=True)
    body = await collect_body(response)

    respx_mock.get('http://test/stream').mock(
        return_value=Response(
            200,
            headers={
                'Content-Type': 'application/x-ndjson',
                'X-Diff-Version': '1; compressed',
            },
            content=body,
        )
    )

    results = []
    async for data in fetch_object_stream('http://test/stream'):
        results.append(data)

    assert len(results) == 2
    assert results[0] == {'a': 1}
    assert results[1] == {'a': 2}
