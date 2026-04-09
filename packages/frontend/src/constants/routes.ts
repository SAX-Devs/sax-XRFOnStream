export const ROUTES = {
  LOGIN: "/login",
  ACCEPT_INVITE: "/accept-invite",
  DEVICES: "/devices",
  DEVICE_STATUS: (id: string) => `/devices/${id}/status`,
  DEVICE_MEASUREMENTS: (id: string) => `/devices/${id}/measurements`,
  DEVICE_OPERATOR: (id: string) => `/devices/${id}/operator`,
  DEVICE_SERVICE: (id: string) => `/devices/${id}/service`,
  DEVICE_ALERTS: (id: string) => `/devices/${id}/alerts`,
  ADMIN: "/admin",
  ADMIN_TENANTS: "/admin/tenants",
  ADMIN_TENANT_DETAIL: (id: string) => `/admin/tenants/${id}`,
} as const;

export const PUBLIC_ROUTES = [ROUTES.LOGIN, ROUTES.ACCEPT_INVITE];
