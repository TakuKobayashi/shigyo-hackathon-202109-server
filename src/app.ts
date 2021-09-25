
import 'source-map-support/register';

import { APIGatewayProxyHandler } from 'aws-lambda';
import serverlessExpress from '@vendia/serverless-express';
import express, {Request, Response} from "express"

const app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors({ origin: true }));

app.get('/test', async (req: Request, res: Response) => {
  res.json({hello: 'world'})
});

export const handler: APIGatewayProxyHandler = serverlessExpress({app});