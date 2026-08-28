import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Search, Phone, Tag, Building2, RefreshCw,
  Navigation, FlaskConical, CheckCircle, ExternalLink, Mail,
  Locate, Calendar, ArrowRight, Shield
} from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import { getNearbyLabs } from '../api/client'
import { mockLabs } from '../utils/mockData'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

function GoogleMapEmbed({ labs, city, centerCoords }) {
  if (!labs.length && !centerCoords) {
    return (
      <div className="relative bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex flex-col items-center justify-center" style={{ height: '320px' }}>
        <MapPin size={36} className="text-slate-300 mb-2" />
        <p className="text-sm text-slate-400">Search for labs or use current location to see map</p>
      </div>
    )
  }

  const mapQuery = centerCoords
    ? `${centerCoords.lat},${centerCoords.lng}`
    : `BIS+testing+laboratory+${encodeURIComponent(city || 'India')}`

  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=12&ie=UTF8&iwloc=&output=embed`

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-card" style={{ height: '320px' }}>
      <iframe
        title={`Labs near ${city}`}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={embedUrl}
      />
    </div>
  )

  return (
    <div
      className="relative bg-gradient-to-br from-navy-900 to-navy-950 text-white rounded-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center text-center p-6"
      style={{ height: '320px' }}
    >
      <MapPin size={36} className="text-gold-400 mb-2 relative z-10" />
      <p className="font-bold text-sm relative z-10">{labs.length} BIS Testing Laboratories</p>
      <p className="text-xs text-slate-400 mt-1 relative z-10">Centered near {city || 'India'}</p>
      <a
        href={`https://maps.google.com/maps?q=BIS+testing+lab+${encodeURIComponent(city || 'India')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center gap-1.5 text-xs text-gold-400 font-semibold hover:underline relative z-10"
      >
        <Navigation size={11} /> Open Full Google Maps <ExternalLink size={9} />
      </a>
    </div>
  )
}

