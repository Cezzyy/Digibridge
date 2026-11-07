import { z } from 'zod'

// Devices a respondent owns and how they usually get internet (PRO-01).
// Stored as text arrays, so these lists are the only check.

export const DEVICES = ['smartphone', 'laptop', 'desktop', 'tablet', 'none'] as const
export const deviceSchema = z.enum(DEVICES, { error: 'Pick your devices from the list.' })
export type Device = (typeof DEVICES)[number]

export const DEVICE_LABELS = {
  smartphone: 'Smartphone',
  laptop: 'Laptop',
  desktop: 'Desktop computer',
  tablet: 'Tablet',
  none: 'None',
} as const satisfies Record<Device, string>

export const INTERNET_ACCESS = [
  'home_wifi',
  'mobile_data',
  'school_wifi',
  'piso_wifi',
  'none',
] as const
export const internetAccessSchema = z.enum(INTERNET_ACCESS, {
  error: 'Pick how you get internet from the list.',
})
export type InternetAccess = (typeof INTERNET_ACCESS)[number]

export const INTERNET_ACCESS_LABELS = {
  home_wifi: 'Wi-Fi at home',
  mobile_data: 'Mobile data',
  school_wifi: 'School Wi-Fi',
  piso_wifi: 'Piso Wi-Fi',
  none: 'None',
} as const satisfies Record<InternetAccess, string>
