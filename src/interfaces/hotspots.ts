export interface HotSpots {
  spots: Place[],
}

/*
  place_idは適当
*/
interface Place {
  place_id: string,
  place_name: string,
  latitude: number,
  longitude: number,
  address: string,
  extra_infomation: ExtraInfomation
}

/*
  weather_infosはweather_news関係で取得したAPIの情報を垂れ流す予定
*/
interface ExtraInfomation {
  hot_images: ImageMetum[],
  website_url: string | null,
  average_review_score: number | null,
  comment: string,
  weather_infos: any,
}

interface ImageMetum {
  url: string,
  created_at: string,
}