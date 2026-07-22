import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid,
} from 'recharts';
import {
  Users, Car, TrendingUp, Award, Trophy, ArrowRight, Zap, RefreshCw,
  Star, DollarSign, Fuel, Activity, Tag, Filter, X,
} from 'lucide-react';
import API from '../api/axios';

/* ============================================================
   CarInsight Pro — Dashboard (Round 1 redesign)
   Bigger layout · hover lift · fade/slide animations · new charts
   ============================================================ */

// Read theme colors from CSS variables; re-read when theme changes.
function useThemeColors() {
  const read = () => {
    const s = getComputedStyle(document.body);
    const v = (name, fallback) => (s.getPropertyValue(name).trim() || fallback);
    return {
      grid:       v('--chart-grid', '#1a1f2b'),
      axis:       v('--chart-axis', '#4d5668'),
      text:       v('--text', '#e8eaf0'),
      text2:      v('--text2', '#8892a4'),
      text3:      v('--text3', '#4d5668'),
      card:       v('--bg3', '#131720'),
      border2:    v('--border2', 'var(--border2)'),
      gold:       v('--gold', '#f0a500'),
      goldBright: v('--gold-bright', '#fbbf24'),
      tipBg:      v('--chart-tooltip-bg', '#131720'),
      tipBorder:  v('--chart-tooltip-border', 'var(--border2)'),
      tipText:    v('--chart-tooltip-text', '#e8eaf0'),
    };
  };
  const [c, setC] = useState(read);
  useEffect(() => {
    const onChange = () => setC(read());
    window.addEventListener('themechange', onChange);
    return () => window.removeEventListener('themechange', onChange);
  }, []);
  return c;
}

const COLORS = ['#f0a500','#3b82f6','#22c55e','#ef4444','#14b8a6','#a855f7','#f97316','#06b6d4','#eab308','#ec4899'];

