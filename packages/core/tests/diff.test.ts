import { describe, expect, it } from 'vitest'
import { diffApply, diffCreate } from '../src'
import { data1, deepCopy } from './utils'

function reflects(from: any, to: any) {
  const diff = diffCreate(from, to)
  const to2 = diffApply(from, diff)
  expect(to2).toEqual(to)
}

describe('diff create common', () => {
  it('init from none', () => {
    reflects(undefined, {})
  })
  it('empty to populated', () => {
    reflects({}, { a: 1 })
  })
  it('populated to empty', () => {
    reflects({ a: 1 }, {})
  })
  it('diff noop', () => {
    reflects(deepCopy(data1), deepCopy(data1))
  })
  it('type change', () => {
    const copy = deepCopy<any>(data1)
    copy['name'] = 126
    copy['age'] = '12'
    copy['addresses'][1]['street'] = 123
    reflects(data1, copy)
  })
})

describe('diff create object', () => {
  it('key add', () => {
    const copy = deepCopy<any>(data1)
    copy['x'] = '??'
    copy['n'] = 1
    copy['addresses'][0]['x'] = 41
    reflects(data1, copy)
  })
  it('key replace', () => {
    const copy = deepCopy<any>(data1)
    copy['name'] = 'Marco'
    copy['addresses'][0]['no'] = 41
    reflects(data1, copy)
  })
  it('key drop', () => {
    const copy = deepCopy<any>(data1)
    delete copy['name']
    delete copy['addresses'][0]['no']
    reflects(data1, copy)
  })
  it('key special keys', () => {
    const copy = deepCopy<any>(data1)
    copy[''] = 'a'
    copy['user.name'] = 'b'
    copy['path/to/file'] = 'c'
    copy['version~1'] = 'd'
    reflects(data1, copy)
  })
})

describe('diff create array', () => {
  it('add', () => {
    const copy = deepCopy(data1)
    copy['addresses'].push({ type: 'Villa', no: 1, street: 'Some' })
    reflects(data1, copy)
  })
  it('delete', () => {
    const copy = deepCopy(data1)
    copy['addresses'] = copy['addresses'].filter((_, id) => id !== 1)
    reflects(data1, copy)
  })
  it('delete shift', () => {
    // todo : this should be optimized
    const copy = deepCopy(data1)
    copy['addresses'].shift()
    reflects(data1, copy)
  })
  it('multi append', () => {
    const dataFrom = { items: [1] }
    const dataTo = { items: [1, 2, 3] }
    reflects(dataFrom, dataTo)
  })
  it('change', () => {
    const dataFrom = { tags: ['a', 'b', 'c', 'd', 'e'] }
    const dataTo = { tags: ['a', 'z', 'c', 'd', 'j'] }
    reflects(dataFrom, dataTo)
  })
})

describe('diff create string', () => {
  it('replace', () => {
    const copy = deepCopy(data1)
    copy['name'] = 'Marco'
    copy['addresses'][1]['street'] = 'Rome is nice'
    reflects(data1, copy)
  })
  it('append', () => {
    const copy = deepCopy(data1)
    copy['name'] = 'Borut is good'
    copy['addresses'][1]['street'] = 'Mayden is nice'
    reflects(data1, copy)
  })
})
