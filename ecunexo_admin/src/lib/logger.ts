import { createLogger } from 'lognerd'

export const logger = createLogger({
  runtimeEnvironment: 'client',
  level: (import.meta.env.VITE_LOGNERD_LEVEL as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR') ?? 'INFO',
  enableConsole: import.meta.env.VITE_LOGNERD_ENABLE_CONSOLE !== 'false',
  enableFile: false,
})
