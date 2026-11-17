import { describe, expect, it } from 'vitest'
import { ipKey } from './ip-key'

describe('ipKey', () => {
  it('keeps an IPv4 address as it is', () => {
    expect(ipKey('203.0.113.7')).toBe('203.0.113.7')
  })

  it('gives every address in one IPv6 /64 the same key', () => {
    expect(ipKey('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3:8d3::/64')
    expect(ipKey('2001:db8:85a3:8d3::1')).toBe('2001:db8:85a3:8d3::/64')
    expect(ipKey('2001:0DB8:85A3:08D3:ffff:ffff:ffff:ffff')).toBe('2001:db8:85a3:8d3::/64')
  })

  it('gives different /64s different keys', () => {
    expect(ipKey('2001:db8:85a3:8d4::1')).not.toBe(ipKey('2001:db8:85a3:8d3::1'))
  })

  it('expands :: wherever it sits', () => {
    expect(ipKey('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(ipKey('::1')).toBe('0:0:0:0::/64')
    expect(ipKey('::')).toBe('0:0:0:0::/64')
    expect(ipKey('fe80::')).toBe('fe80:0:0:0::/64')
  })

  it('gives an IPv4-mapped address its IPv4 key', () => {
    expect(ipKey('::ffff:203.0.113.7')).toBe('203.0.113.7')
    expect(ipKey('::ffff:cb00:7107')).toBe('203.0.113.7')
  })

  it('drops a zone ID', () => {
    expect(ipKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64')
  })

  it('keeps anything it can’t read as given', () => {
    expect(ipKey('unknown')).toBe('unknown')
    expect(ipKey('1::2::3')).toBe('1::2::3')
    expect(ipKey('1:2:3:4:5:6:7')).toBe('1:2:3:4:5:6:7')
    expect(ipKey('1:2:3:4:5:6:7:8:9')).toBe('1:2:3:4:5:6:7:8:9')
    expect(ipKey('1:2:3:4::5:6:7:8')).toBe('1:2:3:4::5:6:7:8')
    expect(ipKey('2001:db8::zzzz')).toBe('2001:db8::zzzz')
    expect(ipKey('::ffff:300.0.0.1')).toBe('::ffff:300.0.0.1')
  })
})
