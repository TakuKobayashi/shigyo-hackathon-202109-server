import 'source-map-support/register';

import { APIGatewayProxyHandler } from 'aws-lambda';
import serverlessExpress from '@vendia/serverless-express';
import express, { Request, Response } from 'express';
import axios, { AxiosResponse } from 'axios';
import { setupFireStore } from './common/firebase';
import { HotSpots, Place, ImageMetum } from './interfaces/hotspots';

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
  const lat = req.query.lat || 35.65;
  const lng = req.query.lng || 140.04;
  const firestore = setupFireStore();
  const result = await firestore.collection('tests').doc('hogeId').set({});
  const response = await axios.get('https://wxtech.weathernews.com/api/v1/ss1wx', {
    params: { lat: lat, lon: lng },
    headers: { 'X-API-KEY': process.env.WEATHER_NEWS_API_KEY },
  });
  res.json(response.data);
});

app.get('/hotspots', async (req: Request, res: Response) => {
  const lat = req.query.lat || 35.0886871;
  const lng = req.query.lng || 139.0791992;
  const weathernewsresponse = await axios.get('https://wxtech.weathernews.com/api/v1/ss1wx', {
    params: { lat: lat, lon: lng },
    headers: { 'X-API-KEY': process.env.WEATHER_NEWS_API_KEY },
  });
  const placeResponse = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
    params: { key: process.env.GOOGLE_API_KEY, location: [lat, lng].join(','), radius: 50000, language: 'ja' },
  });
  const placeResults = placeResponse.data.results;
  const hotSpotResults: Place[] = [];
  for (const placeResult of placeResults) {
    const placeDetailResponse = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: { key: process.env.GOOGLE_API_KEY, place_id: placeResult.place_id, language: 'ja' },
    });
    const placeDetail = placeDetailResponse.data;
    // address: placeDetailResponse.data.result.formatted_address
    // address: placeResult.vicinity
    // phone_number: placeDetailResponse.data.result.formatted_phone_number
    const photoResponsePromises: Promise<AxiosResponse<any>>[] = [];
    for (const photo of placeDetail.result.photos) {
      photoResponsePromises.push(
        axios.get('https://maps.googleapis.com/maps/api/place/photo', {
          params: {
            key: process.env.GOOGLE_API_KEY,
            photo_reference: photo.photo_reference,
            maxheight: photo.height,
            maxwidth: photo.width,
          },
        }),
      );
    }
    const reviews = placeDetail.result.reviews || [];
    let comment = 'すごくキレイな場所でした';
    if (reviews.length > 0) {
      comment = reviews[Math.floor(Math.random() * reviews.length)].text;
    }
    const photoResponses = await Promise.all(photoResponsePromises);
    const photoUrls = photoResponses.map((photoResponse) => String(photoResponse.request.res.responseUrl));
    hotSpotResults.push({
      place_id: placeResult.place_id,
      place_name: placeResult.name,
      latitude: placeResult.geometry.location.lat,
      longitude: placeResult.geometry.location.lng,
      address: placeDetail.result.formatted_address,
      extra_infomation: {
        hot_images: photoUrls.map((photoUrl) => {
          const date = new Date();
          return {
            url: photoUrl,
            created_at: date.toISOString(),
          } as ImageMetum;
        }),
        average_review_score: placeResult.rating,
        comment: comment,
        weather_infos: {},
      },
    });
  }
  res.json({ spots: hotSpotResults, weather_infos: weathernewsresponse.data });
});

export const handler: APIGatewayProxyHandler = serverlessExpress({ app });
