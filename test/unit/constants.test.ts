import { DEEPSEEK_API_BASE_URL, DEEPSEEK_API_BETA_MODE_BASE_URL, DEEPSEEK_MODELS } from '@/constants'

describe('constants', () => {
  it('dEEPSEEK_API_BASE_URL points to production API', () => {
    expect(DEEPSEEK_API_BASE_URL).toBe('https://api.deepseek.com')
  })

  it('dEEPSEEK_API_BETA_MODE_BASE_URL points to beta API', () => {
    expect(DEEPSEEK_API_BETA_MODE_BASE_URL).toBe('https://api.deepseek.com/beta')
  })

  it('dEEPSEEK_MODELS contains supported model IDs', () => {
    expect(DEEPSEEK_MODELS).toContain('deepseek-v4-flash')
    expect(DEEPSEEK_MODELS).toContain('deepseek-v4-pro')
  })

  it('dEEPSEEK_MODELS is readonly tuple', () => {
    expect(Array.isArray(DEEPSEEK_MODELS)).toBe(true)
    expect(DEEPSEEK_MODELS.length).toBeGreaterThanOrEqual(2)
  })
})
