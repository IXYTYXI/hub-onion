import {
  createError,
  defineEventHandler,
  getMethod,
  getRequestProtocol,
  getRequestURL,
  proxyRequest,
} from 'h3'

const BACKEND_TARGET = process.env.BACKEND_URL || 'http://localhost:8080'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const path = url.pathname
  const method = getMethod(event)

  let shouldProxy = false

  if (path.startsWith('/api/v1')) {
    shouldProxy = true
  } else if (path.startsWith('/.well-known/clawhub')) {
    shouldProxy = true
  } else if (path.startsWith('/auth/')) {
    if (method !== 'GET') {
      shouldProxy = true
    } else if (!path.startsWith('/auth/login')) {
      shouldProxy = true
    }
  }

  if (!shouldProxy) return

  const target = `${BACKEND_TARGET}${path}${url.search}`
  try {
    if (path.startsWith('/auth/') && method === 'GET') {
      return await proxyRequest(event, target, {
        headers: {
          'x-forwarded-host': url.host,
          'x-forwarded-proto': getRequestProtocol(event, { xForwardedProto: true }),
        },
        fetchOptions: {
          redirect: 'manual',
        },
      })
    }
    return await proxyRequest(event, target)
  } catch {
    throw createError({ statusCode: 502, message: 'Backend service unavailable' })
  }
})
