import { describe, it, expect } from 'vitest'
import {
  MASK,
  maskValue,
  maskHeaders,
  isMasked,
  mergeMaskedHeaders,
  isSendableHeaderValue,
  unsendableHeader,
} from './api-connection-headers'

describe('maskHeaders', () => {
  it('keeps a recognisable prefix on longer secrets', () => {
    expect(maskValue('csj9abcdefghijkl')).toBe('csj9' + MASK)
  })

  it('reveals nothing from a short secret', () => {
    expect(maskValue('abc')).toBe(MASK)
  })

  it('masks every header value', () => {
    expect(maskHeaders({ 'x-access-token': 'csj9secret', authorization: 'Bearer zzzz' })).toEqual({
      'x-access-token': 'csj9' + MASK,
      authorization: 'Bear' + MASK,
    })
  })
})

describe('mergeMaskedHeaders', () => {
  const stored = { 'x-access-token': 'csj9-the-real-secret', 'x-other': 'keepme' }

  it('keeps the stored secret when the value comes back masked', () => {
    // The exact regression: editing a connection posted the mask straight back.
    const submitted = { 'x-access-token': 'csj9' + MASK, 'x-other': 'keep' + MASK }
    expect(mergeMaskedHeaders(submitted, stored)).toEqual(stored)
  })

  it('writes through a value the user actually retyped', () => {
    const submitted = { 'x-access-token': 'brand-new-token' }
    expect(mergeMaskedHeaders(submitted, stored)['x-access-token']).toBe('brand-new-token')
  })

  it('drops a masked value that has nothing stored behind it', () => {
    expect(mergeMaskedHeaders({ 'x-new': MASK }, stored)).toEqual({})
  })

  it('removes a header the user deleted', () => {
    const submitted = { 'x-access-token': 'csj9' + MASK }
    expect(mergeMaskedHeaders(submitted, stored)).toEqual({
      'x-access-token': 'csj9-the-real-secret',
    })
  })

  it('never persists bullet characters', () => {
    const out = mergeMaskedHeaders({ a: MASK, b: 'x' + MASK, c: 'real' }, {})
    expect(Object.values(out).some(isMasked)).toBe(false)
    expect(out).toEqual({ c: 'real' })
  })
})

describe('isSendableHeaderValue', () => {
  it('accepts ordinary ascii tokens', () => {
    expect(isSendableHeaderValue('csj9_live_7f3a9b2c')).toBe(true)
    expect(isSendableHeaderValue('Bearer abc.def-ghi')).toBe(true)
  })

  it('rejects the mask, which is what actually broke the tours fetch', () => {
    // The bullet is U+2022 (8226); fetch only accepts latin-1 in header values.
    expect(isSendableHeaderValue('csj9' + MASK)).toBe(false)
  })

  it('reports which header is unsendable', () => {
    expect(unsendableHeader({ ok: 'fine', 'x-access-token': 'csj9' + MASK })).toBe('x-access-token')
    expect(unsendableHeader({ ok: 'fine' })).toBeNull()
  })

  it('matches the latin-1 boundary fetch enforces', () => {
    expect(isSendableHeaderValue('\u00ff')).toBe(true)
    expect(isSendableHeaderValue('\u0100')).toBe(false)
  })

  it('agrees with what Headers() actually accepts', () => {
    for (const ch of ['\u00ff', '\u0100', '\u2022']) {
      let threw = false
      try {
        new Headers({ 'x-t': ch })
      } catch {
        threw = true
      }
      expect(isSendableHeaderValue(ch)).toBe(!threw)
    }
  })
})
