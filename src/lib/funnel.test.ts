import { describe, it, expect } from 'vitest'
import { getLeadScoreBand, LEAD_SCORE_BANDS } from './funnel'

describe('getLeadScoreBand', () => {
  it('picks the band at each boundary', () => {
    expect(getLeadScoreBand(0).label).toBe('Cold')
    expect(getLeadScoreBand(24).label).toBe('Cold')
    expect(getLeadScoreBand(25).label).toBe('Warm')
    expect(getLeadScoreBand(49).label).toBe('Warm')
    expect(getLeadScoreBand(50).label).toBe('Hot')
    expect(getLeadScoreBand(74).label).toBe('Hot')
    expect(getLeadScoreBand(75).label).toBe('Ready to book')
    expect(getLeadScoreBand(100).label).toBe('Ready to book')
  })

  it('clamps values outside 0-100 rather than falling through', () => {
    expect(getLeadScoreBand(-10).label).toBe('Cold')
    expect(getLeadScoreBand(1000).label).toBe('Ready to book')
  })

  it('every band carries the classes the bar and badge render', () => {
    for (const band of LEAD_SCORE_BANDS) {
      expect(band.barClass).toBeTruthy()
      expect(band.badgeClass).toBeTruthy()
    }
  })
})
