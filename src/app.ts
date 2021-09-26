import 'source-map-support/register';

import { APIGatewayProxyHandler } from 'aws-lambda';
import serverlessExpress from '@vendia/serverless-express';
import express, { Request, Response } from 'express';
import axios from 'axios';

const app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors({ origin: true }));

app.get('/test', async (req: Request, res: Response) => {
  res.json({ hello: 'world' });
});

app.get('/sample', async (req: Request, res: Response) => {
  const response = await axios.get('https://wxtech.weathernews.com/api/v1/ss1wx', {
    params: { lat: 35.65, lon: 140.04 },
    headers: { 'X-API-KEY': process.env.WEATHER_NEWS_API_KEY },
  });
  res.json(response.data);
});

export const handler: APIGatewayProxyHandler = serverlessExpress({ app });
