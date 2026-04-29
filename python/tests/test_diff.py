import time
from copy import deepcopy

import pytest

from diffcp import diff_apply, diff_create

BASE = {
    'name': 'Borut',
    'age': 30,
    'addresses': [
        {'type': 'Home', 'street': 'Boolevard, Downtown', 'no': 900},
        {'type': 'Office', 'street': 'Mayden', 'no': 900},
    ],
}


@pytest.fixture()
def data():
    return deepcopy(BASE)


@pytest.fixture()
def copy_data():
    return deepcopy(BASE)


def test_basic_diff():
    obj1 = {'a': 1, 'b': [1, 2, 3], 'c': 'hello'}
    obj2 = {'a': 2, 'b': [1, 2, 3, 4], 'c': 'hello world'}

    diff = diff_create(obj1, obj2)
    res = diff_apply(obj1, diff)
    assert res == obj2


def test_nested_diff():
    obj1 = {'user': {'name': 'Alice', 'meta': {'last_seen': 100}}}
    obj2 = {'user': {'name': 'Alice', 'meta': {'last_seen': 101, 'status': 'online'}}}

    diff = diff_create(obj1, obj2)
    res = diff_apply(obj1, diff)
    assert res == obj2


def test_removal():
    obj1 = {'a': 1, 'b': 2}
    obj2 = {'a': 1}

    diff = diff_create(obj1, obj2)
    res = diff_apply(obj1, diff)
    assert res == obj2


def test_diff_init_from_none():
    assert diff_create(None, {}) == [('s', '', {})]
    new_state = {'a': 1}
    d = diff_create(None, new_state)
    assert d == [('s', '', new_state)]


def test_diff_empty_to_populated():
    d = diff_create({}, {'a': 1})
    assert d == [('s', '/a', 1)]


def test_diff_populated_to_empty():
    d = diff_create({'a': 1}, {})
    assert d == [('d', '/a')]


def test_diff_noop(data, copy_data):
    d = diff_create(data, copy_data)
    assert len(d) == 0


def test_diff_key_add(data, copy_data):
    copy_data['x'] = '??'
    copy_data['n'] = 11
    copy_data['addresses'][0]['x'] = 41
    d = diff_create(data, copy_data)
    assert set(d) == {('s', '/x', '??'), ('s', '/n', 11), ('s', '/addresses/0/x', 41)}


def test_diff_key_replace(data, copy_data):
    copy_data['name'] = 'Marco'
    copy_data['addresses'][1]['no'] = 41
    d = diff_create(data, copy_data)
    assert set(d) == {('s', '/name', 'Marco'), ('s', '/addresses/1/no', 41)}


def test_diff_key_drop(data, copy_data):
    del copy_data['name']
    del copy_data['addresses'][1]['no']
    d = diff_create(data, copy_data)
    assert set(d) == {('d', '/name'), ('d', '/addresses/1/no')}


def test_diff_special_keys():
    start = {'normal': 1}
    end = {
        'normal': 1,
        '': 'Root-ish',
        'user.name': 'A',
        'path/to/file': 'B',
        'version~1': 'C',
    }
    d = diff_create(start, end)
    assert set(d) == {
        ('s', '/', 'Root-ish'),
        ('s', '/user.name', 'A'),
        ('s', '/path~1to~1file', 'B'),
        ('s', '/version~01', 'C'),
    }


def test_diff_array_change():
    start = {'tags': ['a', 'b', 'c', 'd', 'e']}
    end = {'tags': ['a', 'z', 'c', 'd', 'j']}
    d = diff_create(start, end)
    assert set(d) == {
        ('s', '/tags/1', 'z'),
        ('s', '/tags/4', 'j'),
    }


def test_diff_array_add(data, copy_data):
    copy_data['addresses'].append({'type': 'wc'})
    d = diff_create(data, copy_data)
    assert d == [('a', '/addresses/-', {'type': 'wc'})]


def test_diff_array_delete(data, copy_data):
    del copy_data['addresses'][1]
    d = diff_create(data, copy_data)
    assert d == [('d', '/addresses/1')]


