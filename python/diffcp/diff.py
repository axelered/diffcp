from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal


@dataclass(frozen=True)
class _PatchOpBase:
    p: str  # path


@dataclass(frozen=True)
class PatchAppend(_PatchOpBase):
    v: Any  # value
    o: Literal['a'] = 'a'


@dataclass(frozen=True)
class PatchSet(_PatchOpBase):
    v: Any
    o: Literal['s'] = 's'


@dataclass(frozen=True)
class PatchDelete(_PatchOpBase):
    o: Literal['d'] = 'd'


PatchOp = PatchAppend | PatchSet | PatchDelete
PatchDiff = list[PatchOp]

# The protocol uses tuples for wire efficiency
CompactPatchOp = tuple[Literal['a'], str, Any] | tuple[Literal['s'], str, Any] | tuple[Literal['d'], str]
ObjectPatchDiff = list[CompactPatchOp]


def diff_encode_path(path: Sequence[str | int]) -> str:
    if not path:
        return ''
    return '/'.join(['', *(str(x).replace('~', '~0').replace('/', '~1') for x in path)])


def diff_decode_path(path: str) -> list[str]:
    if path == '':
        return []
    if not path.startswith('/'):
        raise ValueError(f'Invalid path string "{path}"')
    return [x.replace('~1', '/').replace('~0', '~') for x in path[1:].split('/')]


def _create_diff_recursive(diff: PatchDiff, path: list[str], from_val: Any, to_val: Any):
    if from_val == to_val:
        return

    t_from, t_to = type(from_val), type(to_val)
    if t_from != t_to:
        diff.append(PatchSet(p=diff_encode_path(path), v=to_val))
    elif t_from is dict:
        from_keys, to_keys = set(from_val.keys()), set(to_val.keys())
        for k in from_keys - to_keys:
            diff.append(PatchDelete(p=diff_encode_path([*path, k])))
        for k in to_keys - from_keys:
            diff.append(PatchSet(p=diff_encode_path([*path, k]), v=to_val[k]))
        for k in from_keys.intersection(to_keys):
            _create_diff_recursive(diff, [*path, k], from_val[k], to_val[k])
    elif t_from is list:
        len_from, len_to = len(from_val), len(to_val)
        max_l = max(len_from, len_to)
        min_l = min(len_from, len_to)
        for i in range(max_l):
            if i < min_l:
                _create_diff_recursive(diff, [*path, str(i)], from_val[i], to_val[i])
            elif len_from > len_to:
                diff.append(PatchDelete(p=diff_encode_path([*path, str(i)])))
            else:
                diff.append(PatchAppend(p=diff_encode_path([*path, '-']), v=to_val[i]))
    elif t_from is str:
        if to_val.startswith(from_val):
            diff.append(PatchAppend(p=diff_encode_path([*path, '-']), v=to_val[len(from_val) :]))
        else:
            diff.append(PatchSet(p=diff_encode_path(path), v=to_val))
    else:
        diff.append(PatchSet(p=diff_encode_path(path), v=to_val))


def to_compact(diff: PatchDiff) -> ObjectPatchDiff:
    res = []
    for op in diff:
        if isinstance(op, PatchDelete):
            res.append((op.o, op.p))
        else:
            res.append((op.o, op.p, op.v))
    return res


def diff_create(from_val: Any | None, to_val: Any) -> ObjectPatchDiff:
    diff: PatchDiff = []
    if from_val is None:
        diff.append(PatchSet(p='', v=to_val))
    else:
        _create_diff_recursive(diff, [], from_val, to_val)
    return to_compact(diff)


def _apply_op_internal(current_val: Any, rest_path: list[str], op: CompactPatchOp) -> Any:
    if not rest_path:
        if op[0] == 's':
            return op[2]
        raise ValueError(f'Cannot perform {op[0]} at root')

    key = rest_path[0]
    op_type = op[0]
    if key == '-' and (op_type != 'a' or len(rest_path) > 1):
        raise ValueError(f"Invalid '-' index for {op_type}")

    is_delete = len(rest_path) == 1 and op_type == 'd'

    if isinstance(current_val, list):
        if key == '-':
            if op[0] == 'a':
                return current_val + [op[2]]
        else:
            ix = int(key)
            if is_delete:
                return [v for jx, v in enumerate(current_val) if ix != jx]
            else:
                return [v if ix != jx else _apply_op_internal(v, rest_path[1:], op) for jx, v in enumerate(current_val)]
    elif isinstance(current_val, dict):
        if is_delete:
            new_val = dict(current_val)
            new_val.pop(key, None)
            return new_val
        else:
            new_val = dict(current_val)
            new_val[key] = _apply_op_internal(current_val.get(key), rest_path[1:], op)
            return new_val
    elif isinstance(current_val, str):
        if key == '-' and op[0] == 'a':
            return current_val + op[2]

    return current_val


def diff_apply(value: Any, diff: ObjectPatchDiff) -> Any:
    if value is None and not diff:
        raise ValueError('Cannot apply empty diff to None')

    res = value
    for op in diff:
        path = diff_decode_path(op[1])
        res = _apply_op_internal(res, path, op)
    return res
