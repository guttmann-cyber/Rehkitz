import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, FeatureGroup, useMap, Popup, LayersControl } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Map as MapIcon, 
  Plus, 
  User, 
  Phone, 
  Calendar, 
  MessageSquare, 
  Trash2, 
  X,
  Info,
  CheckCircle2,
  Navigation,
  Users,
  Sprout,
  ChevronRight,
  LogOut,
  CheckCircle,
  AlertCircle,
  Camera,
  BarChart3,
  Download,
  CloudSun,
  Sun,
  Cloud,
  CloudRain,
  Image as ImageIcon,
  LocateFixed
} from 'lucide-react';
import type { SearchRequest, WebSocketMessage } from './types';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Fix Leaflet icon issue
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const calculatePolygonArea = (coords: { lat: number, lng: number }[]) => {
  let area = 0;
  const R = 6378137; // Earth radius in meters
  if (coords && coords.length > 2) {
    for (let i = 0; i < coords.length; i++) {
      const p1 = coords[i];
      const p2 = coords[(i + 1) % coords.length];
      area += (p2.lng * Math.PI / 180 - p1.lng * Math.PI / 180) * 
              (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
    }
    area = area * R * R / 2;
  }
  return Math.abs(area) / 10000; // hectares
};

const WeatherWidget = ({ location }: { location: L.LatLng | null }) => {
  const [weather, setWeather] = useState<any>(null);

  useEffect(() => {
    if (!location) return;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`)
      .then(res => res.json())
      .then(data => setWeather(data))
      .catch(() => {});
  }, [location]);

  if (!weather) return null;

  const current = weather.current_weather;
  const daily = weather.daily;
  const isGoodForDrone = current.windspeed < 20 && current.weathercode < 3;

  const getWeatherIcon = (code: number) => {
    if (code <= 1) return <Sun size={14} className="text-amber-500" />;
    if (code <= 3) return <CloudSun size={14} className="text-amber-500" />;
    if (code <= 48) return <Cloud size={14} className="text-stone-400" />;
    return <CloudRain size={14} className="text-blue-400" />;
  };

  const getDayName = (dateStr: string, index: number) => {
    if (index === 0) return 'Heute';
    if (index === 1) return 'Morgen';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { weekday: 'short' });
  };

  return (
    <div className="bg-white/80 backdrop-blur-md border border-stone-200 rounded-2xl p-4 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CloudSun size={14} className="text-amber-500" />
          <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Wetter & Prognose</h4>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isGoodForDrone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {isGoodForDrone ? 'Flugwetter' : 'Windwarnung'}
        </span>
      </div>

      {/* Current Weather */}
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-stone-100">
        <div className="text-3xl font-black text-stone-800">{Math.round(current.temperature)}°C</div>
        <div className="flex-1">
          <div className="text-xs font-bold text-stone-600 flex items-center gap-1">
            Wind: {current.windspeed} km/h
          </div>
          <div className="text-[10px] text-stone-400">
            {isGoodForDrone ? 'Optimal für Drohnenflug' : 'Vorsicht bei Böen'}
          </div>
        </div>
      </div>

      {/* Forecast */}
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map((idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <div className="text-[10px] font-bold text-stone-400 uppercase">{getDayName(daily.time[idx], idx)}</div>
            <div className="flex items-center gap-2">
              {getWeatherIcon(daily.weathercode[idx])}
              <div className="text-xs font-black text-stone-700">
                {Math.round(daily.temperature_2m_max[idx])}°
                <span className="text-stone-400 font-normal ml-1">
                  {Math.round(daily.temperature_2m_min[idx])}°
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LocateButton = ({ onLocationFound }: { onLocationFound: (latlng: L.LatLng) => void }) => {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const handleLocate = () => {
    setLocating(true);
    map.locate().on("locationfound", (e) => {
      map.flyTo(e.latlng, 16);
      onLocationFound(e.latlng);
      setLocating(false);
    }).on("locationerror", () => {
      setLocating(false);
      alert("Standort konnte nicht gefunden werden.");
    });
  };

  return (
    <div className="leaflet-bottom leaflet-right mb-24 mr-4">
      <div className="leaflet-control">
        <button
          onClick={handleLocate}
          disabled={locating}
          className={`w-12 h-12 bg-white rounded-2xl shadow-2xl flex items-center justify-center text-stone-600 hover:text-emerald-600 transition-all active:scale-90 border border-stone-200 ${locating ? 'animate-pulse' : ''}`}
          title="Mein Standort"
        >
          <LocateFixed size={24} className={locating ? 'text-emerald-500' : ''} />
        </button>
      </div>
    </div>
  );
};

const MapEvents = ({ onLocationFound }: { onLocationFound: (latlng: L.LatLng) => void }) => {
  const map = useMap();
  useEffect(() => {
    map.locate().on("locationfound", (e) => {
      map.flyTo(e.latlng, 13);
      onLocationFound(e.latlng);
    });
  }, [map]);
  return null;
};

type Role = 'farmer' | 'searcher' | null;

export default function App() {
  const [role, setRole] = useState<Role>(() => {
    const saved = localStorage.getItem('rehkitz_role');
    return (saved as Role) || null;
  });
  const [requests, setRequests] = useState<SearchRequest[]>([]);
  const [notifications, setNotifications] = useState<{id: string, message: string}[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentArea, setCurrentArea] = useState<any>(null);
  const [formData, setFormData] = useState({
    message: '',
    contact_name: '',
    contact_phone: '',
    search_date: '',
    area_ha: 0 as number | undefined
  });
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<number | null>(null);
  const [completionRequest, setCompletionRequest] = useState<SearchRequest | null>(null);
  const [completionData, setCompletionData] = useState({ fawns: 0, photo: '', notes: '' });
  const [showStats, setShowStats] = useState(false);
  const [statsTab, setStatsTab] = useState<'overview' | 'gallery'>('overview');
  const [statsYear, setStatsYear] = useState<number>(new Date().getFullYear());
  const [userLocation, setUserLocation] = useState<L.LatLng | null>(null);
  const featureGroupRef = useRef<L.FeatureGroup>(null);

  useEffect(() => {
    if (!role) return;
    localStorage.setItem('rehkitz_role', role);

    // Initial fetch
    fetch('/api/requests')
      .then(res => res.json())
      .then(data => setRequests(data));

    // WebSocket setup
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onmessage = (event) => {
      const msg: WebSocketMessage = JSON.parse(event.data);
      if (msg.type === 'NEW_REQUEST') {
        setRequests(prev => [msg.payload, ...prev]);
      } else if (msg.type === 'UPDATE_REQUEST') {
        setRequests(prev => {
          const oldReq = prev.find(r => r.id === msg.payload.id);
          // Notify farmer if status changed to searched
          if (role === 'farmer' && oldReq?.status === 'active' && msg.payload.status === 'searched') {
            const newNotif = {
              id: Math.random().toString(36).substr(2, 9),
              message: `Fläche von ${msg.payload.contact_name} wurde als abgesucht markiert!`
            };
            setNotifications(current => [...current, newNotif]);
            setTimeout(() => {
              setNotifications(current => current.filter(n => n.id !== newNotif.id));
            }, 8000);
          }
          return prev.map(r => r.id === msg.payload.id ? msg.payload : r);
        });
      } else if (msg.type === 'DELETE_REQUEST') {
        setRequests(prev => prev.filter(r => r.id !== msg.payload.id));
      }
    };

    return () => ws.close();
  }, [role]);

  useEffect(() => {
    if (isDrawing) {
      // Auto-trigger the polygon tool when drawing mode is activated
      const timer = setTimeout(() => {
        const polygonBtn = document.querySelector('.leaflet-draw-draw-polygon') as HTMLElement;
        if (polygonBtn) {
          polygonBtn.click();
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Ensure Leaflet Draw is also cancelled if we stop drawing via our UI
      const cancelBtn = document.querySelector('.leaflet-draw-actions a') as HTMLElement;
      if (cancelBtn) {
        cancelBtn.click();
      }
    }
  }, [isDrawing]);

  const handleCreated = (e: any) => {
    const { layerType, layer } = e;
    if (layerType === 'polygon') {
      const latlngs = layer.getLatLngs()[0];
      setCurrentArea(latlngs);
      const areaHa = calculatePolygonArea(latlngs);
      setFormData(prev => ({ ...prev, area_ha: areaHa }));
      setShowForm(true);
      setIsDrawing(false);
    }
  };

  const clearDrawnItems = () => {
    if (featureGroupRef.current) {
      featureGroupRef.current.clearLayers();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const body = {
      ...formData,
      area: currentArea,
      area_ha: calculatePolygonArea(currentArea),
      status: 'active'
    };

    const url = editingRequestId ? `/api/requests/${editingRequestId}` : '/api/requests';
    const method = editingRequestId ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      setShowForm(false);
      setCurrentArea(null);
      setEditingRequestId(null);
      setFormData({ message: '', contact_name: '', contact_phone: '', search_date: '', area_ha: 0 });
      clearDrawnItems();
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setCurrentArea(null);
    setEditingRequestId(null);
    setFormData({ message: '', contact_name: '', contact_phone: '', search_date: '', area_ha: 0 });
    clearDrawnItems();
  };

  const startReactivation = (req: SearchRequest) => {
    setEditingRequestId(req.id);
    setCurrentArea(req.area);
    setFormData({
      message: req.message,
      contact_name: req.contact_name,
      contact_phone: req.contact_phone,
      search_date: req.search_date,
      area_ha: req.area_ha
    });
    setShowForm(true);
  };

  const releaseArea = async (id: number, data?: { fawns: number, photo: string, notes: string }) => {
    await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'searched',
        fawns_found: data?.fawns || 0,
        photo: data?.photo || null,
        notes: data?.notes || null
      })
    });
    setCompletionRequest(null);
    setCompletionData({ fawns: 0, photo: '', notes: '' });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompletionData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteRequest = async (id: number) => {
    await fetch(`/api/requests/${id}`, { method: 'DELETE' });
    setRequestToDelete(null);
  };

  const logout = () => {
    localStorage.removeItem('rehkitz_role');
    setRole(null);
  };

  const activeRequests = requests.filter(r => r.status === 'active');

  if (!role) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-stone-200 flex flex-col items-center text-center group cursor-pointer hover:border-emerald-500 transition-all"
            onClick={() => setRole('farmer')}
          >
            <div className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
              <Sprout className="text-emerald-600 w-12 h-12" />
            </div>
            <h2 className="text-3xl font-black text-stone-900 mb-4">Ich bin Landwirt</h2>
            <p className="text-stone-500 mb-8 leading-relaxed">
              Markiere deine Wiesen auf der Karte und finde freiwillige Helfer, die sie vor dem Mähen nach Rehkitzen absuchen.
            </p>
            <div className="mt-auto flex items-center gap-2 text-emerald-600 font-bold">
              App starten <ChevronRight size={20} />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-stone-200 flex flex-col items-center text-center group cursor-pointer hover:border-amber-500 transition-all"
            onClick={() => setRole('searcher')}
          >
            <div className="w-24 h-24 bg-amber-100 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
              <Users className="text-amber-600 w-12 h-12" />
            </div>
            <h2 className="text-3xl font-black text-stone-900 mb-4">Ich bin Sucher</h2>
            <p className="text-stone-500 mb-8 leading-relaxed">
              Unterstütze Landwirte in deiner Region. Sieh dir aktive Anfragen an und koordiniere Rettungsaktionen.
            </p>
            <div className="mt-auto flex items-center gap-2 text-amber-600 font-bold">
              App starten <ChevronRight size={20} />
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-stone-50 font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`${role === 'farmer' ? 'bg-emerald-600' : 'bg-amber-600'} p-2 rounded-lg`}>
            {role === 'farmer' ? <Sprout className="text-white w-6 h-6" /> : <Users className="text-white w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">
              Rehkitz-Retter <span className="text-stone-400 font-normal">| {role === 'farmer' ? 'Landwirt' : 'Sucher'}</span>
            </h1>
          </div>
        </div>
        
        <button 
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-stone-100 text-stone-600 hover:bg-stone-200 transition-all"
        >
          <LogOut size={16} />
          Rolle wechseln
        </button>
        <button 
          onClick={() => setShowStats(!showStats)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
            showStats ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <BarChart3 size={16} />
          Statistik
        </button>
      </header>

      {/* Notifications Overlay */}
      <div className="fixed top-24 right-6 z-[3000] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="bg-white border-l-4 border-emerald-500 shadow-2xl rounded-2xl p-4 min-w-[320px] pointer-events-auto flex items-center gap-4"
            >
              <div className="bg-emerald-100 p-2 rounded-full">
                <CheckCircle className="text-emerald-600 w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-stone-900">Suche abgeschlossen</p>
                <p className="text-xs text-stone-500 leading-relaxed">{n.message}</p>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                className="text-stone-300 hover:text-stone-500 transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Completion Modal */}
      <AnimatePresence>
        {completionRequest && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <h3 className="text-2xl font-bold text-stone-900 mb-2 text-center">Suche abschließen</h3>
              <p className="text-stone-500 text-sm mb-8 text-center">
                Wie viele Rehkitze wurden auf dieser Fläche gefunden?
              </p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Anzahl Rehkitze</label>
                  <div className="flex items-center justify-center gap-6">
                    <button 
                      onClick={() => setCompletionData(prev => ({ ...prev, fawns: Math.max(0, prev.fawns - 1) }))}
                      className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-2xl font-bold text-stone-600 hover:bg-stone-200"
                    >
                      -
                    </button>
                    <span className="text-4xl font-black text-stone-900 w-12 text-center">{completionData.fawns}</span>
                    <button 
                      onClick={() => setCompletionData(prev => ({ ...prev, fawns: prev.fawns + 1 }))}
                      className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-2xl font-bold text-stone-600 hover:bg-stone-200"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Foto (optional)</label>
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoUpload}
                      className="hidden" 
                      id="photo-upload"
                    />
                    <label 
                      htmlFor="photo-upload"
                      className="cursor-pointer flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-stone-200 rounded-2xl hover:border-emerald-400 hover:bg-emerald-50 transition-all overflow-hidden"
                    >
                      {completionData.photo ? (
                        <img src={completionData.photo} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <>
                          <Camera className="text-stone-300 mb-2" size={32} />
                          <span className="text-xs text-stone-400">Foto hochladen oder aufnehmen</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Notizen & Details (optional)</label>
                  <textarea 
                    value={completionData.notes}
                    onChange={(e) => setCompletionData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Besonderheiten, Fundorte oder Hinweise für den Landwirt..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none min-h-[100px] resize-none"
                  />
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <button 
                    onClick={() => releaseArea(completionRequest.id, completionData)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-100"
                  >
                    Suche speichern & freigeben
                  </button>
                  <button 
                    onClick={() => setCompletionRequest(null)}
                    className="w-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-4 rounded-2xl transition-all"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Statistics Panel */}
      <AnimatePresence>
        {showStats && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
              onClick={() => setShowStats(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-stone-900">Rehkitz-Statistik</h3>
                  <div className="flex gap-4 mt-2">
                    <button 
                      onClick={() => setStatsTab('overview')}
                      className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${statsTab === 'overview' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                    >
                      Übersicht
                    </button>
                    <button 
                      onClick={() => setStatsTab('gallery')}
                      className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${statsTab === 'gallery' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                    >
                      Galerie
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select 
                    value={statsYear}
                    onChange={(e) => setStatsYear(parseInt(e.target.value))}
                    className="bg-stone-100 text-stone-600 px-3 py-2 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {Array.from(new Set(requests.map(r => new Date(r.created_at).getFullYear())))
                      .sort((a: number, b: number) => b - a)
                      .map(year => (
                        <option key={year} value={year}>Saison {year}</option>
                      ))}
                    {requests.length === 0 && <option value={new Date().getFullYear()}>Saison {new Date().getFullYear()}</option>}
                  </select>
                  <button 
                    onClick={() => {
                      const doc = new jsPDF();
                      doc.setFontSize(20);
                      doc.text(`Rehkitz-Retter Einsatzbericht ${statsYear}`, 14, 22);
                      doc.setFontSize(11);
                      doc.setTextColor(100);
                      doc.text(`Erstellt am: ${new Date().toLocaleString('de-DE')}`, 14, 30);
                      const filteredRequests = requests.filter(r => 
                        r.status === 'searched' && 
                        new Date(r.created_at).getFullYear() === statsYear
                      );
                      const totalFawns = filteredRequests.reduce((sum, r) => sum + (r.fawns_found || 0), 0);
                      doc.setFontSize(14);
                      doc.setTextColor(0);
                      doc.text("Zusammenfassung", 14, 45);
                      doc.setFontSize(11);
                      doc.text(`Gesamt gerettete Rehkitze: ${totalFawns}`, 14, 52);
                      doc.text(`Abgesuchte Flächen: ${filteredRequests.length}`, 14, 58);
                      const tableData = filteredRequests.map(r => [
                        new Date(r.created_at).toLocaleDateString('de-DE'),
                        r.contact_name,
                        r.area_ha != null ? `${Number(r.area_ha).toFixed(2)} ha` : '-',
                        `${r.fawns_found || 0} Kitze`
                      ]);
                      autoTable(doc, {
                        startY: 70,
                        head: [['Datum', 'Landwirt', 'Fläche', 'Ergebnis']],
                        body: tableData,
                        theme: 'striped',
                        headStyles: { fillColor: [5, 150, 105] }
                      });
                      doc.save(`Rehkitz-Retter-Statistik-${statsYear}.pdf`);
                    }}
                    className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-600 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  >
                    <Download size={16} />
                    PDF Export
                  </button>
                  <button onClick={() => setShowStats(false)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400">
                    <X size={24} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8">
                {statsTab === 'overview' ? (
                  <>
                    <div className="grid grid-cols-2 gap-6 mb-8">
                      <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100">
                        <p className="text-emerald-600 text-xs font-bold uppercase mb-1">Gefunden {statsYear}</p>
                        <p className="text-4xl font-black text-emerald-900">
                          {requests
                            .filter(r => new Date(r.created_at).getFullYear() === statsYear)
                            .reduce((acc, r) => acc + (r.fawns_found || 0), 0)}
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100">
                        <p className="text-blue-600 text-xs font-bold uppercase mb-1">Fläche {statsYear}</p>
                        <p className="text-4xl font-black text-blue-900">
                          {requests
                            .filter(r => r.status === 'searched' && new Date(r.created_at).getFullYear() === statsYear)
                            .reduce((acc, r) => acc + (Number(r.area_ha) || 0), 0)
                            .toFixed(1)}
                          <span className="text-xl ml-1">ha</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Dokumentierte Funde {statsYear}</h4>
                      <div className="text-[10px] font-bold text-stone-300 uppercase">Chronologisch</div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4 mb-12">
                      {requests.filter(r => r.status === 'searched' && new Date(r.created_at).getFullYear() === statsYear).length === 0 ? (
                        <div className="text-center py-12 bg-stone-50 rounded-3xl border border-dashed border-stone-200">
                          <ImageIcon className="mx-auto text-stone-200 mb-2" size={32} />
                          <p className="text-stone-400 italic text-sm">Noch keine abgesuchten Flächen für {statsYear} dokumentiert.</p>
                        </div>
                      ) : (
                        requests
                          .filter(r => r.status === 'searched' && new Date(r.created_at).getFullYear() === statsYear)
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map(r => (
                            <div key={r.id} className="group relative bg-white rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex h-40">
                              <div className="w-40 h-full bg-stone-100 flex-shrink-0 relative overflow-hidden">
                                {r.photo ? (
                                  <img 
                                    src={r.photo} 
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 cursor-pointer" 
                                    alt="Fund" 
                                    onClick={() => window.open(r.photo, '_blank')}
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-stone-300">
                                    <ImageIcon size={32} />
                                    <span className="text-[10px] uppercase font-bold mt-1">Kein Foto</span>
                                  </div>
                                )}
                                {r.fawns_found > 0 && (
                                  <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg">
                                    {r.fawns_found} KITZE
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex-1 p-5 flex flex-col justify-between">
                                <div>
                                  <div className="flex justify-between items-start mb-1">
                                    <h5 className="font-bold text-stone-800 leading-tight">{r.contact_name}</h5>
                                    <span className="text-[10px] font-bold text-stone-400 bg-stone-50 px-2 py-1 rounded-md">
                                      {new Date(r.created_at).toLocaleDateString('de-DE')}
                                    </span>
                                  </div>
                                  <p className="text-xs text-stone-500 line-clamp-2 italic mb-3">"{r.message}"</p>
                                  
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      <span className="text-[10px] font-bold text-stone-500 uppercase tracking-tighter">
                                        {r.area_ha != null ? `${Number(r.area_ha).toFixed(2)} ha` : 'Unbekannt'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                      <span className="text-[10px] font-bold text-stone-500 uppercase tracking-tighter">
                                        {r.fawns_found || 0} Gefunden
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center justify-between pt-3 border-t border-stone-50">
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-stone-400">
                                    <Navigation size={10} />
                                    <span>Fläche abgesucht</span>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      setShowStats(false);
                                    }}
                                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest"
                                  >
                                    Details ansehen
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {requests.filter(r => r.status === 'searched' && r.photo).length === 0 ? (
                      <div className="col-span-3 text-center py-20">
                        <Camera className="mx-auto text-stone-200 mb-4" size={48} />
                        <p className="text-stone-400 italic">Noch keine Fotos hochgeladen.</p>
                      </div>
                    ) : (
                      requests
                        .filter(r => r.status === 'searched' && r.photo)
                        .map(r => (
                          <div key={r.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-sm hover:shadow-md transition-all">
                            <img 
                              src={r.photo} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 cursor-pointer" 
                              alt="Fund" 
                              onClick={() => window.open(r.photo, '_blank')}
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                              <p className="text-[10px] font-bold text-white uppercase tracking-wider truncate">{r.contact_name}</p>
                              <p className="text-[8px] text-white/70 uppercase">{new Date(r.created_at).toLocaleDateString('de-DE')}</p>
                            </div>
                            {r.fawns_found > 0 && (
                              <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg">
                                {r.fawns_found}
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {requestToDelete !== null && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
              onClick={() => setRequestToDelete(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="text-red-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Markierung löschen?</h3>
              <p className="text-stone-500 text-sm mb-8">
                Bist du sicher, dass du diese Fläche und alle zugehörigen Daten dauerhaft löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => deleteRequest(requestToDelete)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
                >
                  Ja, endgültig löschen
                </button>
                <button 
                  onClick={() => setRequestToDelete(null)}
                  className="w-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-3 rounded-xl transition-all"
                >
                  Abbrechen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex relative">
        {/* Sidebar */}
        <div className="w-96 bg-white border-r border-stone-200 flex flex-col z-40 shadow-xl">
          <div className="p-6 border-b border-stone-100">
            <h2 className="text-lg font-bold text-stone-800 mb-1">
              Aktive Suchanfragen
            </h2>
            <p className="text-sm text-stone-500">
              {role === 'farmer' ? 'Wiesen, die noch abgesucht werden müssen' : 'Finde Flächen in deiner Nähe'}
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <WeatherWidget location={userLocation} />
            {activeRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-stone-400 text-center px-8">
                <MapIcon size={48} className="mb-4 opacity-20" />
                <p className="text-sm">Keine aktiven Anfragen vorhanden.</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {activeRequests.map((req) => (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`rounded-2xl p-5 border-2 transition-all group shadow-sm relative overflow-hidden ${
                      role === 'farmer' 
                        ? 'bg-emerald-50/80 border-emerald-200 hover:border-emerald-400 hover:shadow-md' 
                        : 'bg-amber-50/80 border-amber-200 hover:border-amber-400 hover:shadow-md'
                    }`}
                  >
                    {/* Status Indicator Bar */}
                    <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${role === 'farmer' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    
                    <div className="flex justify-between items-start mb-3 pl-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-white/60 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border border-current opacity-80">
                          <div className={`w-1.5 h-1.5 rounded-full ${role === 'farmer' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                          Aktiv
                        </div>
                        <div className={`flex items-center gap-2 font-bold text-sm ${role === 'farmer' ? 'text-emerald-700' : 'text-amber-700'}`}>
                          <div className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${role === 'farmer' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${role === 'farmer' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                          </div>
                          {new Date(req.search_date).toLocaleDateString('de-DE', { 
                            day: '2-digit', 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </div>
                        {new Date(req.search_date).toDateString() === new Date().toDateString() && (
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${role === 'farmer' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                            Heute
                          </span>
                        )}
                        {(req.area_ha != null) && (
                          <span className="px-2 py-0.5 bg-white/50 rounded-lg text-[10px] border border-current opacity-70">
                            {Number(req.area_ha).toFixed(2)} ha
                          </span>
                        )}
                      </div>
                      {role === 'farmer' && (
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => role === 'searcher' ? setCompletionRequest(req) : releaseArea(req.id)}
                            title="Aufgabe abschließen (Fläche bleibt auf Karte)"
                            className="text-stone-400 hover:text-emerald-500 transition-colors"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button 
                            onClick={() => releaseArea(req.id)}
                            title="Anfrage aus Liste entfernen (Fläche bleibt auf Karte)"
                            className="text-stone-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-stone-700 text-sm mb-4 leading-relaxed italic">
                      "{req.message}"
                    </p>

                    <div className="space-y-3 pt-4 border-t border-stone-200">
                      <div className="flex items-center gap-3 text-stone-600 text-xs font-medium">
                        <User size={14} className="text-stone-400" />
                        {req.contact_name}
                      </div>
                      {role === 'searcher' && (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-amber-600 text-xs font-bold">
                              <Phone size={14} />
                              {req.contact_phone}
                            </div>
                            <a 
                              href={`tel:${req.contact_phone}`}
                              className="bg-amber-100 text-amber-600 p-1.5 rounded-lg hover:bg-amber-200 transition-colors"
                              title="Anrufen"
                            >
                              <Phone size={12} fill="currentColor" />
                            </a>
                          </div>
                          <button 
                            onClick={() => setCompletionRequest(req)}
                            className="w-full mt-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
                          >
                            <CheckCircle size={14} />
                            Fläche freigeben
                          </button>
                        </>
                      )}
                      {req.notes && (
                        <div className="mt-3 p-3 bg-white/40 rounded-xl border border-stone-200/50">
                          <p className="text-[10px] font-bold text-stone-400 uppercase mb-1 flex items-center gap-1">
                            <MessageSquare size={10} /> Notizen vom Helfer
                          </p>
                          <p className="text-xs text-stone-600 leading-relaxed">
                            {req.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {role === 'farmer' && (
            <div className="p-6 bg-stone-50 border-t border-stone-200">
              {isDrawing ? (
                <button 
                  onClick={() => setIsDrawing(false)}
                  className="w-full bg-red-100 hover:bg-red-200 text-red-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <X size={20} />
                  Markieren abbrechen
                </button>
              ) : (
                <button 
                  onClick={() => setIsDrawing(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 transition-all active:scale-95"
                >
                  <Plus size={20} />
                  Fläche markieren
                </button>
              )}
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className={`flex-1 relative ${isDrawing ? 'drawing-mode' : ''}`}>
          <MapContainer 
            center={[51.1657, 10.4515]} 
            zoom={6} 
            className="w-full h-full"
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Standard">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satellit">
                <TileLayer
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>
            </LayersControl>
            <MapEvents onLocationFound={setUserLocation} />
            <LocateButton onLocationFound={setUserLocation} />
            
            <FeatureGroup ref={featureGroupRef}>
              {isDrawing && role === 'farmer' && (
                <EditControl
                  position='topright'
                  onCreated={handleCreated}
                  onDrawStop={() => setIsDrawing(false)}
                  draw={{
                    rectangle: false,
                    circle: false,
                    polyline: false,
                    circlemarker: false,
                    marker: false,
                    polygon: {
                      allowIntersection: false,
                      drawError: {
                        color: '#e1e1e1',
                        message: '<strong>Fehler:</strong> Flächen dürfen sich nicht überschneiden!'
                      },
                      shapeOptions: {
                        color: '#059669',
                        fillOpacity: 0.4
                      }
                    }
                  }}
                />
              )}
            </FeatureGroup>

            {requests.map(req => (
              <Polygon 
                key={req.id} 
                positions={req.area} 
                pathOptions={{ 
                  color: req.status === 'searched' ? '#475569' : (role === 'farmer' ? '#059669' : '#d97706'), 
                  fillColor: req.status === 'searched' ? '#94a3b8' : (role === 'farmer' ? '#10b981' : '#f59e0b'), 
                  fillOpacity: req.status === 'searched' ? 0.2 : 0.4,
                  weight: req.status === 'searched' ? 1 : 3,
                  dashArray: req.status === 'searched' ? '5, 5' : undefined,
                  className: req.status === 'active' ? 'active-polygon' : ''
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    {(req.area_ha != null) && (
                      <div className="mb-2 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                        Fläche: {Number(req.area_ha).toFixed(2)} Hektar
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      {req.status === 'searched' ? (
                        <div className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                          <CheckCircle size={10} /> Abgesucht
                        </div>
                      ) : (
                        <div className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                          <AlertCircle size={10} /> Aktiv
                        </div>
                      )}
                    </div>
                    <h4 className="font-bold text-stone-900 mb-1">{req.contact_name}</h4>
                    <p className="text-xs text-stone-500 mb-3">{req.message}</p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-stone-50 p-2 rounded-lg border border-stone-100">
                        <div className="flex items-center gap-2 text-stone-600 text-[10px] font-bold">
                          <Phone size={10} /> {req.contact_phone}
                        </div>
                        <a 
                          href={`tel:${req.contact_phone}`}
                          className="bg-amber-100 text-amber-600 p-1 rounded-md hover:bg-amber-200 transition-colors"
                        >
                          <Phone size={10} fill="currentColor" />
                        </a>
                      </div>

                      {req.notes && (
                        <div className="p-2 bg-stone-50 rounded-lg border border-stone-100">
                          <p className="text-[8px] font-bold text-stone-400 uppercase mb-1">Notizen:</p>
                          <p className="text-[10px] text-stone-600 italic leading-tight">"{req.notes}"</p>
                        </div>
                      )}

                      {req.status === 'active' && role === 'searcher' && (
                        <button 
                          onClick={() => setCompletionRequest(req)}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold py-2 rounded transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={12} /> Fläche freigeben
                        </button>
                      )}
                      
                      {req.status === 'searched' && role === 'farmer' && (
                        <button 
                          onClick={() => startReactivation(req)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-2 rounded transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={12} /> Wieder anmelden
                        </button>
                      )}

                      <button 
                        onClick={() => setRequestToDelete(req.id)}
                        className="w-full bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-600 text-[10px] font-bold py-2 rounded transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 size={12} /> Markierung löschen
                      </button>
                    </div>
                  </div>
                </Popup>
              </Polygon>
            ))}
          </MapContainer>

          {/* Instructions Overlay */}
          {isDrawing && role === 'farmer' && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] bg-white px-6 py-3 rounded-full shadow-2xl border border-emerald-100 flex items-center gap-3 animate-bounce">
              <Info className="text-emerald-600" size={20} />
              <span className="text-sm font-bold text-stone-800">Klicke auf die Karte, um die Ecken der Fläche zu markieren</span>
              <button 
                onClick={() => setIsDrawing(false)}
                className="ml-2 p-1 hover:bg-stone-100 rounded-full text-stone-400"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Form Modal (Farmer only) */}
        <AnimatePresence>
          {showForm && role === 'farmer' && (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
                onClick={handleCancelForm}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="bg-emerald-600 p-8 text-white">
                  <div className="flex justify-between items-start mb-4">
                    <CheckCircle2 size={32} />
                    <button onClick={handleCancelForm} className="hover:bg-white/20 p-1 rounded-full">
                      <X size={24} />
                    </button>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Fläche markiert!</h3>
                  <div className="flex items-center gap-4">
                    <p className="text-emerald-50 opacity-90">Gib die Details für die Suchanfrage ein.</p>
                    {formData.area_ha != null && (
                      <div className="bg-white/20 px-3 py-1 rounded-lg text-sm font-black">
                        {Number(formData.area_ha).toFixed(2)} ha
                      </div>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                      <Calendar size={12} />
                      Wann soll gesucht werden?
                    </label>
                    <input
                      required
                      type="date"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      value={formData.search_date}
                      onChange={e => setFormData({...formData, search_date: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                      <MessageSquare size={12} />
                      Nachricht / Details
                    </label>
                    <textarea
                      required
                      placeholder="z.B. Hohes Gras, bitte vorsichtig sein..."
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 h-24 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                      value={formData.message}
                      onChange={e => setFormData({...formData, message: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <User size={12} />
                        Dein Name
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="Max Mustermann"
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                        value={formData.contact_name}
                        onChange={e => setFormData({...formData, contact_name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <Phone size={12} />
                        Telefonnummer
                      </label>
                      <input
                        required
                        type="tel"
                        placeholder="0123 456789"
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                        value={formData.contact_phone}
                        onChange={e => setFormData({...formData, contact_phone: e.target.value})}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-95"
                  >
                    Anfrage absenden
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
