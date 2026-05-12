import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Car, 
  History, 
  Heart, 
  Settings, 
  Plus, 
  ChevronRight, 
  Fuel, 
  Droplets, 
  Wrench, 
  Disc, 
  Battery, 
  LogOut,
  User as UserIcon,
  ChevronLeft,
  Share2,
  AlertCircle,
  Settings as SettingsIcon
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, getDocs } from 'firebase/firestore';
import { cn, formatMileage, calculateOilLife } from './lib/utils';
import { ServiceType, Vehicle, TimelineEvent } from './types';
import { scanOdometer } from './lib/gemini';
import { InstallPrompt } from './InstallPrompt';
import { useI18n, LanguageToggle } from './i18n';
import { VehicleSettings } from './VehicleSettings';

function getBatteryAlert(vehicle: Vehicle): { state: 'soon' | 'overdue'; months: number } | null {
  if (!vehicle.lastBatteryChangeDate || !vehicle.batteryIntervalMonths) return null;
  const last = new Date(vehicle.lastBatteryChangeDate);
  if (Number.isNaN(last.getTime())) return null;
  const due = new Date(last);
  due.setMonth(due.getMonth() + vehicle.batteryIntervalMonths);
  const diffMs = due.getTime() - Date.now();
  const monthsLeft = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  if (monthsLeft < 0) return { state: 'overdue', months: Math.abs(monthsLeft) };
  if (monthsLeft <= 2) return { state: 'soon', months: Math.max(0, monthsLeft) };
  return null;
}

import { generateVehicleReport } from './lib/reports';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const HealthIndicator = ({ score }: { score: number }) => {
  const data = [
    { value: score },
    { value: 100 - score }
  ];
  const COLORS = ['#3B82F6', 'rgba(0,0,0,0.05)'];

  return (
    <div className="relative w-32 h-32 mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={45}
            outerRadius={60}
            paddingAngle={0}
            dataKey="value"
            startAngle={90}
            endAngle={450}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tracking-tighter">{score}</span>
        <HealthLabel />
      </div>
    </div>
  );
};


const HealthLabel = () => {
  const { t } = useI18n();
  return (
    <span className="text-[8px] text-black/40 uppercase tracking-[0.2em] font-bold">
      {t('common.health_score')}
    </span>
  );
};

