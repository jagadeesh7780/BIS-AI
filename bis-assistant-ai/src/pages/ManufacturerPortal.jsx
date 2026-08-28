import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Factory, CheckCircle, Search, Upload, MapPin, Calendar, Clock,
  CreditCard, ShieldCheck, FileText, Printer, ArrowRight, ArrowLeft,
  Zap, Building2, User, Phone, Check, RefreshCw, AlertCircle, QrCode,
  Sparkles, Navigation, FlaskConical, Locate, ExternalLink, Compass,
  Scale, ShieldAlert, Award, FileCheck, Layers, Cpu, CheckSquare
} from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import {
  orchestrateManufacturer,
  approveAndSubmitManufacturer,
  getNearbyLabs
} from '../api/client'
import { mockLabs, mockStandards } from '../utils/mockData'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

export default function ManufacturerPortal() {
  const { t } = useLang()
  const [step, setStep] = useState(1) // 1 to 5

  // Step 1: Product Identification
  const [productName, setProductName] = useState('Domestic Pressure Cooker')
  const [detecting, setDetecting] = useState(false)

  // Multi-Agent Pipeline State
  const [agentData, setAgentData] = useState(null)
  const [agentLogs, setAgentLogs] = useState([])

  // Step 2: KYC & Factory
  const [kyc, setKyc] = useState({
    pan: 'AABCB1234F',
    aadhaar: '987654321098',
    businessName: 'Apex Industrial Solutions Pvt Ltd',
    factoryAddress: 'Plot No. 42-B, Industrial Development Area, Phase-II',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400072'
  })

  // Step 3: Lab Matching, Location & Category Filters
  const [labCategory, setLabCategory] = useState('All')
  const [selectedCity, setSelectedCity] = useState('Mumbai')
  const [customCity, setCustomCity] = useState('')
  const [userCoords, setUserCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [labs, setLabs] = useState([])
  const [selectedLab, setSelectedLab] = useState(null)
  const [slotDate, setSlotDate] = useState('2026-09-05')
  const [slotTime, setSlotTime] = useState('10:00 AM - 01:00 PM')

  // Step 4: Human-in-the-Loop Approval & Payment
  const [humanApproved, setHumanApproved] = useState(true)
  const [signatoryName, setSignatoryName] = useState('Rajesh Kumar (Director / Plant Head)')
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [submitting, setSubmitting] = useState(false)

  // Step 5: Final Submission Report
  const [report, setReport] = useState(null)

  // Quick select examples
  const quickExamples = [
    'Domestic Pressure Cooker',
    'Two Wheeler Safety Helmet',
    'Structural Steel Standard Quality',
    'Packaged Drinking Water',
    'Self-Ballasted LED Bulbs',
    'Stationary Storage Electric Water Heater'
  ]

  // Lab Categories
  const labCategories = [
    'All',
    'Mechanical & Kitchenware',
    'Electrical & Electronics',
    'Personal Protective Equipment (PPE)',
    'Chemical & Food',
    'Civil & Structural Steel',
    'Gold & Silver Hallmarking'
  ]

  // Available Cities
  const majorCities = [
    'Mumbai', 'Delhi NCR', 'Ghaziabad', 'Chennai', 'Kolkata', 'Bangalore', 'Hyderabad', 'Mohali', 'Pune', 'Ahmedabad'
  ]

  // Distance calculation helper (Haversine formula)
  const calcDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null
    const R = 6371 // km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(R * c * 10) / 10
  }

  // Run Multi-Agent Orchestration Pipeline
  const runAgentPipeline = async (nameOverride) => {
    const query = (typeof nameOverride === 'string' ? nameOverride : productName).trim()
    if (!query) return
    setDetecting(true)
    try {
      const res = await orchestrateManufacturer({
        product_name: query,
        city: customCity || selectedCity || kyc.city || 'Mumbai',
        user_coords: userCoords,
        kyc: kyc
      })
      setAgentData(res)
      setAgentLogs(res.logs || [])
      if (res.labs?.top_recommended_lab) {
        setSelectedLab(res.labs.top_recommended_lab)
      }
    } catch {
      // Local fallback mock
      const found = mockStandards.find(s =>
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.keywords.some(k => query.toLowerCase().includes(k.toLowerCase()))
      ) || mockStandards[0]

      const fallbackState = {
        success: true,
        product: {
          product_name: query,
          category: found.category || 'Consumer Products & Kitchenware',
          domain: 'Mechanical & Electrotechnical',
          risk_tier: 'Class-I High Assurance Consumer Good',
          technical_scope: `Manufacture and quality testing of ${query}`
        },
        standards: {
          standard_number: found.number || 'IS 2347',
          standard_title: found.title || 'Domestic Pressure Cookers — Specification',
          scheme: found.certification_scheme || 'Scheme-I (ISI Mark)',
          required_mark: 'Standard ISI Mark with CM/L Number',
          summary: found.summary || 'Prescribes dimensional, bursting and thermal safety limits.'
        },
        qco: {
          qco_status: 'MANDATORY UNDER QUALITY CONTROL ORDER (QCO)',
          issuing_authority: 'DPIIT, Ministry of Commerce & Industry',
          enforcement_date: '01 January 2024 (Enforced nationwide)',
          statutory_act: 'Section 16 of the BIS Act 2016',
          penalty_warning: 'Section 29: Imprisonment up to 2 years or fine up to ₹5,00,000 for non-compliance.'
        },
        documents_and_tests: {
          total_documents_required: 6,
          total_tests_required: 4,
          document_checklist: [
            { id: 'DOC-01', name: 'Form-V Official Application Form', mandatory: true },
            { id: 'DOC-02', name: 'Factory Land Possession & MSME Udyam Registration', mandatory: true },
            { id: 'DOC-03', name: 'List of Manufacturing Machinery & Installed Capacity', mandatory: true },
            { id: 'DOC-04', name: 'Testing Equipment Calibration Certificates Traceable to NABL', mandatory: true },
            { id: 'DOC-05', name: 'Quality Control In-Charge Degree & Qualification Credentials', mandatory: true },
            { id: 'DOC-06', name: 'Factory Layout & Quality Management System (QMS) Manual', mandatory: true }
          ],
          mandatory_tests: [
            { name: 'Proof Pressure Test (2x Operating Pressure)', clause: 'Clause 8.1', duration: '48 Hours' },
            { name: 'Safety Valve Burst & Operating Limits Test', clause: 'Clause 8.3', duration: '24 Hours' },
            { name: 'Thermal Shock & Rubber Gasket Endurance', clause: 'Clause 9.2', duration: '72 Hours' },
            { name: 'Mechanical Handle Strength & Thermal Limit', clause: 'Clause 10.4', duration: '12 Hours' }
          ],
          sample_lot_size: '4 Finished Production Samples with Spare Relief Valves'
        },
        labs: {
          total_accredited_labs_matched: 24,
          estimated_dispatch_time: '1 - 2 Working Days via Courier / BIS Sample Escort'
        },
        fees_and_timeline: {
          fee_breakdown: {
            application_fee: 1000,
            pre_audit_and_testing_fee: 11500,
            annual_license_marking_fee: 1000,
            total_statutory_amount: 13500
          },
          estimated_turnaround: '14 Calendar Days (2 Weeks Fast-Track Protocol)',
          milestone_roadmap: [
            { day_range: 'Day 1 – 2', stage: 'Stage 1: Form-V Filing & Document Validation', responsible: 'Manufacturer & AI Agent' },
            { day_range: 'Day 3 – 5', stage: 'Stage 2: Sample Drawing & Laboratory Testing', responsible: 'Accredited Lab' },
            { day_range: 'Day 6 – 9', stage: 'Stage 3: Factory Technical Inspection & SIT Audit', responsible: 'BIS Field Officer' },
            { day_range: 'Day 10 – 12', stage: 'Stage 4: Test Report Scrutiny & Cross-Verification', responsible: 'Scrutiny Committee' },
            { day_range: 'Day 13 – 14', stage: 'Stage 5: Official License Grant & CM/L Issuance', responsible: 'BIS Central Directorate' }
          ]
        },
        roadmap: {
          dataset_sources_used: [
            'standards.json (55 Specifications)',
            'schemes.json (7 Schemes)',
            'bis_services.json (30 Services)',
            'labs.json (24 Laboratories)'
          ]
        },
        human_approval_gate: {
          approval_token: 'HITL-TOKEN-77F82A9C1',
          status: 'PENDING_HUMAN_APPROVAL'
        }
      }
      setAgentData(fallbackState)
    } finally {
      setDetecting(false)
    }
  }

  // Run pipeline on mount
  useEffect(() => {
    runAgentPipeline()
  }, [])

  // Load and filter labs based on selected location and category
  useEffect(() => {
    async function loadFilteredLabs() {
      const allMockLabs = Object.values(mockLabs).flat()
      const searchTarget = (customCity || selectedCity || kyc.city || 'Mumbai').toLowerCase()

      let matched = []
      try {
        const res = await getNearbyLabs(searchTarget)
        matched = Array.isArray(res) ? res : (res.labs || [])
      } catch {
        matched = []
      }

      if (!matched.length) {
        matched = allMockLabs.filter(l =>
          l.city?.toLowerCase().includes(searchTarget) ||
          l.name?.toLowerCase().includes(searchTarget) ||
          l.address?.toLowerCase().includes(searchTarget)
        )
      }
      if (!matched.length) {
        matched = allMockLabs
      }

      // Filter by category
      if (labCategory && labCategory !== 'All') {
        const catKeywords = labCategory.toLowerCase().split(' & ')
        const categoryFiltered = matched.filter(l => {
          const specs = (l.specializations || []).map(s => s.toLowerCase()).join(' ')
          return catKeywords.some(kw => specs.includes(kw) || l.name.toLowerCase().includes(kw))
        })
        if (categoryFiltered.length) matched = categoryFiltered
      }

      // Compute distances if userCoords available
      if (userCoords) {
        matched = matched.map(l => ({
          ...l,
          distanceKm: calcDistance(userCoords.lat, userCoords.lng, l.lat, l.lng)
        })).sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
      }

      setLabs(matched)
      if (matched.length) {
        setSelectedLab(prev => (prev && matched.some(m => m.name === prev.name) ? prev : matched[0]))
      }
    }
    loadFilteredLabs()
  }, [selectedCity, customCity, labCategory, userCoords, kyc.city])

  // Get current browser geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserCoords(coords)
        setSelectedCity('My Location')
        setLocating(false)
      },
      () => {
        setLocating(false)
        alert('Could not access your location. Please select a city manually.')
      }
    )
  }

  // Handle Human-in-the-Loop Approval & Final Submission
  const handleApproveAndSubmit = async () => {
    if (!humanApproved) {
      alert('Please check the verification confirmation box before submitting.')
      return
    }
    setSubmitting(true)
    try {
      const res = await approveAndSubmitManufacturer({
        approval_token: agentData?.human_approval_gate?.approval_token || 'HITL-TOKEN-APPROVED',
        signature_name: signatoryName,
        business_name: kyc.businessName,
        product_name: productName,
        standard_number: agentData?.standards?.standard_number || 'IS 2347',
        scheme: agentData?.standards?.scheme || 'Scheme-I (ISI Mark)',
        payment_method: paymentMethod,
        payment_amount: agentData?.fees_and_timeline?.fee_breakdown?.total_statutory_amount || 13500
      })

      const submission = res.submission || {}
      setReport({
        application_id: submission.tracking_id || `BIS-MFR-2026-${Math.floor(10000 + Math.random() * 90000)}`,
        status: 'Application Successfully Approved & Testing Slot Confirmed',
        approval_eta: 'Laboratory Test Results & Final Certificate will be shared after sample analysis',
        approval_notice: '✅ Your application dossier and statutory fees have been verified and approved. Laboratory testing slot has been confirmed. Laboratory Test Results and Final Certification Certificate will be shared after official sample analysis.',
        submitted_at: submission.submitted_at || new Date().toLocaleString(),
        signed_by: submission.signed_by || signatoryName,
        product_details: {
          name: productName,
          category: agentData?.product?.category || 'Consumer Goods',
          standard_number: agentData?.standards?.standard_number || 'IS 2347',
          standard_title: agentData?.standards?.standard_title || 'Domestic Pressure Cookers',
          scheme: agentData?.standards?.scheme || 'Scheme-I (ISI Mark)',
          mark: agentData?.standards?.required_mark || 'ISI Mark'
        },
        manufacturer_details: {
          business_name: kyc.businessName,
          pan_number: kyc.pan,
          aadhaar_mask: `XXXX-XXXX-${kyc.aadhaar.slice(-4)}`,
          factory_address: `${kyc.factoryAddress}, ${kyc.city}, ${kyc.state} - ${kyc.pincode}`
        },
        lab_booking: {
          lab_name: selectedLab?.name || 'BIS Regional Office Laboratory',
          slot_date: slotDate,
          slot_time: slotTime,
          status: 'Sample Slot Confirmed'
        },
        payment_receipt: {
          transaction_id: submission.transaction_hash || `TXN-BIS-${Math.floor(10000000 + Math.random() * 90000000)}`,
          payment_method: paymentMethod,
          amount_paid: agentData?.fees_and_timeline?.fee_breakdown?.total_statutory_amount || 13500,
          payment_status: 'SUCCESSFUL (PAID)',
          paid_at: new Date().toLocaleString()
        }
      })
      setStep(5)
    } catch {
      // Fallback submission report
      const appId = `BIS-MFR-2026-${Math.floor(10000 + Math.random() * 90000)}`
      const txId = `TXN-BIS-${Math.floor(10000000 + Math.random() * 90000000)}`
      setReport({
        application_id: appId,
        status: 'Application Successfully Approved & Testing Slot Confirmed',
        approval_eta: 'Laboratory Test Results & Final Certificate will be shared after sample analysis',
        approval_notice: '✅ Your application dossier and statutory fees have been verified and approved. Laboratory testing slot has been confirmed. Laboratory Test Results and Final Certification Certificate will be shared after official sample analysis.',
        submitted_at: new Date().toLocaleString(),
        signed_by: signatoryName,
        product_details: {
          name: productName,
          category: agentData?.product?.category || 'Consumer Goods',
          standard_number: agentData?.standards?.standard_number || 'IS 2347',
          standard_title: agentData?.standards?.standard_title || 'Domestic Pressure Cookers',
          scheme: agentData?.standards?.scheme || 'Scheme-I (ISI Mark)',
          mark: agentData?.standards?.required_mark || 'ISI Mark'
        },
        manufacturer_details: {
          business_name: kyc.businessName,
          pan_number: kyc.pan,
          aadhaar_mask: `XXXX-XXXX-${kyc.aadhaar.slice(-4)}`,
          factory_address: `${kyc.factoryAddress}, ${kyc.city}, ${kyc.state} - ${kyc.pincode}`
        },
        lab_booking: {
          lab_name: selectedLab?.name || 'BIS Regional Office Laboratory',
          slot_date: slotDate,
          slot_time: slotTime,
          status: 'Sample Slot Confirmed'
        },
        payment_receipt: {
          transaction_id: txId,
          payment_method: paymentMethod,
          amount_paid: agentData?.fees_and_timeline?.fee_breakdown?.total_statutory_amount || 13500,
          payment_status: 'SUCCESSFUL (PAID)',
          paid_at: new Date().toLocaleString()
        }
      })
      setStep(5)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f7f8fa] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ─── Header & Telemetry Badge ───────────────────────────────────── */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 rounded-3xl p-6 sm:p-8 text-white border border-slate-800 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-gold-400/20 text-gold-300 border border-gold-400/30 text-[11px] font-bold px-3 py-0.5 rounded-full flex items-center gap-1.5">
                  <Cpu size={12} /> Autonomous Multi-Agent Orchestration
                </span>
                <span className="bg-green-500/20 text-green-300 border border-green-500/30 text-[11px] font-bold px-3 py-0.5 rounded-full">
                  RAG-Grounded 2026 Datasets
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Manufacturer Certification Portal
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
                End-to-end automated licensing pipeline: IS standard mapping, QCO regulatory checks, document & lab test generation, Google Maps slot booking, and Human-in-the-Loop approval.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center sm:text-right">
              <span className="text-[10px] text-slate-300 block uppercase font-bold tracking-wider">Certification Status</span>
              <span className="text-xl font-extrabold text-gold-400">Direct Lab Testing</span>
              <span className="text-[10px] text-green-300 block font-semibold">Scheme-I BIS Protocol</span>
            </div>
          </div>

          {/* Stepper Wizard Bar */}
          <div className="grid grid-cols-5 gap-2 mt-6 pt-6 border-t border-white/10">
            {[
              { num: 1, label: '1. Standard & QCO' },
              { num: 2, label: '2. Factory KYC' },
              { num: 3, label: '3. Docs & Lab Slot' },
              { num: 4, label: '4. HITL Approval' },
              { num: 5, label: '5. Official Report' }
            ].map(s => (
              <div key={s.num} className="text-center">
                <div className={`h-1.5 rounded-full transition-all mb-2 ${
                  step >= s.num ? 'bg-gold-400' : 'bg-white/20'
                }`} />
                <span className={`text-[11px] font-bold block ${
                  step === s.num ? 'text-gold-400 font-extrabold' : step > s.num ? 'text-white' : 'text-slate-400'
                }`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── STEP 1: Product Identification & Automated Standard + QCO ──── */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-card">
              <h2 className="text-xl font-bold text-navy-900 mb-2 flex items-center gap-2">
                <Search className="text-navy-700" size={20} /> 1. Product Details & Automated Standards Matching
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                Enter your product name to trigger the Multi-Agent RAG search across 55+ Indian Standards, Quality Control Orders, and BIS Certification Schemes.
              </p>

              <form onSubmit={(e) => { e.preventDefault(); runAgentPipeline(); }} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Enter Product Name / Engineering Description <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={productName}
                      onChange={e => setProductName(e.target.value)}
                      placeholder="e.g. Domestic Pressure Cooker, Two Wheeler Helmet, Structural Steel, LED Bulb..."
                      className="flex-1 px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-400 text-sm bg-slate-50 font-medium"
                    />
                    <button
                      type="submit"
                      disabled={!productName.trim() || detecting}
                      className="btn-primary px-6 py-3.5 text-sm font-bold flex items-center gap-2 flex-shrink-0"
                    >
                      {detecting ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                      {detecting ? 'Analyzing...' : 'Run Agent RAG Analysis'}
                    </button>
                  </div>
                </div>

                {/* Popular Categories */}
                <div>
                  <span className="text-xs text-slate-400 font-semibold block mb-2">Popular Categories:</span>
                  <div className="flex flex-wrap gap-2">
                    {quickExamples.map(item => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setProductName(item)
                          runAgentPipeline(item)
                        }}
                        className="text-xs bg-slate-100 hover:bg-navy-50 hover:text-navy-800 text-slate-600 px-3 py-1.5 rounded-full border border-slate-200 transition-colors"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </form>

              {/* Agent Output Card */}
              {agentData && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-8 space-y-4"
                >
                  {/* Standard & Scheme Card */}
                  <div className="bg-gradient-to-br from-navy-950 to-navy-900 rounded-2xl p-6 text-white space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <span className="text-xs text-gold-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={14} /> Multi-Agent RAG Identification
                      </span>
                      <span className="bg-green-500/20 text-green-300 border border-green-500/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                        {agentData.qco?.qco_status || 'QCO Mandatory'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
                        <span className="text-xs text-slate-400">Applicable Indian Standard</span>
                        <h4 className="text-lg font-bold text-gold-400 mt-0.5">{agentData.standards?.standard_number}</h4>
                        <p className="text-xs text-slate-300 line-clamp-2 mt-1">{agentData.standards?.standard_title}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
                        <span className="text-xs text-slate-400">Regulatory Scheme</span>
                        <h4 className="text-sm font-bold text-white mt-0.5">{agentData.standards?.scheme}</h4>
                        <p className="text-xs text-slate-300 mt-1">Timeline: 2 Weeks Fast-Track</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
                        <span className="text-xs text-slate-400">Statutory Mark Required</span>
                        <h4 className="text-sm font-bold text-white mt-0.5">{agentData.standards?.required_mark}</h4>
                        <p className="text-xs text-slate-300 mt-1">Official Manak Online Registration</p>
                      </div>
                    </div>
                  </div>

                  {/* QCO Mandate Warning Card */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                      <Scale size={16} className="text-amber-700" />
                      QCO Statutory Regulatory Notice ({agentData.qco?.issuing_authority})
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <strong>Mandatory Order:</strong> {agentData.qco?.qco_order_title || 'Compulsory BIS Certification Order'}.
                      Enforced under <strong>{agentData.qco?.statutory_act}</strong>.
                    </p>
                    <div className="text-[11px] text-amber-900/80 bg-amber-100/70 p-2.5 rounded-xl border border-amber-200/60 font-medium">
                      ⚠️ <strong>Statutory Penalty Notice:</strong> {agentData.qco?.penalty_warning}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Next Button */}
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="btn-primary px-8 py-3 text-sm font-bold flex items-center gap-2"
                >
                  Proceed to Factory KYC <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── STEP 2: Manufacturer KYC & Factory Details ─────────────────── */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-card">
              <h2 className="text-xl font-bold text-navy-900 mb-2 flex items-center gap-2">
                <Building2 className="text-navy-700" size={20} /> 2. Manufacturer KYC & Factory Incorporation
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                Enter your company PAN, authorized signatory details, and manufacturing factory address for Form-V compliance.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Company PAN Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={kyc.pan}
                    onChange={e => setKyc({ ...kyc, pan: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono focus:ring-2 focus:ring-navy-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Authorized Signatory Aadhaar Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={kyc.aadhaar}
                    onChange={e => setKyc({ ...kyc, aadhaar: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono focus:ring-2 focus:ring-navy-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Business / Enterprise Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={kyc.businessName}
                    onChange={e => setKyc({ ...kyc, businessName: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-navy-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Manufacturing Factory Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={kyc.factoryAddress}
                    onChange={e => setKyc({ ...kyc, factoryAddress: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-navy-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">City</label>
                  <input
                    type="text"
                    value={kyc.city}
                    onChange={e => setKyc({ ...kyc, city: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Pincode</label>
                  <input
                    type="text"
                    value={kyc.pincode}
                    onChange={e => setKyc({ ...kyc, pincode: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                >
                  <ArrowLeft size={16} className="inline mr-1" /> Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="btn-primary px-8 py-3 text-sm font-bold flex items-center gap-2"
                >
                  Proceed to Generated Documents & Lab Slot <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── STEP 3: Automated Documents, Testing Battery & Lab Booking ─── */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-card">
              <h2 className="text-xl font-bold text-navy-900 mb-2 flex items-center gap-2">
                <FlaskConical className="text-navy-700" size={20} /> 3. Generated Technical Documents, Test Battery & Lab Slot
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                The Document & Testing Agents have formulated the statutory Form-V checklist and mandatory laboratory test battery under {agentData?.standards?.standard_number || 'IS Standard'}.
              </p>

              {/* 1. Form-V Document Checklist */}
              <div className="mb-6">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-3 flex items-center gap-1.5">
                  <FileCheck size={16} className="text-navy-800" /> Mandatory Form-V Document Checklist ({agentData?.documents_and_tests?.total_documents_required || 6} Items)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {(agentData?.documents_and_tests?.document_checklist || []).map((doc, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                      <CheckCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-navy-900">{doc.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{doc.description || 'Statutory regulatory compliance attachment'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Mandatory Testing Battery */}
              <div className="mb-6 pt-4 border-t border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-3 flex items-center gap-1.5">
                  <FlaskConical size={16} className="text-navy-800" /> Mandatory Laboratory Test Battery & Sample Batch
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                  {(agentData?.documents_and_tests?.mandatory_tests || []).map((test, idx) => (
                    <div key={idx} className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-navy-900">{test.name}</h4>
                        <span className="text-[10px] text-blue-700 font-semibold">{test.clause}</span>
                        <p className="text-[11px] text-slate-600 mt-0.5">{test.requirement || 'Conformity to standard specifications'}</p>
                      </div>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                        ⏱️ {test.duration || '24 Hours'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                  <Award size={16} className="text-emerald-700 flex-shrink-0" />
                  <span><strong>Required Sample Lot Size:</strong> {agentData?.documents_and_tests?.sample_lot_size || '3 Production floor test samples'}</span>
                </div>
              </div>

              {/* 3. Location & Category Filter Controls */}
              <div className="mb-6 pt-4 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Filter BIS-Recognized Testing Laboratories:
                  </span>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={locating}
                    className="bg-navy-50 hover:bg-navy-100 text-navy-900 border border-navy-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto"
                  >
                    <Navigation size={12} className={locating ? 'animate-spin text-navy-700' : 'text-navy-700'} />
                    {locating ? 'Locating...' : '📍 Use My Current Location'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {majorCities.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setSelectedCity(c); setCustomCity(''); }}
                      className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all ${
                        selectedCity === c && !customCity
                          ? 'bg-blue-600 text-white font-bold shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {/* Google Maps Embed */}
                <div className="rounded-2xl overflow-hidden border border-slate-200 h-64 shadow-inner mb-4 relative">
                  <iframe
                    title="Google Maps Lab Locator"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(
                      selectedLab ? `${selectedLab.name}, ${selectedLab.address || selectedLab.city}` : `BIS testing laboratory ${selectedCity || 'India'}`
                    )}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                  />
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-1.5 shadow-md flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[11px] font-bold text-slate-800 truncate max-w-[220px]">
                      {selectedLab ? selectedLab.name : `Near ${selectedCity}`}
                    </span>
                  </div>
                </div>

                {/* Nearest Lab Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                  {labs.map((l) => {
                    const isSelected = selectedLab?.name === l.name
                    return (
                      <div
                        key={l.id || l.name}
                        onClick={() => setSelectedLab(l)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-navy-950 text-white border-navy-900 ring-2 ring-gold-400/50 shadow-lg'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className={`text-xs font-bold ${isSelected ? 'text-gold-400' : 'text-navy-900'}`}>
                            {l.name}
                          </h4>
                          {l.distanceKm != null && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${
                              isSelected ? 'bg-gold-400/20 text-gold-300 border border-gold-400/30' : 'bg-blue-50 text-blue-700'
                            }`}>
                              📍 {l.distanceKm} km away
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] mb-2 line-clamp-2 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {l.address || `${l.city}, India`}
                        </p>
                        {isSelected && (
                          <div className="text-[10px] text-green-400 font-bold flex items-center gap-1">
                            <Check size={11} /> Selected for Sample Testing Slot
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 4. Slot Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Preferred Sample Testing Date</label>
                  <input
                    type="date"
                    value={slotDate}
                    onChange={e => setSlotDate(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Preferred Slot Time</label>
                  <select
                    value={slotTime}
                    onChange={e => setSlotTime(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium"
                  >
                    <option>10:00 AM - 01:00 PM</option>
                    <option>02:00 PM - 05:00 PM</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                >
                  <ArrowLeft size={16} className="inline mr-1" /> Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="btn-primary px-8 py-3 text-sm font-bold flex items-center gap-2"
                >
                  Proceed to Roadmap, Fees & Human Approval <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── STEP 4: Roadmap, Fees & Human-in-the-Loop Approval ─────────── */}
        {step === 4 && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-card">
              <h2 className="text-xl font-bold text-navy-900 mb-2 flex items-center gap-2">
                <Scale className="text-navy-700" size={20} /> 4. Certification Roadmap, Laboratory Testing Schedule, Statutory Fees & Approval
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                Review the stage-by-stage laboratory testing and certification milestone roadmap with official evidence citations before authorizing digital submission.
              </p>

              {/* 1. Laboratory Testing & Milestone Roadmap */}
              <div className="mb-6 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                  Stage-by-Stage Laboratory Testing & Certification Milestone Roadmap:
                </span>
                {(agentData?.fees_and_timeline?.milestone_roadmap || []).map((m, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-navy-900 text-gold-400 text-[10px] font-bold px-2.5 py-0.5 rounded-md">
                          {m.day_range}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-navy-900">{m.stage}</h4>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{m.description}</p>
                    </div>
                    <span className="text-[11px] bg-slate-200/80 text-slate-700 px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap self-start sm:self-auto">
                      👤 {m.responsible}
                    </span>
                  </div>
                ))}
              </div>

              {/* 2. Itemized Fee Breakdown Card */}
              <div className="mb-6 bg-gradient-to-br from-navy-950 to-navy-900 rounded-2xl p-5 text-white shadow-xl">
                <span className="text-xs text-gold-400 font-bold uppercase tracking-wider block mb-3">
                  Statutory BIS Fee Breakdown (Schedule-VII)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-slate-400 block mb-1">Application Fee</span>
                    <span className="text-base font-bold text-white">₹1,000</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-slate-400 block mb-1">Pre-Audit & Lab Testing</span>
                    <span className="text-base font-bold text-white">₹11,500</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-slate-400 block mb-1">Marking License Fee</span>
                    <span className="text-base font-bold text-white">₹1,000</span>
                  </div>
                  <div className="bg-gold-400/20 p-3 rounded-xl border border-gold-400/30">
                    <span className="text-gold-300 block mb-1 font-bold">Total Statutory Amount</span>
                    <span className="text-lg font-extrabold text-gold-400">₹13,500</span>
                  </div>
                </div>
              </div>

              {/* 3. Official Dataset Evidence Citations */}
              <div className="mb-6 p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1.5">
                <span className="font-bold flex items-center gap-1.5 text-blue-950">
                  <Layers size={14} /> Grounded Evidence Datasets Used by Agents:
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="bg-white border border-blue-300 px-2.5 py-1 rounded-md font-medium text-[11px]">
                    📄 standards.json ({agentData?.standards?.standard_number || 'IS 2347'})
                  </span>
                  <span className="bg-white border border-blue-300 px-2.5 py-1 rounded-md font-medium text-[11px]">
                    📜 schemes.json ({agentData?.standards?.scheme || 'Scheme-I'})
                  </span>
                  <span className="bg-white border border-blue-300 px-2.5 py-1 rounded-md font-medium text-[11px]">
                    🏢 labs.json ({selectedLab?.name || 'Accredited Lab'})
                  </span>
                  <span className="bg-white border border-blue-300 px-2.5 py-1 rounded-md font-medium text-[11px]">
                    🌐 bis_services.json (Manak Online Direct Portal)
                  </span>
                </div>
              </div>

              {/* 4. Human-in-the-Loop (HITL) Review & Approval Gate */}
              <div className="p-5 rounded-2xl bg-amber-50/80 border-2 border-amber-300 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <ShieldAlert size={16} className="text-amber-700" /> Human-in-the-Loop Review & Authorization Gate
                  </span>
                  <span className="text-[10px] font-mono bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">
                    {agentData?.human_approval_gate?.approval_token || 'HITL-TOKEN-77F82A9C1'}
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 text-xs text-slate-800 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={humanApproved}
                      onChange={e => setHumanApproved(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-navy-900 focus:ring-navy-500"
                    />
                    <span>
                      I confirm that factory address, machinery records, testing equipment calibrations, and sample batch allocations have been verified by human authority.
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Authorized Factory Signatory Name</label>
                    <input
                      type="text"
                      value={signatoryName}
                      onChange={e => setSignatoryName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Simulated Treasury Payment Gateway</label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium"
                    >
                      <option>UPI / BharatKosh Treasury Portal</option>
                      <option>Corporate NetBanking (SBI / HDFC / ICICI)</option>
                      <option>NEFT / RTGS Treasury Challan</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                >
                  <ArrowLeft size={16} className="inline mr-1" /> Back
                </button>
                <button
                  onClick={handleApproveAndSubmit}
                  disabled={submitting || !humanApproved}
                  className="btn-primary px-8 py-3.5 text-sm font-extrabold flex items-center gap-2 bg-gradient-to-r from-navy-900 to-blue-900 shadow-lg"
                >
                  {submitting ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} className="text-gold-400" />}
                  {submitting ? 'Submitting...' : 'Approve & Submit Official Application'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── STEP 5: Official Certification Approval & Laboratory Testing Dossier ─ */}
        {step === 5 && report && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-2xl relative overflow-hidden">
              
              {/* Approval Header Banner */}
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-700 -mx-6 sm:-mx-10 -mt-6 sm:-mt-10 p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <Award size={28} className="text-white" />
                  </div>
                  <div>
                    <span className="bg-white/20 text-white text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
                      Application Approved & Registered
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black mt-1">Application Successfully Approved & Registered for Laboratory Testing</h2>
                    <p className="text-emerald-100 text-xs mt-0.5">{report.approval_notice}</p>
                  </div>
                </div>
                <button
                  onClick={() => window.print()}
                  className="bg-white hover:bg-slate-100 text-navy-900 text-xs font-bold px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 flex-shrink-0"
                >
                  <Printer size={15} /> Print Official Certificate
                </button>
              </div>

              {/* ─── Prominent Middle Confirmation Card ─── */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border-2 border-emerald-400 rounded-3xl p-6 sm:p-7 mb-8 text-center shadow-md">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
                  <CheckCircle size={32} />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-navy-950 mb-1.5">
                  Successfully Approved Your Application!
                </h3>
                <p className="text-sm font-semibold text-emerald-800 max-w-2xl mx-auto mb-3">
                  Laboratory Test Results & Final Certification Certificate will be shared after checking the lab test results and conformity verification.
                </p>
                <div className="inline-flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-emerald-300 text-xs font-bold text-navy-900 shadow-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  Testing Slot Confirmed: {report.lab_booking.slot_date} ({report.lab_booking.slot_time}) • {report.lab_booking.lab_name}
                </div>
              </div>

              {/* Certificate Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block mb-1">Application Tracking ID</span>
                  <span className="font-mono font-bold text-navy-900 text-sm sm:text-base">{report.application_id}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block mb-1">Cryptographic Transaction Hash</span>
                  <span className="font-mono font-bold text-navy-900 text-xs sm:text-sm truncate block">{report.payment_receipt.transaction_id}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block mb-1">Status & Next Milestone</span>
                  <span className="font-bold text-emerald-700 text-xs sm:text-sm">Lab Sample Testing in Progress</span>
                </div>
              </div>

              {/* Technical Specifications Summary */}
              <div className="border border-slate-200 rounded-2xl p-5 mb-6 space-y-4">
                <h3 className="font-bold text-sm text-navy-900 uppercase tracking-wider border-b border-slate-200 pb-2">
                  Technical Compliance & Testing Dossier
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Product Name & Standard</span>
                    <span className="font-bold text-slate-800">{report.product_details.name} ({report.product_details.standard_number})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Certification Scheme</span>
                    <span className="font-bold text-slate-800">{report.product_details.scheme}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Manufacturing Factory Address</span>
                    <span className="font-bold text-slate-800">{report.manufacturer_details.factory_address}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Accredited Testing Laboratory</span>
                    <span className="font-bold text-slate-800">{report.lab_booking.lab_name} (Slot: {report.lab_booking.slot_date})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Authorized Signatory</span>
                    <span className="font-bold text-slate-800">{report.signed_by}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Statutory Amount Settled</span>
                    <span className="font-bold text-emerald-700">₹{report.payment_receipt.amount_paid} ({report.payment_receipt.payment_status})</span>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
                <div className="text-xs text-slate-500">
                  <span>National BIS Helpline: <strong>1800-11-4070</strong> (Toll Free)</span>
                </div>
                <button
                  onClick={() => { setStep(1); setReport(null); }}
                  className="btn-primary px-6 py-2.5 text-xs font-bold"
                >
                  Start New Application
                </button>
              </div>

            </div>
          </motion.div>
        )}

      </div>
    </div>
  )
}
