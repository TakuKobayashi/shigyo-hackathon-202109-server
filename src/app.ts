import 'source-map-support/register';

import { APIGatewayProxyHandler } from 'aws-lambda';
import serverlessExpress from '@vendia/serverless-express';
import express, { Request, Response } from 'express';
import axios, { AxiosResponse } from 'axios';
import { setupFireStore } from './common/firebase';
import { HotSpots, Place, ImageMetum } from './interfaces/hotspots';

const geohash = require('ngeohash');
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
  const hotSpotResults: Place[] = [];
  const locationGeohash = geohash.encode(lat, lng);
  const wideLocationGeohash = locationGeohash.substring(0, 6);
  const firestore = setupFireStore();
  const locationHitDocs = await firestore.collection('area_location').doc(wideLocationGeohash).get();
  const locationHitData = locationHitDocs.data();
  if (locationHitData && locationHitData.hitPlaceIds.length > 0) {
    const placeInfoPromises: Promise<FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>>[] = [];
    for (const placeId of locationHitData.hitPlaceIds) {
      placeInfoPromises.push(firestore.collection('place_info').doc(placeId).get());
    }
    const placeInfos = await Promise.all(placeInfoPromises);
    for (let i = 0; i < locationHitData.hitPlaceIds.length; ++i) {
      const placeInfo = placeInfos[i].data();
      if (!placeInfo) {
        continue;
      }
      const placeId = locationHitData.hitPlaceIds[i];
      const comment = getReviewComment(placeInfo.reviews || []);
      hotSpotResults.push({
        place_id: placeId,
        place_name: placeInfo.place_name,
        latitude: placeInfo.latitude,
        longitude: placeInfo.longitude,
        address: placeInfo.address,
        extra_infomation: {
          hot_images: placeInfo.imageMeta,
          average_review_score: placeInfo.review_score,
          comment: comment,
          weather_infos: {},
        },
      });
    }
    res.json({ spots: hotSpotResults, weather_infos: weathernewsresponse.data });
    return;
  }
  const placeResponse = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
    params: { key: process.env.GOOGLE_API_KEY, location: [lat, lng].join(','), radius: 50000, language: 'ja' },
  });
  const placeResults = placeResponse.data.results;
  const placeDetailResponsePromises: Promise<AxiosResponse<any>>[] = [];
  for (const placeResult of placeResults) {
    placeDetailResponsePromises.push(
      axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
        params: { key: process.env.GOOGLE_API_KEY, place_id: placeResult.place_id, language: 'ja' },
      }),
    );
  }
  const placeDetailResponses = await Promise.all(placeDetailResponsePromises);
  const placeIdInfos: { [s: string]: any } = {};
  for (const placeResult of placeResults) {
    const placeDetailResponse = placeDetailResponses.find((placeDetailRes) => placeResult.place_id === placeDetailRes.data.result.place_id);
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
    const comment = getReviewComment(reviews);
    const photoResponses = await Promise.all(photoResponsePromises);
    const nowDate = new Date();
    const photoUrls = photoResponses.map((photoResponse) => String(photoResponse.request.res.responseUrl));
    const resultPlace: Place = {
      place_id: placeResult.place_id,
      place_name: placeResult.name,
      latitude: placeResult.geometry.location.lat,
      longitude: placeResult.geometry.location.lng,
      address: placeDetail.result.formatted_address,
      extra_infomation: {
        hot_images: photoUrls.map((photoUrl) => {
          return {
            url: photoUrl,
            created_at: nowDate.toISOString(),
          } as ImageMetum;
        }),
        average_review_score: placeResult.rating,
        comment: comment,
        weather_infos: {},
      },
    };
    hotSpotResults.push(resultPlace);
    placeIdInfos[resultPlace.place_id] = {
      place_name: placeResult.name,
      latitude: placeResult.geometry.location.lat,
      longitude: placeResult.geometry.location.lng,
      address: placeDetail.result.formatted_address,
      review_score: placeResult.rating || 0,
      imageMeta: resultPlace.extra_infomation.hot_images,
      reviews: reviews,
    };
  }
  const nowDate = new Date();
  await firestore
    .collection('area_location')
    .doc(wideLocationGeohash)
    .set({ hitPlaceIds: Object.keys(placeIdInfos), created_at: nowDate.getTime() });
  const savePlacePromises: Promise<FirebaseFirestore.WriteResult>[] = [];
  for (const placeId of Object.keys(placeIdInfos)) {
    savePlacePromises.push(firestore.collection('place_info').doc(placeId).set(placeIdInfos[placeId]));
  }
  await Promise.all(savePlacePromises);
  res.json({ spots: hotSpotResults, weather_infos: weathernewsresponse.data });
});

function getReviewComment(reviews: { [s: string]: any }[]): string {
  let comment = 'すごくキレイな場所でした';
  if (reviews.length > 0) {
    comment = reviews[Math.floor(Math.random() * reviews.length)].text;
  }
  return comment;
}

export const handler: APIGatewayProxyHandler = serverlessExpress({ app });
