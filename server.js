import { env } from 'process';
import express from 'express';
import router from './routes/index';

const port = env.PORRT ? env.PORRT : '5000';

const app = express();

app.use(express.json());
app.use('/', router);

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