const Navbar = ({ activePage, setActivePage, user }: any) => {
  const { t } = useI18n();
  const tabs = [
    { id: 'dashboard', icon: Car, label: t('nav.vehicles') },
    { id: 'camera', icon: Camera, label: t('nav.camera') },
    { id: 'timeline', icon: History, label: t('nav.timeline') },
    { id: 'profile', icon: UserIcon, label: t('nav.profile') },
  ];

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] w-full px-4 sm:max-w-fit">
      <nav className="pill-nav flex items-center justify-around sm:justify-start gap-1 py-1.5 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePage === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActivePage(tab.id)}
              className={cn(
                "px-3 sm:px-6 py-3 rounded-full text-[11px] font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-2",
                isActive ? "bg-brand text-white shadow-[0_0_20px_rgba(242,100,48,0.5)]" : "text-black/40 hover:text-ink"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {isActive && <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} className="font-arabic">{tab.label}</motion.span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const { t, lang } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('camera');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const dateLocale = lang === 'ar' ? 'ar-SA' : 'en-US';

  const serviceLabel = (type: ServiceType): string => {
    const map: Record<ServiceType, string> = {
      [ServiceType.FUEL]: t('service.fuel'),
      [ServiceType.OIL_CHANGE]: t('service.oil_change'),
      [ServiceType.MAINTENANCE]: t('service.maintenance'),
      [ServiceType.TIRES]: t('service.tires'),
      [ServiceType.BATTERY]: t('service.battery'),
      [ServiceType.OTHER]: t('service.other'),
    };
    return map[type] ?? type;
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      setVehicles([]);
      setEvents([]);
      return;
    }

    const vQuery = query(collection(db, 'vehicles'), where('userId', '==', user.uid));
    const unsubV = onSnapshot(vQuery, (snap) => {
      const vList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
      setVehicles(vList);
      if (vList.length > 0 && !selectedVehicle) {
        setSelectedVehicle(vList[0]);
      }
    });

    const eQuery = query(collection(db, 'events'), where('userId', '==', user.uid));
    const unsubE = onSnapshot(eQuery, (snap) => {
      const eList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimelineEvent));
      setEvents(eList.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });

    return () => {
      unsubV();
      unsubE();
    };
  }, [user]);

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success(t('profile.welcome'));
    } catch (err) {
      console.error(err);
      toast.error(t('profile.sign_in_failed'));
    }
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast.error(t('profile.sign_in_first'));
      setActivePage('profile');
      return;
    }

    setScanning(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const result = await scanOdometer(base64);
        toast.success(t('camera.detected', { value: formatMileage(result.mileage) }));

        // Find existing vehicle or create new
        let vehicleId = selectedVehicle?.id;

        if (!vehicleId) {
          // If no vehicles, create one silently
          const newV = await addDoc(collection(db, 'vehicles'), {
            userId: user.uid,
            name: result.make ? `${result.make} ${result.model || ''}`.trim() : (lang === 'ar' ? 'مركبتي الجديدة' : 'My new vehicle'),
            make: result.make || '',
            model: result.model || '',
            currentMileage: result.mileage,
            healthScore: 100,
            oilIntervalKm: 10000,
            lastOilChangeMileage: result.mileage,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          vehicleId = newV.id;
        } else {
          // Update current vehicle mileage
          await updateDoc(doc(db, 'vehicles', vehicleId), {
            currentMileage: result.mileage,
            updatedAt: serverTimestamp()
          });
        }
        
        // Auto show service selection
        setActivePage('service-select');
        setTempEventData({ mileage: result.mileage, vehicleId: vehicleId as string });
        
      } catch (err) {
        console.error(err);
        toast.error(t('camera.failed'));
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const [tempEventData, setTempEventData] = useState<{ mileage: number, vehicleId: string } | null>(null);

  const saveEvent = async (type: ServiceType) => {
    if (!tempEventData || !user) return;
    
    let location = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      location = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
    } catch (e) {
      console.warn("Could not get location", e);
    }
    
    try {
      await addDoc(collection(db, 'events'), {
        userId: user.uid,
        vehicleId: tempEventData.vehicleId,
        type,
        mileage: tempEventData.mileage,
        date: new Date().toISOString(),
        location,
        createdAt: serverTimestamp()
      });
      
      if (type === ServiceType.OIL_CHANGE) {
        await updateDoc(doc(db, 'vehicles', tempEventData.vehicleId), {
          lastOilChangeMileage: tempEventData.mileage,
          updatedAt: serverTimestamp()
        });
      }
      
      toast.success(t('service.saved'));
      setActivePage('dashboard');
      setTempEventData(null);
    } catch (err) {
      console.error(err);
      toast.error(t('service.save_failed'));
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-bg-dark text-ink selection:bg-brand/30 overflow-x-hidden pb-32">
      <Toaster position="top-center" />
      <InstallPrompt />

      {/* Pages */}
      <main className="max-w-md mx-auto px-6 pt-12">
        <AnimatePresence mode="wait">
          {activePage === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src="/motr2.svg"
                    alt="MOTR"
                    className="h-12 w-auto drop-shadow-md"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {vehicles.length > 1 && (
                    <select
                      value={selectedVehicle?.id}
                      onChange={(e) => setSelectedVehicle(vehicles.find(v => v.id === e.target.value) || null)}
                      className="bg-black/5 border border-black/10 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-wider outline-none max-w-[120px]"
                    >
                      {vehicles.map(v => <option key={v.id} value={v.id} className="bg-bg-dark">{v.name}</option>)}
                    </select>
                  )}
                  <LanguageToggle />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 glass-dark rounded-full flex items-center justify-center hover:bg-black/10 transition-colors shadow-lg"
                    aria-label={t('dashboard.update_odometer')}
                  >
                    <Plus className="w-5 h-5 text-brand" />
                  </button>
                  {user?.photoURL && <img src={user.photoURL} className="w-8 h-8 rounded-full border border-black/10" />}
                </div>
              </div>

              {vehicles.length === 0 ? (
                <div className="glass-dark p-8 rounded-[32px] text-center space-y-4">
                  <div className="w-16 h-16 bg-black/5 rounded-2xl flex items-center justify-center mx-auto">
                    <Camera className="w-8 h-8 text-black/20" />
                  </div>
                  <p className="text-black/40">{t('dashboard.empty_hint')}</p>
                  <button
                    onClick={() => setActivePage('camera')}
                    className="bg-brand text-white px-6 py-4 rounded-2xl font-bold w-full uppercase tracking-widest text-xs"
                  >
                    {t('dashboard.first_scan')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedVehicle && (
                    <div className="space-y-4">
                      <div className="glass rounded-[40px] p-8 space-y-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-brand/10 blur-[80px]" />
                        
                        <div className="flex justify-between items-start relative z-10">
                          <div>
                            <h3 className="text-2xl font-bold mb-1 tracking-tight">{selectedVehicle.name}</h3>
                            <p className="text-[10px] uppercase tracking-widest text-black/40">{selectedVehicle.make} {selectedVehicle.model} • {selectedVehicle.year}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowSettings(true)}
                              className="bg-black/5 border border-black/10 p-2.5 rounded-full hover:bg-black/10 transition-colors"
                              aria-label={t('common.settings')}
                            >
                              <SettingsIcon className="w-5 h-5 text-ink" />
                            </button>
                            <button
                              onClick={() => generateVehicleReport(selectedVehicle, events.filter(e => e.vehicleId === selectedVehicle.id))}
                              className="bg-black/5 border border-black/10 p-2.5 rounded-full hover:bg-black/10 transition-colors"
                            >
                              <Share2 className="w-5 h-5 text-brand" />
                            </button>
                          </div>
                        </div>

                        <HealthIndicator 
                          score={calculateOilLife(
                            selectedVehicle.currentMileage, 
                            selectedVehicle.lastOilChangeMileage || 0, 
                            selectedVehicle.oilIntervalKm
                          )} 
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-black/5 p-5 rounded-[32px] border border-black/10">
                            <p className="text-[10px] uppercase tracking-widest text-black/40 mb-2">{t('common.mileage')}</p>
                            <p className="text-xl font-bold">{formatMileage(selectedVehicle.currentMileage)}</p>
                          </div>
                          <div className="bg-black/5 p-5 rounded-[32px] border border-black/10">
                            <p className="text-[10px] uppercase tracking-widest text-black/40 mb-2">{t('common.confidence')}</p>
                            <p className="text-xl font-bold text-success">98%</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex justify-between items-center text-xs uppercase tracking-widest">
                            <span className="text-black/40 font-bold">{t('common.oil_life')}</span>
                            <span className="font-bold text-brand">
                              {Math.max(0, (selectedVehicle.lastOilChangeMileage || 0) + selectedVehicle.oilIntervalKm - selectedVehicle.currentMileage)} {t('common.km_left')}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${calculateOilLife(selectedVehicle.currentMileage, selectedVehicle.lastOilChangeMileage || 0, selectedVehicle.oilIntervalKm)}%` }}
                              className="h-full bg-brand"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Smart Insights */}
                      {events.filter(e => e.vehicleId === selectedVehicle.id).length >= 5 && (selectedVehicle.name.includes('مركبتي الجديدة') || selectedVehicle.name.toLowerCase().includes('my new vehicle')) && (
                        <div className="glass-dark p-6 rounded-[32px] border-l-4 border-l-brand">
                          <div className="flex gap-4">
                            <Car className="w-6 h-6 text-brand shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-bold">{t('dashboard.name_your_car')}</p>
                              <p className="text-xs text-black/40 mb-3">{t('dashboard.name_hint', { count: events.length })}</p>
                              <div className="flex gap-2">
                                <input
                                  id="vehicle-name-input"
                                  className="bg-black/5 border border-black/10 rounded-xl px-3 py-2 text-xs flex-1 outline-none focus:border-brand"
                                  placeholder={t('dashboard.name_placeholder')}
                                />
                                <button
                                  onClick={async () => {
                                    const input = document.getElementById('vehicle-name-input') as HTMLInputElement;
                                    if (input.value) {
                                      await updateDoc(doc(db, 'vehicles', selectedVehicle.id), { name: input.value });
                                      toast.success(t('dashboard.name_updated'));
                                    }
                                  }}
                                  className="bg-brand px-4 py-2 rounded-xl text-xs font-bold text-white"
                                >
                                  {t('common.save')}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {(() => {
                        const alert = getBatteryAlert(selectedVehicle);
                        if (!alert) return null;
                        const message = alert.state === 'overdue'
                          ? t('dashboard.battery_overdue', { months: alert.months })
                          : alert.months === 0
                            ? t('dashboard.battery_due_now')
                            : t('dashboard.battery_due_soon', { months: alert.months });
                        return (
                          <div className="glass-dark p-6 rounded-[32px] border-l-4 border-l-warning">
                            <div className="flex gap-3">
                              <AlertCircle className="w-5 h-5 text-warning shrink-0" />
                              <div>
                                <p className="text-sm font-bold">{t('dashboard.smart_alert')}</p>
                                <p className="text-xs text-black/40">{message}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Recent Activity */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xl font-bold">{t('dashboard.recent_activity')}</h4>
                          <button onClick={() => setActivePage('timeline')} className="text-brand text-sm font-medium">{t('common.show_all')}</button>
                        </div>
                        <div className="space-y-3">
                          {events.filter(e => e.vehicleId === selectedVehicle.id).slice(0, 3).map((event) => (
                            <div key={event.id} className="glass-dark p-4 rounded-2xl flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center">
                                  {event.type === ServiceType.FUEL ? <Fuel className="w-5 h-5 text-brand" /> : <Droplets className="w-5 h-5 text-success" />}
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{serviceLabel(event.type)}</p>
                                  <p className="text-[10px] text-black/40">{new Date(event.date).toLocaleDateString(dateLocale)}</p>
                                </div>
                              </div>
                              <p className="font-bold text-xs">{formatMileage(event.mileage)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="glass-dark p-6 rounded-[32px] flex flex-col items-center gap-3 transition-transform active:scale-95"
                    >
                      <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center">
                        <Camera className="w-6 h-6 text-brand" />
                      </div>
                      <span className="text-sm font-medium">{t('dashboard.update_odometer')}</span>
                    </button>
                    <button
                      onClick={() => setActivePage('timeline')}
                      className="glass-dark p-6 rounded-[32px] flex flex-col items-center gap-3 transition-transform active:scale-95"
                    >
                      <div className="w-12 h-12 bg-success/10 rounded-2xl flex items-center justify-center">
                        <History className="w-6 h-6 text-success" />
                      </div>
                      <span className="text-sm font-medium">{t('dashboard.activity_log')}</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activePage === 'camera' && (
            <motion.div 
              key="camera"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center pt-20 text-center space-y-8"
            >
              <div className="w-48 h-48 rounded-full border-4 border-brand/20 flex items-center justify-center relative">
                <motion.div 
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-40 h-40 rounded-full bg-brand/5 border border-brand/30 flex items-center justify-center"
                >
                  <Camera className="w-16 h-16 text-brand" />
                </motion.div>
                {scanning && (
                  <motion.div 
                    className="absolute inset-0 border-4 border-brand rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                )}
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 whitespace-nowrap">
                  <span className="text-[10px] uppercase font-bold text-brand opacity-80 animate-pulse">{t('common.ocr_active')}</span>
                  <span className="w-1.5 h-1.5 bg-brand rounded-full"></span>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-2">{t('camera.title')}</h2>
                <p className="text-black/40 max-w-[240px]">{t('camera.subtitle')}</p>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                className="bg-brand text-white px-12 py-4 rounded-3xl font-bold shadow-2xl shadow-brand/20 disabled:opacity-50"
              >
                {scanning ? t('camera.scanning') : t('camera.open')}
              </button>
            </motion.div>
          )}

          {activePage === 'timeline' && (
            <motion.div 
              key="timeline"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">{t('timeline.title')}</h2>
                <button className="p-2 glass-dark rounded-full"><Share2 className="w-5 h-5 text-black/60" /></button>
              </div>

              <div className="space-y-4">
                {events.length === 0 ? (
                  <div className="py-20 text-center text-black/20">{t('timeline.empty')}</div>
                ) : (
                  events.map((event, i) => (
                    <div key={event.id} className="relative ps-8 pb-8 last:pb-0">
                      {i !== events.length - 1 && <div className="absolute start-4 top-8 bottom-0 w-[1px] bg-black/10" />}
                      <div className={cn(
                        "absolute start-2 top-2 w-4 h-4 rounded-full border-2 border-bg-dark",
                        event.type === ServiceType.FUEL ? "bg-brand" : "bg-success"
                      )} />
                      <div className="glass-dark p-6 rounded-[28px] space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                             {event.type === ServiceType.FUEL ? <Fuel className="w-4 h-4 text-brand" /> : <Droplets className="w-4 h-4 text-success" />}
                             <span className="font-bold">{serviceLabel(event.type)}</span>
                          </div>
                          <span className="text-xs text-black/40">{new Date(event.date).toLocaleDateString(dateLocale)}</span>
                        </div>
                        <div className="flex justify-between">
                          <p className="text-lg font-bold">{formatMileage(event.mileage)}</p>
                          <p className="text-black/40 text-sm">{event.notes || ''}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activePage === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="text-center pt-10">
                <div className="w-24 h-24 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-black/10">
                  {user?.photoURL ? <img src={user.photoURL} className="rounded-full" /> : <UserIcon className="w-12 h-12 text-black/20" />}
                </div>
                <h2 className="text-2xl font-bold">{user?.displayName || t('profile.guest')}</h2>
                <p className="text-black/40">{user?.email || t('profile.sign_in_hint')}</p>
              </div>

              <div className="flex justify-center">
                <LanguageToggle />
              </div>

              <div className="space-y-4">
                {!user ? (
                  <button
                    onClick={handleSignIn}
                    className="w-full glass p-6 rounded-3xl flex items-center gap-4 hover:bg-black/10 transition-all font-bold text-lg"
                  >
                    <div className="w-10 h-10 bg-brand rounded-full flex items-center justify-center">
                      <Plus className="w-6 h-6 text-white" />
                    </div>
                    <span>{t('profile.sign_in_google')}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => signOut(auth)}
                    className="w-full glass-dark p-6 rounded-3xl flex items-center gap-4 text-danger font-bold"
                  >
                    <LogOut className="w-6 h-6" />
                    <span>{t('profile.sign_out')}</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {activePage === 'service-select' && (
            <motion.div 
              key="service-select"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 pt-6"
            >
              <div>
                <h2 className="text-3xl font-bold mb-2">{t('service.title')}</h2>
                <p className="text-black/40">{t('service.saw_odometer', { value: formatMileage(tempEventData?.mileage || 0) })}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { type: ServiceType.FUEL, icon: Fuel, color: 'text-brand', bg: 'bg-brand/10' },
                  { type: ServiceType.OIL_CHANGE, icon: Droplets, color: 'text-success', bg: 'bg-success/10' },
                  { type: ServiceType.MAINTENANCE, icon: Wrench, color: 'text-warning', bg: 'bg-warning/10' },
                  { type: ServiceType.TIRES, icon: Disc, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                  { type: ServiceType.BATTERY, icon: Battery, color: 'text-danger', bg: 'bg-danger/10' },
                  { type: ServiceType.OTHER, icon: Plus, color: 'text-black/60', bg: 'bg-black/5' },
                ].map((s) => (
                  <button
                    key={s.type}
                    onClick={() => saveEvent(s.type)}
                    className="glass-dark p-6 rounded-[32px] flex flex-col items-center gap-3 transition-all active:scale-95 group hover:border-brand/40"
                  >
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", s.bg)}>
                      <s.icon className={cn("w-7 h-7", s.color)} />
                    </div>
                    <span className="text-sm font-bold">{serviceLabel(s.type)}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setActivePage('dashboard')}
                className="w-full text-black/40 font-medium py-4"
              >
                {t('service.skip')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Hidden File Input for Capture */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleCapture}
      />

      <Navbar activePage={activePage} setActivePage={setActivePage} user={user} />

      <AnimatePresence>
        {showSettings && selectedVehicle && (
          <VehicleSettings vehicle={selectedVehicle} onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
