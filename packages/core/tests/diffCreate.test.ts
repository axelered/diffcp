import { describe, expect, it } from 'vitest'
import { diffCreate } from '../src'
import { data1, deepCopy } from './utils'

describe('diff create common', () => {
  it('init from none', () => {
    expect(diffCreate(undefined, {})).toEqual([['s', '', {}]])
  })
  it('empty to populated', () => {
    expect(diffCreate({}, { a: 1 })).toEqual([['s', '/a', 1]])
  })
  it('populated to empty', () => {
    expect(diffCreate({ a: 1 }, {})).toEqual([['d', '/a']])
  })
  it('diff noop', () => {
    expect(diffCreate(deepCopy(data1), deepCopy(data1))).toEqual([])
  })
  it('type change', () => {
    const copy = deepCopy<any>(data1)
    copy['name'] = 126
    copy['age'] = '12'
    copy['addresses'][1]['street'] = 123
    expect(diffCreate(data1, copy)).toEqual(
      expect.arrayContaining([
        ['s', '/name', 126],
        ['s', '/age', '12'],
        ['s', '/addresses/1/street', 123]
      ])
    )
  })
})

describe('diff create object', () => {
  it('key add', () => {
    const copy = deepCopy<any>(data1)
    copy['x'] = '??'
    copy['n'] = 1
    copy['addresses'][0]['x'] = 41
    expect(diffCreate(data1, copy)).toEqual(
      expect.arrayContaining([
        ['s', '/x', '??'],
        ['s', '/n', 1],
        ['s', '/addresses/0/x', 41]
      ])
    )
  })
  it('key replace', () => {
    const copy = deepCopy<any>(data1)
    copy['name'] = 'Marco'
    copy['addresses'][0]['no'] = 41
    expect(diffCreate(data1, copy)).toEqual(
      expect.arrayContaining([
        ['s', '/name', 'Marco'],
        ['s', '/addresses/0/no', 41]
      ])
    )
  })
  it('key drop', () => {
    const copy = deepCopy<any>(data1)
    delete copy['name']
    delete copy['addresses'][0]['no']
    expect(diffCreate(data1, copy)).toEqual(
      expect.arrayContaining([
        ['d', '/name'],
        ['d', '/addresses/0/no']
      ])
    )
  })
  it('key special keys', () => {
    const copy = deepCopy<any>(data1)
    copy[''] = 'a'
    copy['user.name'] = 'b'
    copy['path/to/file'] = 'c'
    copy['version~1'] = 'd'
    expect(diffCreate(data1, copy)).toEqual(
      expect.arrayContaining([
        ['s', '/', 'a'],
        ['s', '/user.name', 'b'],
        ['s', '/path~1to~1file', 'c'],
        ['s', '/version~01', 'd']
      ])
    )
  })
})

describe('diff create array', () => {
  it('add', () => {
    const copy = deepCopy(data1)
    copy['addresses'].push({ type: 'Villa', no: 1, street: 'Some' })
    expect(diffCreate(data1, copy)).toEqual(
      expect.arrayContaining([['a', '/addresses/-', { type: 'Villa', no: 1, street: 'Some' }]])
    )
  })
  it('delete', () => {
    const copy = deepCopy(data1)
    copy['addresses'] = copy['addresses'].filter((_, id) => id !== 1)
    expect(diffCreate(data1, copy)).toEqual(expect.arrayContaining([['d', '/addresses/1']]))
  })
  it('delete shift', () => {
    // todo : this should be optimized
    const copy = deepCopy(data1)
    copy['addresses'].shift()
    expect(diffCreate(data1, copy)).toEqual(
      expect.arrayContaining([
        ['s', '/addresses/0/type', 'Office'],
        ['s', '/addresses/0/street', 'Mayden'],
        ['d', '/addresses/1']
      ])
    )
  })
  it('multi append', () => {
    const dataFrom = { items: [1] }
    const dataTo = { items: [1, 2, 3] }
    expect(diffCreate(dataFrom, dataTo)).toEqual(
      expect.arrayContaining([
        ['a', '/items/-', 2],
        ['a', '/items/-', 3]
      ])
    )
  })
  it('change', () => {
    const dataFrom = { tags: ['a', 'b', 'c', 'd', 'e'] }
    const dataTo = { tags: ['a', 'z', 'c', 'd', 'j'] }
    expect(diffCreate(dataFrom, dataTo)).toEqual(
      expect.arrayContaining([
        ['s', '/tags/1', 'z'],
        ['s', '/tags/4', 'j']
      ])
    )
  })
})

describe('diff create string', () => {
  it('replace', () => {
    const copy = deepCopy(data1)
    copy['name'] = 'Marco'
    copy['addresses'][1]['street'] = 'Rome is nice'
    expect(diffCreate(data1, copy)).toEqual(
      expect.arrayContaining([
        ['s', '/name', 'Marco'],
        ['s', '/addresses/1/street', 'Rome is nice']
      ])
    )
  })
  it('append', () => {
    const copy = deepCopy(data1)
    copy['name'] = 'Borut is good'
    copy['addresses'][1]['street'] = 'Mayden is nice'
    expect(diffCreate(data1, copy)).toEqual(
      expect.arrayContaining([
        ['a', '/name/-', ' is good'],
        ['a', '/addresses/1/street/-', ' is nice']
      ])
    )
  })
})
