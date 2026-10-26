import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`
  🚀 MindRise Server is running!
  📡 Port: http://localhost:${config.port}
  🩺 Health Endpoint: http://localhost:${config.port}/health
  🌍 Environment: ${config.env}
  `);
});
