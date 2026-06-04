import pino from 'pino'

// Єдиний екземпляр логера на весь застосунок. Імпортується звідси скрізь,
// де потрібно логувати події (контролери, app.js, pino-http middleware).
//
// У розробці (NODE_ENV !== 'production') вивід форматується pino-pretty —
// з кольорами, відступами та людським часом, рівень debug і вище.
// У production логер пише чистий JSON починаючи з рівня info — такий формат
// зручний для зовнішніх сервісів збору логів.
const isDev = process.env.NODE_ENV !== 'production'

const logger = pino({
  level: isDev ? 'debug' : 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
    },
  }),
})

export default logger
