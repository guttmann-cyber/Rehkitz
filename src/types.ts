export interface SearchRequest {
  id: number;
  area: any; // GeoJSON or Leaflet LatLngs
  message: string;
  contact_name: string;
  contact_phone: string;
  search_date: string;
  status: 'active' | 'searched';
  fawns_found?: number;
  photo?: string;
  area_ha?: number;
  notes?: string;
  created_at: string;
}

export type WebSocketMessage = 
  | { type: "NEW_REQUEST"; payload: SearchRequest }
  | { type: "UPDATE_REQUEST"; payload: SearchRequest }
  | { type: "DELETE_REQUEST"; payload: { id: number } };