def test_diff_array_delete_shift(data, copy_data):
    # We remove the first element
    # Old Index 0: {type: Home, street: Blvd, no: 900}
    # New Index 0: {type: Office, street: Mayden, no: 900} (was Index 1)
    del copy_data['addresses'][0]

    d = diff_create(data, copy_data)

    # 1. At addresses/0: 'no' is unchanged (900 -> 900).
    # 2. At addresses/0: 'type' changed 'Home' -> 'Office'.
    # 3. At addresses/0: 'street' changed 'Blvd' -> 'Mayden'.
    # 4. addresses/1 is removed.
    assert set(d) == {
        ('s', '/addresses/0/type', 'Office'),
        ('s', '/addresses/0/street', 'Mayden'),
        ('d', '/addresses/1'),
    }


def test_diff_list_multiple_appends():
    start = {'items': [1]}
    end = {'items': [1, 2, 3]}
    d = diff_create(start, end)
    # NOTE: Order matters for list appends!
    assert d == [('a', '/items/-', 2), ('a', '/items/-', 3)]


def test_diff_list_replacement_inside_struct(data, copy_data):
    copy_data['addresses'][0]['street'] = 'New Street'
    d = diff_create(data, copy_data)
    assert d == [('s', '/addresses/0/street', 'New Street')]


def test_diff_list_item_replace():
    start = {'tags': ['a', 'b']}
    end = {'tags': ['a', 'c']}
    d = diff_create(start, end)
    assert d == [('s', '/tags/1', 'c')]


def test_diff_string_append(data, copy_data):
    copy_data['name'] = 'Borut is good'
    copy_data['addresses'][1]['street'] = 'Mayden is nice'
    d = diff_create(data, copy_data)
    assert set(d) == {
        ('a', '/name/-', ' is good'),
        ('a', '/addresses/1/street/-', ' is nice'),
    }


def test_diff_string_replace_not_append(data, copy_data):
    copy_data['name'] = 'Boris'
    d = diff_create(data, copy_data)
    assert d == [('s', '/name', 'Boris')]


def test_diff_string_type_change(data, copy_data):
    copy_data['name'] = 12345
    d = diff_create(data, copy_data)
    assert d == [('s', '/name', 12345)]


def test_diff_int_to_string(data, copy_data):
    copy_data['age'] = 'Thirty'
    d = diff_create(data, copy_data)
    assert d == [('s', '/age', 'Thirty')]


def test_diff_benchmark():
    d1 = {
        'orderId': 'a91f3c72-8c4e-4d51-9b44-6d3cbf91b8c2',
        'customer': {
            'id': 'cust-4412',
            'name': 'Jane Doe',
            'email': 'jane.doe@example.com',
            'loyaltyPoints': 320,
            'addresses': [
                {
                    'type': 'billing',
                    'street': '121 Market St',
                    'city': 'San Francisco',
                    'zip': '94109',
                    'country': 'US',
                },
                {'type': 'shipping', 'street': '88 Mission Blvd', 'city': 'San Mateo', 'zip': '94401', 'country': 'US'},
            ],
        },
        'items': [
            {
                'productId': 'SKU-9912',
                'name': 'Noise-Canceling Headphones',
                'quantity': 1,
                'unitPrice': 199.99,
                'metadata': {'color': 'black', 'warrantyYears': 2},
            },
            {
                'productId': 'SKU-1148',
                'name': 'USB-C Charger 65W',
                'quantity': 2,
                'unitPrice': 39.50,
                'metadata': {'cableIncluded': False},
            },
        ],
    }
    d2 = {
        'orderId': 'a91f3c72-8c4e-4d51-9044-6d3cbf91b8c2',
        'customer': {
            'id': 'cust-4412',
            'loyaltyPoints': 311,
            'addresses': [
                {'type': 'billing', 'street': '121 Market St', 'city': 'Pasadena', 'zip': '94109', 'country': 'US'},
                {'type': 'shipping', 'street': '88 Mission Blvd', 'city': 'San Mateo', 'zip': '94401', 'country': 'US'},
            ],
        },
        'items': [
            {
                'productId': 'SKU-1148',
                'name': 'USB-C Charger 65W',
                'quantity': 3,
                'unitPrice': 39.00,
                'metadata': {'cableIncluded': True},
            },
            {
                'productId': 'SKU-9912',
                'name': 'Noise-Canceling Headphones with text append',
                'quantity': 1,
                'unitPrice': 199.99,
                'metadata': {'color': 'black', 'warrantyYears': 2},
            },
        ],
    }

    # Benchmark
    ops = 4096
    start = time.time()
    for _ in range(ops):
        diff = diff_create(d1, d2)
        assert len(diff) == 19
    took = time.time() - start
    assert took < 0.2
