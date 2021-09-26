import 'source-map-support/register';

import { APIGatewayProxyHandler } from 'aws-lambda';
import serverlessExpress from '@vendia/serverless-express';
import express, { Request, Response } from 'express';
import axios from 'axios';
import { setupFireStore } from './common/firebase';
import { HotSpots } from './interfaces/hotspots'

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
  const firestore = setupFireStore();
  const result = await firestore.collection("tests").doc("hogeId").set({})
  const response = await axios.get('https://wxtech.weathernews.com/api/v1/ss1wx', {
    params: { lat: 35.65, lon: 140.04 },
    headers: { 'X-API-KEY': process.env.WEATHER_NEWS_API_KEY },
  });
  res.json(response.data);
});

app.get('/hotspots', async (req: Request, res: Response) => {
  const result: HotSpots = {
    spots: [{
      place_id: "tekitou",
      place_name: "熱海後楽園ホテル",
      latitude: 35.0886871,
      longitude: 139.0791992,
      address: "静岡県熱海市和田浜南町１０−１",
      extra_infomation: {
        hot_images: [
          {
            url: "https://atamibayresort.com/cms/storage/banner/1/3v07dz6g.jpg",
            created_at: '2021-09-26T02:05:42.299Z',
          }
        ],
        website_url: "https://www.atamikorakuen.co.jp/",
        average_review_score: 4.1,
        comment: "映え散らかしております",
        weather_infos: {},
      }
    }]
  }

  res.json(result);
});

export const handler: APIGatewayProxyHandler = serverlessExpress({ app });