const fmt = v => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${(n/1000).toFixed(0)}K`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:8, padding:'10px 14px', fontSize:12, boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>
        <p style={{ color:'var(--text2)', marginBottom:4, textTransform:'capitalize' }}>{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color:p.color||'#f0a500', fontWeight:600 }}>
            {p.name}: {typeof p.value === 'number' && p.value > 1000 ? fmt(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const tc = useThemeColors();   // re-renders charts when theme flips
  const [data, setData]       = useState(null);
  const [models, setModels]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(false);
  const name = localStorage.getItem('userName') || 'User';

  // ── filters ──
  const [filterOpts, setFilterOpts] = useState({ brands: [], fuels: [], year_min: 1990, year_max: 2026 });
  const [fBrand, setFBrand] = useState('');
  const [fFuel, setFFuel]   = useState('');
  const [fMinYear, setFMinYear] = useState('');
  const [fMaxYear, setFMaxYear] = useState('');

  const anyFilter = fBrand || fFuel || fMinYear || fMaxYear;

  // Build query string from active filters
  const buildQuery = () => {
    const p = new URLSearchParams();
    if (fMinYear) p.append('min_year', fMinYear);
    if (fMaxYear) p.append('max_year', fMaxYear);
    if (fBrand)   p.append('brand', fBrand);
    if (fFuel)    p.append('fuel', fFuel);
    const qs = p.toString();
    return qs ? `?${qs}` : '';
  };

  // Full load (first time): dashboard + model-comparison + filter options
  const loadAll = () => {
    setLoading(true);
    Promise.all([
      API.get('/dashboard-data'),
      API.get('/model-comparison'),
      API.get('/dashboard-filters').catch(() => ({ data: null })),
    ])
      .then(([d, m, f]) => {
        setData(d.data); setModels(m.data);
        if (f.data) {
          setFilterOpts(f.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Refetch ONLY dashboard-data when filters change (charts update, page stays)
  const loadCharts = () => {
    setChartsLoading(true);
    API.get(`/dashboard-data${buildQuery()}`)
      .then(d => setData(d.data))
      .catch(console.error)
      .finally(() => setChartsLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  // When any filter changes (after first load), refetch charts
  useEffect(() => {
    if (loading) return;            // skip during initial load
    loadCharts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fBrand, fFuel, fMinYear, fMaxYear]);

  const clearFilters = () => { setFBrand(''); setFFuel(''); setFMinYear(''); setFMaxYear(''); };
  const load = loadAll;   // Refresh button reloads everything

  // ── drill-down modal ──
  const [drill, setDrill] = useState(null);          // { brand, ...stats } or null
  const [drillLoading, setDrillLoading] = useState(false);

  const openDrill = (brand) => {
    if (!brand) return;
    setDrill({ brand, models: [], loading: true });
    setDrillLoading(true);
    API.get(`/brand-models/${encodeURIComponent(brand)}`)
      .then(r => setDrill({ ...r.data, loading: false }))
      .catch(() => setDrill({ brand, models: [], loading: false, error: true }))
      .finally(() => setDrillLoading(false));
  };
  const closeDrill = () => setDrill(null);

  // Recharts Bar onClick passes the data payload; pull the brand out of it
  const handleBarClick = (payload) => {
    const b = payload?.brand || payload?.payload?.brand;
    if (b) openDrill(b);
  };

  if (loading) return (
    <div style={wrap}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:400, color:'var(--text2)', gap:12 }}>
        <RefreshCw size={18} style={{ animation:'dspin 1s linear infinite' }} /> Loading dashboard…
      </div>
      <style>{spinKeyframes}</style>
    </div>
  );

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const brandDist  = (data?.brand_distribution || []).slice(0, 15);
  const priceByYr  = data?.price_by_year || [];
  const fuelDist   = data?.fuel_distribution || [];
  const priceByFuel= data?.price_by_fuel || [];
  const avgByBrand = data?.avg_price_by_brand || [];
  const predOverT  = data?.predictions_over_time || [];
  const popBrands  = data?.popular_brands || [];

  return (
    <div style={wrap} key={tc.grid}>
      {/* HEADER */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:30, ...anim(0) }}>
        <div>
          <h1 style={{ fontFamily:'Rajdhani,sans-serif', fontSize:34, fontWeight:700, color:'var(--text)', margin:0, letterSpacing:'-0.01em' }}>
            {greet}, <span style={{ color:'#f0a500' }}>{name.split(' ')[0]}</span> 👋
          </h1>
          <p style={{ color:'var(--text2)', fontSize:14, marginTop:5 }}>
            Your CarInsight Pro analytics overview
          </p>
        </div>
        <button onClick={load} style={ghostBtn}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* STAT CARDS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:18, marginBottom:30 }}>
        {[
          { icon:Car,        val:data?.total_predictions ?? 0,    lbl:'Total Predictions',   col:'#f0a500', d:0 },
          { icon:Users,      val:data?.total_users ?? 0,          lbl:'Registered Users',    col:'#3b82f6', d:1 },
          { icon:TrendingUp, val:data?.avg_predicted_price ? fmt(data.avg_predicted_price) : '—', lbl:'Avg Predicted Price', col:'#22c55e', d:2 },
          { icon:Award,      val:data?.model_r2 ? `${(data.model_r2*100).toFixed(1)}%` : '—', lbl:'Best Model Accuracy', col:'#a855f7', d:3 },
        ].map(({ icon:Icon, val, lbl, col, d }) => (
          <StatCard key={lbl} Icon={Icon} val={val} lbl={lbl} col={col} delay={d} />
        ))}
      </div>

      {/* FILTER BAR */}
      <div style={{ ...chartCardStyle, padding:'16px 20px', marginBottom:24, ...anim(0) }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, color:'#f0a500', fontSize:12.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>
            <Filter size={14} /> Filters
          </div>

          {/* Brand */}
          <select value={fBrand} onChange={e => setFBrand(e.target.value)} style={selectStyle}>
            <option value="">All brands</option>
            {filterOpts.brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          {/* Fuel */}
          <select value={fFuel} onChange={e => setFFuel(e.target.value)} style={selectStyle}>
            <option value="">All fuels</option>
            {filterOpts.fuels.map(f => <option key={f} value={f} style={{ textTransform:'capitalize' }}>{f}</option>)}
          </select>

          {/* Year range */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <select value={fMinYear} onChange={e => setFMinYear(e.target.value)} style={selectStyle}>
              <option value="">From year</option>
              {yearList(filterOpts.year_min, filterOpts.year_max).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span style={{ color:'var(--text3)', fontSize:13 }}>–</span>
            <select value={fMaxYear} onChange={e => setFMaxYear(e.target.value)} style={selectStyle}>
              <option value="">To year</option>
              {yearList(filterOpts.year_min, filterOpts.year_max).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Status / clear */}
          {chartsLoading && (
            <span style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text2)', fontSize:12 }}>
              <RefreshCw size={12} style={{ animation:'dspin 1s linear infinite' }} /> Updating…
            </span>
          )}
          {anyFilter && !chartsLoading && (
            <button onClick={clearFilters} style={{ ...ghostBtn, padding:'7px 13px', fontSize:12, color:'#ef4444', borderColor:'#ef444440' }}>
              <X size={13} /> Clear filters
            </button>
          )}
          <span style={{ marginLeft:'auto', fontSize:12, color:'var(--text3)' }}>
            Showing <strong style={{ color:'var(--text2)' }}>{(data?.dataset_size ?? 0).toLocaleString('en-IN')}</strong> cars
            {anyFilter ? ' (filtered)' : ''}
          </span>
        </div>
        {anyFilter && (
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:8 }}>
            Filters affect the dataset charts only. Your app-activity charts always show all activity.
          </div>
        )}
      </div>

      {/* QUICK ACTIONS */}
      <SectionLabel>Quick Actions</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))', gap:14, marginBottom:34 }}>
        <QuickCard icon={Zap}        title="Predict Price"   desc="ML-powered price estimation" to="/predict"   color="#f0a500" />
        <QuickCard icon={RefreshCw}  title="Resale Value"    desc="Hybrid 12-factor valuation"  to="/resale"    color="#3b82f6" />
        <QuickCard icon={Star}       title="Recommendations" desc="Find your top 3 cars"         to="/recommend" color="#22c55e" />
        <QuickCard icon={DollarSign} title="Finance Advisor" desc="EMI vs cash comparison"       to="/finance"   color="#a855f7" />
      </div>

      {/* ROW 1: Price by Year (area) + Model Comparison */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(420px,1fr))', gap:18, marginBottom:18 }}>
        <ChartCard title="Median Price by Manufacturing Year" subtitle="Newer cars hold higher resale value" icon={TrendingUp} delay={0}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={priceByYr} margin={{ top:10, right:10, left:-8, bottom:0 }}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f0a500" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#f0a500" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="year" tick={{ fill:'var(--chart-axis)', fontSize:10 }} />
              <YAxis tickFormatter={fmt} tick={{ fill:'var(--chart-axis)', fontSize:10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="median_price" name="Median Price" stroke="#f0a500" strokeWidth={2.5}
                fill="url(#goldGrad)" dot={{ fill:'#f0a500', r:3, strokeWidth:0 }}
                animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Model Comparison" subtitle="5 ML models trained & compared" icon={Trophy} delay={1}>
          <div style={{ paddingTop:4 }}>
            {(models?.models || []).map((m) => (
              <div key={m.model_name} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontSize:12.5, color:m.is_best ? 'var(--gold)':'var(--text2)', fontWeight:m.is_best?600:400, display:'flex', alignItems:'center', gap:6 }}>
                    {m.is_best && <Trophy size={12} style={{ color:'#f0a500' }} />}
                    {m.model_name}
                  </span>
                  <span style={{ fontSize:12.5, fontWeight:700, color:m.is_best ? 'var(--gold)':'var(--text)' }}>
                    {(m.r2_score*100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ height:7, background:'var(--bg4)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:4, width:`${m.r2_score*100}%`,
                    background:m.is_best ? 'linear-gradient(90deg,#f0a500,#fbbf24)':'var(--border2)',
                    transition:'width 1.1s cubic-bezier(0.22,1,0.36,1)' }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop:14, padding:'11px 14px', background:'rgba(240,165,0,0.06)', border:'1px solid rgba(240,165,0,0.14)', borderRadius:9 }}>
              <p style={{ fontSize:11.5, color:'var(--text2)', lineHeight:1.6, margin:0 }}>
                <span style={{ color:'#f0a500', fontWeight:600 }}>Best: </span>
                {models?.best_model} — explains {((models?.models?.find(m=>m.is_best)?.r2_score||0)*100).toFixed(1)}% of price variance
              </p>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ROW 2: Brands (bar) + Fuel mix (pie) */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:18, marginBottom:18 }}>
        <ChartCard title="Top 15 Brands in Dataset" subtitle="By number of listings · click a bar to explore" icon={Tag} delay={2}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={brandDist} margin={{ top:6, right:6, left:-10, bottom:42 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="brand" tick={{ fill:'var(--chart-axis)', fontSize:9 }} angle={-45} textAnchor="end" interval={0} height={62} />
              <YAxis tick={{ fill:'var(--chart-axis)', fontSize:10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Cars" radius={[5,5,0,0]} animationDuration={900}
                onClick={handleBarClick} cursor="pointer">
                {brandDist.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} fillOpacity={0.88} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Fuel Type Distribution" subtitle="Petrol & diesel dominate" icon={Fuel} delay={3}>
          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <ResponsiveContainer width={170} height={200}>
              <PieChart>
                <Pie data={fuelDist} dataKey="count" nameKey="fuel" cx="50%" cy="50%" innerRadius={42} outerRadius={74} paddingAngle={3} animationDuration={900}>
                  {fuelDist.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex:1, minWidth:120 }}>
              {fuelDist.map((f,i) => (
                <div key={f.fuel} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:9 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:10, height:10, borderRadius:3, background:COLORS[i%COLORS.length] }} />
                    <span style={{ fontSize:12.5, color:'var(--text2)', textTransform:'capitalize' }}>{f.fuel}</span>
                  </div>
                  <span style={{ fontSize:12.5, fontWeight:600, color:'var(--text)' }}>{f.count}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ROW 3: NEW — Median price by fuel + Avg price by brand */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr', gap:18, marginBottom:18 }}>
        <ChartCard title="Median Price by Fuel" subtitle="Which fuel types cost more" icon={Fuel} delay={0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={priceByFuel} layout="vertical" margin={{ top:6, right:16, left:10, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" tickFormatter={fmt} tick={{ fill:'var(--chart-axis)', fontSize:10 }} />
              <YAxis type="category" dataKey="fuel" tick={{ fill:'#8892a4', fontSize:11, textTransform:'capitalize' }} width={62} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="median_price" name="Median Price" radius={[0,5,5,0]} animationDuration={900}>
                {priceByFuel.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} fillOpacity={0.88} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Median Price by Brand" subtitle="Top 12 brands · click a bar to explore" icon={Tag} delay={1}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={avgByBrand} margin={{ top:6, right:6, left:-4, bottom:42 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="brand" tick={{ fill:'var(--chart-axis)', fontSize:9 }} angle={-45} textAnchor="end" interval={0} height={62} />
              <YAxis tickFormatter={fmt} tick={{ fill:'var(--chart-axis)', fontSize:10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="median_price" name="Median Price" radius={[5,5,0,0]} animationDuration={900}
                onClick={handleBarClick} cursor="pointer">
                {avgByBrand.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} fillOpacity={0.88} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ROW 4: USER ACTIVITY section */}
      <SectionLabel>Your App Activity</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:18, marginBottom:30 }}>
        <ChartCard title="Predictions Over Time" subtitle="Daily prediction activity by users" icon={Activity} delay={0}>
          {predOverT.length === 0 ? (
            <EmptyChart msg="No predictions yet — they'll appear here as users make them." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={predOverT} margin={{ top:10, right:12, left:-8, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill:'var(--chart-axis)', fontSize:9 }} />
                <YAxis allowDecimals={false} tick={{ fill:'var(--chart-axis)', fontSize:10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="count" name="Predictions" stroke="#22c55e" strokeWidth={2.5}
                  dot={{ fill:'#22c55e', r:3 }} animationDuration={900} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Most-Predicted Brands" subtitle="What users search most" icon={Star} delay={1}>
          {popBrands.length === 0 ? (
            <EmptyChart msg="No data yet." />
          ) : (
            <div style={{ paddingTop:4 }}>
              {popBrands.map((b,i) => {
                const max = popBrands[0]?.count || 1;
                return (
                  <div key={b.brand} style={{ marginBottom:11 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12.5, color:'var(--text2)', textTransform:'capitalize' }}>{b.brand}</span>
                      <span style={{ fontSize:12.5, fontWeight:700, color:'var(--text)' }}>{b.count}</span>
                    </div>
                    <div style={{ height:6, background:'var(--bg4)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:3, width:`${(b.count/max)*100}%`,
                        background:COLORS[i%COLORS.length], transition:'width 1s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* BOTTOM INFO CARDS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:18 }}>
        {[
          { title:'Dataset Size',  val:(data?.dataset_size ?? 0).toLocaleString('en-IN'), sub:'rows used by ML model',       col:'#3b82f6' },
          { title:'Unique Brands', val:data?.brands_count ?? 0,                           sub:'across Indian market',        col:'#22c55e' },
          { title:'Car Models',    val:data?.models_count ?? 0,                           sub:'unique brand + model combos', col:'#a855f7' },
        ].map(({ title, val, sub, col }) => (
          <div key={title} style={{ ...chartCardStyle, textAlign:'center', padding:'24px 20px' }}>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:34, fontWeight:700, color:col, lineHeight:1 }}>{val}</div>
            <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text)', marginTop:6 }}>{title}</div>
            <div style={{ fontSize:11.5, color:'var(--text3)', marginTop:3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* DRILL-DOWN MODAL */}
      {drill && (
        <BrandDrillModal drill={drill} onClose={closeDrill} />
      )}

      <style>{spinKeyframes + animKeyframes}</style>
    </div>
  );
}

/* ── Brand drill-down modal ── */
function BrandDrillModal({ drill, onClose }) {
  const models = drill.models || [];
  // chart wants smaller set; table can show all
  const chartData = models.slice(0, 10).map(m => ({
    name: (m.brand_model || '').replace(drill.brand, '').trim() || m.brand_model,
    median_price: m.median_price,
    count: m.count,
  }));

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(3px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20,
      animation:'dfade 0.2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:16,
        maxWidth:760, width:'100%', maxHeight:'88vh', overflow:'auto',
        boxShadow:'0 24px 70px rgba(0,0,0,0.6)',
      }}>
        {/* header */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'flex-start',
          padding:'22px 26px', borderBottom:'1px solid #1e2433', position:'sticky', top:0,
          background:'var(--bg3)', zIndex:1,
        }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ width:38, height:38, borderRadius:10, background:'rgba(240,165,0,0.14)', color:'#f0a500', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Tag size={18} />
              </span>
              <h2 style={{ fontFamily:'Rajdhani,sans-serif', fontSize:24, fontWeight:700, color:'var(--text)', margin:0, textTransform:'capitalize' }}>
                {drill.brand}
              </h2>
            </div>
            {!drill.loading && !drill.error && (
              <div style={{ display:'flex', gap:18, marginTop:12, flexWrap:'wrap' }}>
                <Stat label="Listings" value={(drill.total_listings ?? 0).toLocaleString('en-IN')} color="#3b82f6" />
                <Stat label="Median" value={fmt(drill.median_price)} color="#f0a500" />
                <Stat label="Range" value={`${fmt(drill.min_price)} – ${fmt(drill.max_price)}`} color="#22c55e" />
                <Stat label="Models" value={models.length} color="#a855f7" />
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text2)', padding:4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding:'22px 26px' }}>
          {drill.loading ? (
            <div style={{ textAlign:'center', padding:50, color:'var(--text2)' }}>
              <RefreshCw size={20} style={{ animation:'dspin 1s linear infinite' }} /> Loading {drill.brand} models…
            </div>
          ) : drill.error || models.length === 0 ? (
            <div style={{ textAlign:'center', padding:50, color:'var(--text3)' }}>
              No model data available for {drill.brand}.
            </div>
          ) : (
            <>
              {/* CHART on top */}
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
                Median price by model (top 10)
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top:6, right:10, left:-6, bottom:48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill:'var(--chart-axis)', fontSize:9 }} angle={-40} textAnchor="end" interval={0} height={70} />
                  <YAxis tickFormatter={fmt} tick={{ fill:'var(--chart-axis)', fontSize:10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="median_price" name="Median Price" radius={[5,5,0,0]} animationDuration={700}>
                    {chartData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} fillOpacity={0.9} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* TABLE below */}
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'22px 0 10px' }}>
                All models ({models.length})
              </div>
              <div style={{ overflowX:'auto', border:'1px solid #1e2433', borderRadius:10 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'rgba(0,0,0,0.25)' }}>
                      {['Model','Listings','Median','Min','Max'].map(h => (
                        <th key={h} style={{ textAlign: h==='Model'?'left':'right', padding:'10px 14px', fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((m, i) => (
                      <tr key={i} style={{ borderTop:'1px solid #1e2433' }}>
                        <td style={{ padding:'11px 14px', color:'var(--text)', fontWeight:500, textTransform:'capitalize' }}>{m.brand_model}</td>
                        <td style={{ padding:'11px 14px', color:'var(--text2)', textAlign:'right' }}>{m.count}</td>
                        <td style={{ padding:'11px 14px', color:'#f0a500', fontWeight:700, textAlign:'right', fontFamily:'Rajdhani,sans-serif' }}>{fmt(m.median_price)}</td>
                        <td style={{ padding:'11px 14px', color:'var(--text2)', textAlign:'right' }}>{fmt(m.min_price)}</td>
                        <td style={{ padding:'11px 14px', color:'var(--text2)', textAlign:'right' }}>{fmt(m.max_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
      <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:18, fontWeight:700, color, marginTop:2 }}>{value}</div>
    </div>
  );
}

/* ── components ── */
function StatCard({ Icon, val, lbl, col, delay }) {
  return (
    <div style={{ ...chartCardStyle, display:'flex', alignItems:'center', gap:15, padding:'20px 22px', cursor:'default', ...anim(delay) }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = col; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#1e2433'; }}>
      <span style={{ width:46, height:46, borderRadius:12, background:`${col}1e`, color:col, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon size={20} strokeWidth={2} />
      </span>
      <div>
        <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:26, fontWeight:700, color:'var(--text)', lineHeight:1 }}>{val}</div>
        <div style={{ fontSize:12, color:'var(--text2)', marginTop:5 }}>{lbl}</div>
      </div>
    </div>
  );
}

function QuickCard({ icon:Icon, title, desc, to, color }) {
  const nav = useNavigate();
  return (
    <div onClick={() => nav(to)} style={{ ...chartCardStyle, display:'flex', alignItems:'center', gap:14, padding:'18px 20px', cursor:'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-3px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2433'; e.currentTarget.style.transform = 'translateY(0)'; }}>
      <div style={{ width:42, height:42, borderRadius:11, background:`${color}1e`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon size={19} color={color} strokeWidth={1.9} />
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text)' }}>{title}</div>
        <div style={{ fontSize:11.5, color:'var(--text2)' }}>{desc}</div>
      </div>
      <ArrowRight size={15} color="#4d5668" />
    </div>
  );
}

function ChartCard({ title, subtitle, icon:Icon, delay, children }) {
  return (
    <div style={{ ...chartCardStyle, padding:22, ...anim(delay) }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2433'; }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:4 }}>
        {Icon && <Icon size={15} style={{ color:'#f0a500' }} />}
        <h3 style={{ fontFamily:'Rajdhani,sans-serif', fontSize:16, fontWeight:600, color:'var(--text)', margin:0 }}>{title}</h3>
      </div>
      <p style={{ fontSize:11.5, color:'var(--text3)', margin:'0 0 16px' }}>{subtitle}</p>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>
      {children}
    </div>
  );
}

function EmptyChart({ msg }) {
  return (
    <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', color:'var(--text3)', fontSize:12.5, padding:20 }}>
      {msg}
    </div>
  );
}

/* ── styles ── */
const wrap = { maxWidth:1280, margin:'0 auto', padding:30 };
const chartCardStyle = {
  background:'var(--bg3)', border:'1px solid #1e2433', borderRadius:14,
  transition:'transform 0.2s ease, border-color 0.2s ease',
};
const ghostBtn = {
  display:'inline-flex', alignItems:'center', gap:7, cursor:'pointer',
  padding:'9px 15px', borderRadius:9, fontSize:13, fontWeight:500,
  background:'transparent', border:'1px solid #1e2433', color:'var(--text2)',
};
const selectStyle = {
  padding:'8px 12px', borderRadius:8, fontSize:12.5, cursor:'pointer',
  background:'var(--bg2)', border:'1px solid #1e2433', color:'var(--text)',
  outline:'none', textTransform:'capitalize',
};
const yearList = (min, max) => {
  const lo = Number(min) || 1990, hi = Number(max) || 2026;
  const out = [];
  for (let y = hi; y >= lo; y--) out.push(y);
  return out;
};
const anim = (i) => ({ animation:`dfade 0.5s ease both`, animationDelay:`${i*0.08}s` });
const spinKeyframes = `@keyframes dspin { to { transform: rotate(360deg); } }`;
const animKeyframes = `@keyframes dfade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`;
