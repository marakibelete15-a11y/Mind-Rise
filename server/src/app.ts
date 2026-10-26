import express, { Express } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export const createApp = (): Express => {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: config.clientUrl,
      credentials: true,
    }),
  );
  app.use(express.json());

  // Mount application routes
  app.use('/', routes);

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
};