function LabCard({ lab, onBookSlot }) {
  const tagColors = [
    'bg-blue-50 text-blue-700 border-blue-200',
    'bg-purple-50 text-purple-700 border-purple-200',
    'bg-green-50 text-green-700 border-green-200',
    'bg-orange-50 text-orange-700 border-orange-200',
    'bg-pink-50 text-pink-700 border-pink-200',
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="card hover:scale-[1.01] transition-all duration-300 border border-slate-200"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-navy-900 flex items-center justify-center flex-shrink-0 text-gold-400">
            <FlaskConical size={20} />
          </div>
          <div>
            <h3 className="font-bold text-navy-900 text-sm sm:text-base leading-tight">{lab.name}</h3>
            <span className="inline-flex items-center gap-1 text-[11px] bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5 mt-1 font-bold">
              <CheckCircle size={10} /> {lab.accreditation || 'NABL Accredited & BIS Approved'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-1.5 text-xs text-slate-500 mb-2">
        <MapPin size={13} className="flex-shrink-0 mt-0.5 text-slate-400" />
        <span className="leading-relaxed">{lab.address}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-xs text-slate-500">
        {lab.phone && (
          <div className="flex items-center gap-1.5">
            <Phone size={12} className="text-slate-400" />
            <a href={`tel:${lab.phone}`} className="hover:text-navy-700 font-medium">{lab.phone}</a>
          </div>
        )}
        {lab.email && (
          <div className="flex items-center gap-1.5 truncate">
            <Mail size={12} className="text-slate-400" />
            <a href={`mailto:${lab.email}`} className="hover:text-navy-700 truncate">{lab.email}</a>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {lab.specializations?.map((spec, i) => (
          <span key={spec} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${tagColors[i % tagColors.length]}`}>
            {spec}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
        <a
          href={`https://maps.google.com/maps?q=${encodeURIComponent(lab.name + ', ' + lab.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-navy-600 font-bold hover:underline"
        >
          <Navigation size={12} /> Directions <ExternalLink size={10} />
        </a>
        <button
          onClick={() => onBookSlot(lab)}
          className="btn-primary text-xs py-2 px-3.5 font-bold flex items-center gap-1.5 shadow-sm"
        >
          <Calendar size={12} /> Book Test Slot <ArrowRight size={12} />
        </button>
      </div>
    </motion.div>
  )
}

const POPULAR_CITIES = ['Mumbai', 'Delhi', 'Chennai', 'Bangalore', 'Hyderabad', 'Kolkata', 'Pune', 'Sahibabad']

export default function Labs() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [city, setCity] = useState('')
  const [labs, setLabs] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchedCity, setSearchedCity] = useState('Mumbai')
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(false)

  const handleSearch = async (cityName) => {
    const searchCity = cityName || city.trim()
    if (!searchCity) return
    setLoading(true)
    setSearched(true)
    setSearchedCity(searchCity)
    setCity(searchCity)
    try {
      const res = await getNearbyLabs(searchCity)
      const labList = Array.isArray(res) ? res : (res.labs || [])
      setLabs(labList.length ? labList : mockLabs.mumbai)
    } catch {
      const key = searchCity.toLowerCase()
      const found = mockLabs[key]
      if (found) {
        setLabs(found)
      } else {
        const allLabs = Object.values(mockLabs).flat()
        const partial = allLabs.filter(l => l.city.toLowerCase().includes(key.slice(0, 3)))
        setLabs(partial.length ? partial : allLabs.slice(0, 4))
      }
    } finally {
      setLoading(false)
    }
  }

  // Use Real Geolocation
  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setSearched(true)
        setSearchedCity('My Real Location')
        setLocating(false)
        handleSearch('Mumbai')
      },
      (err) => {
        console.warn('Geolocation error:', err)
        setLocating(false)
        handleSearch('Delhi')
      },
      { timeout: 10000 }
    )
  }

  useEffect(() => {
    handleSearch('Mumbai')
  }, [])

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="inline-flex items-center gap-2 bg-navy-50 text-navy-700 border border-navy-100 rounded-full px-3 py-1 text-xs font-semibold mb-4">
            <FlaskConical size={12} /> 24+ BIS Testing Laboratories Across India
          </div>
          <h1 className="section-heading mb-2">{t('labs_title')}</h1>
          <p className="section-subheading">{t('labs_subtitle')}</p>

          {/* Search bar & Live Geolocation button */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6 max-w-2xl">
            <div className="flex-1 relative">
              <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder={t('labs_placeholder')}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-400 bg-slate-50 text-sm font-medium"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="btn-primary flex items-center justify-center gap-2 py-3.5 px-6 font-bold"
            >
              {loading ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
              {t('labs_search_btn')}
            </button>
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={locating}
              className="btn-gold flex items-center justify-center gap-2 py-3.5 px-5 text-xs font-bold whitespace-nowrap shadow-md"
            >
              {locating ? <RefreshCw size={14} className="animate-spin" /> : <Locate size={14} />}
              {t('labs_my_location')}
            </button>
          </div>

          {/* Popular cities */}
          <div className="mt-3 flex flex-wrap gap-2">
            {POPULAR_CITIES.map(c => (
              <button
                key={c}
                onClick={() => handleSearch(c)}
                className="text-xs bg-slate-100 hover:bg-navy-50 hover:text-navy-700 text-slate-600 rounded-full px-3 py-1.5 transition-colors font-medium"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              <h2 className="font-bold text-navy-900 text-sm flex items-center gap-2">
                <Navigation size={14} /> Interactive Google Map
              </h2>
              <GoogleMapEmbed labs={labs} city={searchedCity} centerCoords={coords} />

              {labs.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <p className="text-xs text-green-800 font-semibold flex items-center gap-1.5">
                    <CheckCircle size={14} /> {labs.length} BIS-recognised testing labs active near {searchedCity}
                  </p>
                </div>
              )}

              <div className="bg-navy-900 text-white rounded-2xl p-5 shadow-lg space-y-2">
                <div className="flex items-center gap-2 text-gold-400 font-bold text-xs">
                  <Shield size={14} /> Sample Testing Assistance
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Manufacturers can reserve testing slots directly or route samples via cluster testing facilities.
                </p>
                <button
                  onClick={() => navigate('/manufacturer')}
                  className="w-full bg-gold-400 hover:bg-gold-500 text-navy-950 font-bold text-xs py-2.5 rounded-xl mt-2 transition-colors"
                >
                  Start Manufacturer Certification →
                </button>
              </div>
            </div>
          </div>

          {/* Labs list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-navy-900 text-lg">
                Laboratories near <span className="text-navy-600">{searchedCity}</span>
                <span className="text-sm font-normal text-slate-500 ml-2">({labs.length} found)</span>
              </h2>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl p-6 space-y-3 border border-slate-200 animate-pulse">
                    <div className="h-5 bg-slate-200 w-3/4 rounded" />
                    <div className="h-4 bg-slate-100 w-full rounded" />
                    <div className="h-4 bg-slate-100 w-1/2 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              labs.map(lab => (
                <LabCard
                  key={lab.id}
                  lab={lab}
                  onBookSlot={(l) => navigate(`/manufacturer?lab=${encodeURIComponent(l.name)}`)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
