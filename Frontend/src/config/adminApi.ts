const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const configured =
  import.meta.env.VITE_ADMIN_API_ORIGIN ||
  import.meta.env.VITE_API_URL ||
  (typeof window === 'undefined' ? '' : window.location.origin)

export const ADMIN_API_ORIGIN = stripTrailingSlash(configured)

export const ADMIN_SOCKET_ORIGIN = ADMIN_API_ORIGIN
