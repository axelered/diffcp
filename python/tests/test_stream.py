import asyncio
import json

import pytest
from pydantic import BaseModel

from diffcp import ObjectStreamResponse, StreamEvent, StreamReinit, inflate


class ChatState(BaseModel):
    text: str
    meta: dict


def parse_ndjson(text: str) -> list[dict]:
    """
    Parses NDJSON response into a list of dicts, ignoring keep-alive pings.
    """
    return [json.loads(line) for line in text.strip().split('\n') if line.strip()]


async def collect_body(response: ObjectStreamResponse) -> str:
    body = b''
    async for chunk in response.body_iterator:
        if isinstance(chunk, str):
            body += chunk.encode()
        else:
            body += chunk
    return body.decode()


@pytest.mark.asyncio
async def test_object_stream_response_logic():
    async def source():
        yield {'a': 1}
        yield {'a': 2}
        yield StreamEvent(data='ping')
        yield StreamReinit(data={'b': 1})
        yield {'b': 2}

    response = ObjectStreamResponse(source(), compressed=False)
    body = await collect_body(response)
    frames = parse_ndjson(body)

    assert frames[0] == {'t': 'init', 'd': {'a': 1}}
    assert frames[1] == {'t': 'delta', 'd': [['s', '/a', 2]]}
    assert frames[2] == {'t': 'event', 'd': 'ping'}
    assert frames[3] == {'t': 'init', 'd': {'b': 1}}
    assert frames[4] == {'t': 'delta', 'd': [['s', '/b', 2]]}
    assert frames[5] == {'t': 'done'}


@pytest.mark.asyncio
async def test_object_stream_response_compression():
    async def source():
        yield {'a': 1}
        yield {'a': 2}

    response = ObjectStreamResponse(source(), compressed=True)
    body = await collect_body(response)
    frames = parse_ndjson(body)

    # Frames should be compressed: [type, data]
    assert frames[0][0] == 1  # init
    assert frames[0][1] == {'a': 1}
    assert frames[1][0] == 2  # delta

    async def compressed_gen():
        for f in frames:
            yield f

    inflated = []
    async for f in inflate(compressed_gen()):
        inflated.append(f)

    assert inflated[0] == {'t': 'init', 'd': {'a': 1}}
    assert inflated[1] == {'t': 'delta', 'd': [['s', '/a', 2]]}


@pytest.mark.asyncio
async def test_stream_protocol_structure():
    async def source():
        yield ChatState(text='Hello', meta={'id': 1})
        yield ChatState(text='Hello World', meta={'id': 1})

    response = ObjectStreamResponse(source(), compressed=False)
    body = await collect_body(response)
    events = parse_ndjson(body)

    assert len(events) == 3
    assert events[0]['t'] == 'init'
    assert events[1]['t'] == 'delta'
    assert events[2]['t'] == 'done'


@pytest.mark.asyncio
async def test_stream_string_optimization():
    async def source():
        yield ChatState(text='Start', meta={})
        yield ChatState(text='Start finish', meta={})

    response = ObjectStreamResponse(source(), compressed=False)
    body = await collect_body(response)
    events = parse_ndjson(body)

    delta = events[1]['d']
    op = delta[0]

    assert op[0] == 'a'  # Operator
    assert op[1] == '/text/-'  # Path
    assert op[2] == ' finish'  # Value


@pytest.mark.asyncio
async def test_stream_keepalive_pings():
    async def source():
        yield ChatState(text='A', meta={})
        await asyncio.sleep(0.2)  # Trigger ping
        yield ChatState(text='B', meta={})

    # Ping every 0.1s
    response = ObjectStreamResponse(source(), ping_interval=0.1, compressed=False)
    body = await collect_body(response)

    # Split by double newline implies a ping occurred (message \n + ping \n)
    parts = body.split('\n\n')
    assert len(parts) > 1


@pytest.mark.asyncio
async def test_stream_custom_events():
    async def source():
        yield ChatState(text='A', meta={})
        yield StreamEvent(data={'msg': 'processing'})
        yield ChatState(text='AB', meta={})

    response = ObjectStreamResponse(source(), compressed=False)
    body = await collect_body(response)
    events = parse_ndjson(body)

    # Init
    assert events[0]['t'] == 'init'
    assert events[0]['d']['text'] == 'A'

    # Custom Event
    assert events[1]['t'] == 'event'
    assert events[1]['d'] == {'msg': 'processing'}

    # Delta
    assert events[2]['t'] == 'delta'
    op = events[2]['d'][0]
    assert op[0] == 'a'  # Append
    assert op[2] == 'B'  # Value


@pytest.mark.asyncio
async def test_stream_reinit():
    async def source():
        yield ChatState(text='A', meta={})
        yield ChatState(text='AB', meta={})
        yield StreamReinit(data=ChatState(text='RESET', meta={}))
        yield ChatState(text='RESET!', meta={})

    response = ObjectStreamResponse(source(), compressed=False)
    body = await collect_body(response)
    events = parse_ndjson(body)

    # Init
    assert events[0]['t'] == 'init'
    assert events[0]['d']['text'] == 'A'

    # Delta
    assert events[1]['t'] == 'delta'

    # Reinit (Should look like an Init)
    assert events[2]['t'] == 'init'
    assert events[2]['d']['text'] == 'RESET'

    # Delta (Calculated against "RESET", not "AB")
    assert events[3]['t'] == 'delta'
    op = events[3]['d'][0]
    assert op[0] == 'a'
    assert op[2] == '!'


@pytest.mark.asyncio
async def test_stream_resend_at_done():
    async def source():
        yield ChatState(text='Final', meta={})

    response = ObjectStreamResponse(source(), send_data_on_done=True, compressed=False)
    body = await collect_body(response)
    events = parse_ndjson(body)

    assert len(events) == 2
    assert events[-1]['t'] == 'done'
    assert events[-1]['d'] == {'text': 'Final', 'meta': {}}
