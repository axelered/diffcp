import type { ObjectPatchDiff } from './diff'
import type { ObjectStream } from './stream'

/**
 * A compressed representation of a patch operation.
 */
export type CompressedObjectPatchDiff = [1 | 3, number | string, any] | [2, number | string]

/**
 * A compressed message in the object stream.
 */
export type CompressedObjectStream<T extends object, E> =
  /** Initial state. */
  | [1, T]
  /** Compressed delta. */
  | [2, CompressedObjectPatchDiff]
  /** Final state. */
  | [3, T]
  /** Event. */
  | [9, E]

/**
 * Compresses a stream of object messages.
 *
 * @param messages - The stream of messages to compress.
 * @returns An async iterable yielding compressed messages.
 */
export async function* deflate<T extends object, E>(
  messages: AsyncIterable<ObjectStream<T, E>>
): AsyncIterable<CompressedObjectStream<T, E>> {
  const objType = { init: 1, delta: 2, done: 3, event: 9 } as const
  const patchType = { a: 1, d: 2, s: 3 } as const // Add, Remove, Replace RFC6902
  const deltaDict: Record<string, number> = {}
  let deltaOffset = 0

  for await (const msg of messages) {
    if (msg.t === 'delta') {
      // Delta compression
      const delta: any = []
      for (const [typ, path, ...rest] of msg.d) {
        delta.push([
          patchType[typ],
          // Previous Occurrence Compression
          path in deltaDict ? deltaOffset - deltaDict[path] : path,
          ...rest
        ])
        deltaDict[path] = deltaOffset
        deltaOffset += 1
      }
      yield [objType.delta, delta]
    } else {
      yield (msg.d ? [objType[msg.t], msg.d] : [objType[msg.t]]) as any
    }
  }
}

/**
 * Decompresses a stream of compressed object messages.
 *
 * @param compressed - The stream of compressed messages to decompress.
 * @yields Decompressed object stream messages.
 */
export async function* inflate<T extends object, E>(
  compressed: AsyncIterable<CompressedObjectStream<T, E>>
): AsyncIterable<ObjectStream<T, E>> {
  const objType = { 1: 'init', 2: 'delta', 3: 'done', 9: 'event' } as any
  const patchType = { 1: 'a', 2: 'd', 3: 's' } as any // Add, Remove, Replace RFC6902
  const deltaDict: Record<number, string> = {}
  const deltaDictInv: Record<string, number> = {}
  let deltaOffset = 0

  for await (const rec of compressed) {
    // Skip compression if the payload does not seem a compressed one. This will
    // simplify the client and make it retro compatible
    if (!Array.isArray(rec)) {
      yield rec
      continue
    }
    const [typ, data] = rec
    if (objType[typ] === 'delta') {
      const delta: ObjectPatchDiff = []
      for (const [typ, path, ...rest] of data as CompressedObjectPatchDiff) {
        let decPath = path
        if (typeof path === 'number') {
          const oldOffset = deltaOffset - path
          decPath = deltaDict[oldOffset]
          delete deltaDict[oldOffset]
        }
        // This is needed to kep the main dictionary void of any duplicates. This may
        // be dangerous in case the client is not sending a compressed stream.
        if (decPath in deltaDictInv) delete deltaDict[deltaDictInv[decPath]]
        deltaDictInv[decPath] = deltaOffset
        //
        deltaDict[deltaOffset] = decPath
        deltaOffset += 1

        delta.push([patchType[typ], decPath, ...rest] as any)
      }
      yield { t: 'delta', d: delta }
    } else {
      yield { t: objType[typ], d: data as any }
    }
  }
}
