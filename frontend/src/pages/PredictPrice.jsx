import { useState, useEffect } from 'react';
import { Car, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import API from '../api/axios';

const fmtL = v => `₹${(Number(v)/100000).toFixed(2)} Lakh`;
const fmt  = v => `₹${Number(v).toLocaleString('en-IN')}`;
const confColor = { High:'#22c55e', Medium:'#3b82f6', Low:'#f0a500', 'Very Low':'#ef4444' };
const confClass = { High:'b-green', Medium:'b-blue', Low:'b-gold', 'Very Low':'b-red' };

export default function PredictPrice() {
  const [brands, setBrands]         = useState([]);
  const [models, setModels]         = useState([]);
  const [form, setForm]             = useState({
    brand:'', brand_model:'', year:2019, km_driven:45000,
    fuel:'petrol', transmission:'manual', owner:1, seller_type:'individual',
  });
  const [customBrand, setCustomBrand] = useState('');
  const [useCustom, setUseCustom]     = useState(false);
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [errors, setErrors]           = useState({});

  useEffect(() => {
    API.get('/brands').then(r => setBrands(r.data.brands)).catch(()=>{});
  }, []);

  useEffect(() => {
    const b = useCustom ? customBrand : form.brand;
    if (b && !useCustom) {
      API.get(`/models/${b}`).then(r => setModels(r.data.models)).catch(()=>setModels([]));
    } else {
      setModels([]);
    }
  }, [form.brand, useCustom, customBrand]);

  const validate = () => {
    const e = {};
    const b = useCustom ? customBrand.trim() : form.brand;
    if (!b) e.brand = 'Select or enter a brand';
    if (!form.year || form.year < 1990 || form.year > 2026) e.year = 'Year: 1990–2026';
    if (!form.km_driven || form.km_driven < 0) e.km_driven = 'Enter valid kilometres';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setLoading(true); setResult(null);
    try {
      const brand = useCustom ? customBrand.trim().toLowerCase() : form.brand;
      const res = await API.post('/predict-price', {
        ...form, brand,
        year: parseInt(form.year),
        km_driven: parseFloat(form.km_driven),
        owner: parseInt(form.owner),
      });
      setResult(res.data);
    } catch(err) {
      alert(err.response?.data?.detail || 'Prediction failed. Check your inputs.');
    } finally { setLoading(false); }
  };

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  return (
    <div className="page-wrap fade">
      <div className="ph">
        <h1><span>Predict</span> Car Price</h1>
        <p>ML-powered price prediction • Gradient Boosting • R² = 0.95 • 9,574 training samples</p>
      </div>

      <div className="g2">
        {/* FORM */}
        <div className="card">
          <h3 style={{ fontFamily:'var(--font-d)',fontSize:15,fontWeight:600,marginBottom:18,display:'flex',alignItems:'center',gap:7,color:'var(--text)' }}>
            <Car size={15} style={{ color:'var(--gold)' }}/> Car Details
          </h3>

          {/* Brand selector */}
          <div className="fg">
            <label className="fl">Brand *</label>
            <div style={{ display:'flex',gap:8,marginBottom:6 }}>
              <button onClick={()=>setUseCustom(false)}
                className={`btn ${!useCustom?'btn-gold':'btn-ghost'}`}
                style={{ fontSize:11,padding:'5px 12px' }}>
                From List
              </button>
              <button onClick={()=>setUseCustom(true)}
                className={`btn ${useCustom?'btn-gold':'btn-ghost'}`}
                style={{ fontSize:11,padding:'5px 12px' }}>
                Type Manually
              </button>
            </div>

            {!useCustom ? (
              <select className="fs" value={form.brand}
                onChange={e => set('brand', e.target.value)}>
                <option value="">Select brand</option>
                {brands.map(b => <option key={b} value={b}>{b.charAt(0).toUpperCase()+b.slice(1)}</option>)}
              </select>
            ) : (
              <>
                <input className="fi" placeholder="e.g. citroen, ola electric, bmw"
                  value={customBrand}
                  onChange={e => setCustomBrand(e.target.value)} />
                <div className="fhint">⚠️ Unknown brands use closest known brand as proxy (lower confidence)</div>
              </>
            )}
            {errors.brand && <div className="ferr">{errors.brand}</div>}
          </div>

          {/* Model */}
          <div className="fg">
            <label className="fl">Model (Optional)</label>
            {!useCustom && models.length > 0 ? (
              <select className="fs" value={form.brand_model}
                onChange={e => set('brand_model', e.target.value)}>
                <option value="">Select model (improves accuracy)</option>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input className="fi" placeholder="e.g. maruti swift, hyundai creta"
                value={form.brand_model}
                onChange={e => set('brand_model', e.target.value)} />
            )}
            <div className="fhint">Selecting the exact model significantly improves accuracy</div>
          </div>

          <div className="g2">
            <div className="fg">
              <label className="fl">Manufacturing Year *</label>
              <input className="fi" type="number" min="1990" max="2026"
                value={form.year} onChange={e => set('year',e.target.value)} />
              {errors.year && <div className="ferr">{errors.year}</div>}
            </div>
            <div className="fg">
              <label className="fl">KM Driven *</label>
              <input className="fi" type="number" min="0" placeholder="e.g. 45000"
                value={form.km_driven}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') { set('km_driven',''); return; }
                  const cleaned = raw.replace(/^0+(?=\d)/, '');
                  set('km_driven', cleaned);
                }} />
              {form.km_driven && <div className="fhint">{Number(form.km_driven).toLocaleString('en-IN')} km</div>}
              {errors.km_driven && <div className="ferr">{errors.km_driven}</div>}
            </div>
          </div>

          <div className="g2">
            <div className="fg">
              <label className="fl">Fuel Type</label>
              <select className="fs" value={form.fuel} onChange={e => set('fuel',e.target.value)}>
                {['petrol','diesel','cng','lpg','electric'].map(f=><option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Transmission</label>
              <select className="fs" value={form.transmission} onChange={e => set('transmission',e.target.value)}>
                <option value="manual">Manual</option>
                <option value="automatic">Automatic (+premium)</option>
              </select>
            </div>
          </div>

          <div className="g2">
            <div className="fg">
              <label className="fl">Number of Owners</label>
              <select className="fs" value={form.owner} onChange={e => set('owner',e.target.value)}>
                <option value={0}>Test Drive Car</option>
                <option value={1}>1st Owner (best resale)</option>
                <option value={2}>2nd Owner (-12%)</option>
                <option value={3}>3rd Owner (-22%)</option>
                <option value={4}>4th+ Owner (-35%)</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">Seller Type</label>
              <select className="fs" value={form.seller_type} onChange={e => set('seller_type',e.target.value)}>
                <option value="individual">Individual</option>
                <option value="dealer">Dealer</option>
                <option value="trustmark dealer">Trustmark Dealer</option>
              </select>
            </div>
          </div>

          <button className="btn btn-gold btn-full btn-lg" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="spin"/> : <Zap size={15}/>}
            {loading ? 'Predicting...' : 'Predict Price'}
          </button>
        </div>

        {/* RESULT */}
        <div>
          {result ? (
            <div className="card card-gold fade" style={{ position:'sticky',top:20 }}>
              <h3 style={{ fontFamily:'var(--font-d)',fontSize:15,fontWeight:600,marginBottom:20,color:'var(--text)' }}>
                Prediction Result
              </h3>

              {/* Price */}
              <div style={{ textAlign:'center',padding:'20px 0',borderBottom:'1px solid var(--border)',marginBottom:20 }}>
                <div style={{ fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8 }}>
                  Predicted Market Price
                </div>
                <div style={{ fontFamily:'var(--font-d)',fontSize:40,fontWeight:700,color:'var(--gold)',lineHeight:1 }}>
                  {fmtL(result.predicted_price)}
                </div>
                <div style={{ fontSize:13,color:'var(--text2)',marginTop:6 }}>
                  {fmt(result.predicted_price)}
                </div>
                <div style={{ marginTop:12 }}>
                  <span className={`badge ${confClass[result.confidence]}`}>
                    {result.confidence} Confidence
                  </span>
                </div>
              </div>

              {/* Details */}
              <div style={{ display:'grid',gap:10,marginBottom:16 }}>
                {[
                  ['Model Used',     result.model_used],
                  ['Car Age',        `${result.car_age} years old`],
                  ['Usage Rate',     `${Number(result.km_per_year).toLocaleString()} km/year`],
                  ['Resolved Brand', result.resolved_brand?.toUpperCase()],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:'flex',justifyContent:'space-between',fontSize:13,paddingBottom:8,borderBottom:'1px solid var(--border)' }}>
                    <span style={{ color:'var(--text2)' }}>{k}</span>
                    <span style={{ color:'var(--text)',fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Confidence message */}
              {result.fallback_level === 0 ? (
                <div style={{ display:'flex',gap:8,padding:'10px 14px',background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:8 }}>
                  <CheckCircle size={14} style={{ color:'var(--green)',flexShrink:0,marginTop:1 }}/>
                  <span style={{ fontSize:12,color:'var(--text2)',lineHeight:1.5 }}>
                    Exact match found in dataset — high accuracy prediction
                  </span>
                </div>
              ) : (
                <div style={{ display:'flex',gap:8,padding:'10px 14px',background:'rgba(240,165,0,0.07)',border:'1px solid rgba(240,165,0,0.18)',borderRadius:8 }}>
                  <AlertCircle size={14} style={{ color:'var(--gold)',flexShrink:0,marginTop:1 }}/>
                  <span style={{ fontSize:12,color:'var(--text2)',lineHeight:1.5 }}>
                    {result.fallback_message}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="card empty" style={{ minHeight:320 }}>
              <Car size={52} strokeWidth={1}/>
              <p>Fill in car details and click Predict Price</p>
              <small>Results appear here instantly with confidence level</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
