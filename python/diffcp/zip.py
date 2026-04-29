from collections.abc import AsyncIterable
from typing import Any, TypeVar

T = TypeVar('T')
E = TypeVar('E')

# CompressedObjectPatchDiff = [1 | 3, number | string, any] | [2, number | string]
CompressedObjectPatchDiff = tuple[int, int | str, Any] | tuple[int, int | str]

# CompressedObjectStream = [1, T] | [2, List[CompressedObjectPatchDiff]] | [3, T] | [9, E]
CompressedObjectStream = tuple[int, Any] | tuple[int]

OBJ_TYPE_MAP = {'init': 1, 'delta': 2, 'done': 3, 'event': 9}
OBJ_TYPE_INV = {v: k for k, v in OBJ_TYPE_MAP.items()}
PATCH_TYPE_MAP = {'a': 1, 'd': 2, 's': 3}
PATCH_TYPE_INV = {v: k for k, v in PATCH_TYPE_MAP.items()}


async def deflate(messages: AsyncIterable[dict[str, Any]]) -> AsyncIterable[CompressedObjectStream]:
    delta_dict: dict[str, int] = {}
    delta_offset = 0

    async for msg in messages:
        t = msg['t']
        d = msg.get('d')

        if t == 'delta':
            delta_payload = []
            for op in d:
                typ = op[0]
                path = op[1]
                rest = op[2:]

                # Previous Occurrence Compression
                if path in delta_dict:
                    path_val: int | str = delta_offset - delta_dict[path]
                else:
                    path_val = path

                delta_payload.append([PATCH_TYPE_MAP[typ], path_val, *rest])
                delta_dict[path] = delta_offset
                delta_offset += 1
            yield [OBJ_TYPE_MAP['delta'], delta_payload]
        else:
            if d is not None:
                yield [OBJ_TYPE_MAP[t], d]
            else:
                yield [OBJ_TYPE_MAP[t]]


async def inflate(
    compressed: AsyncIterable[dict[str, Any] | CompressedObjectStream],
) -> AsyncIterable[dict[str, Any]]:
    delta_dict: dict[int, str] = {}
    delta_dict_inv: dict[str, int] = {}
    delta_offset = 0

    async for rec in compressed:
        # Skip compression if the payload does not seem a compressed one (e.g. if it's already a dict)
        if isinstance(rec, dict):
            yield rec
            continue

        typ_code = rec[0]
        data = rec[1] if len(rec) > 1 else None

        t = OBJ_TYPE_INV.get(typ_code)
        if t == 'delta':
            delta_ops = []
            for op in data:
                op_typ_code = op[0]
                path_val = op[1]
                rest = op[2:]

                dec_path = path_val
                if isinstance(path_val, int):
                    old_offset = delta_offset - path_val
                    dec_path = delta_dict[old_offset]
                    del delta_dict[old_offset]

                # Cleanup duplicates
                if dec_path in delta_dict_inv:
                    inv_offset = delta_dict_inv[dec_path]
                    if inv_offset in delta_dict:
                        del delta_dict[inv_offset]

                delta_dict_inv[dec_path] = delta_offset
                delta_dict[delta_offset] = dec_path
                delta_offset += 1

                op_typ = PATCH_TYPE_INV[op_typ_code]
                delta_ops.append([op_typ, dec_path, *rest])
            yield {'t': 'delta', 'd': delta_ops}
        else:
            msg = {'t': t}
            if data is not None:
                msg['d'] = data
            yield msg
