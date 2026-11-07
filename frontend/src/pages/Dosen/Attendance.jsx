import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import AnimatedSection from '../../components/AnimatedSection';
import GlassCard from '../../components/GlassCard';
import { Camera, Power, X, PlusCircle, UserCheck, Edit3, Trash2, Smile } from 'lucide-react';
import { clsx } from 'clsx';

// ── MediaPipe FaceMesh loader (CDN, pinned versions) ────────
const MEDIAPIPE_CAMERA_UTILS_VERSION = '0.3.1675466862';
const MEDIAPIPE_FACE_MESH_VERSION = '0.4.1633559619';

let faceMeshInstance = null;
async function getFaceMesh() {
  if (faceMeshInstance) return faceMeshInstance;
  // Load MediaPipe via CDN scripts (sequential to avoid race condition)
  if (!window.FaceMesh) {
    await new Promise((resolve, reject) => {
      const s1 = document.createElement('script');
      s1.src = `https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@${MEDIAPIPE_CAMERA_UTILS_VERSION}/camera_utils.js`;
      s1.crossOrigin = 'anonymous';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${MEDIAPIPE_FACE_MESH_VERSION}/face_mesh.js`;
        s2.crossOrigin = 'anonymous';
        s2.onload = resolve;
        s2.onerror = reject;
        document.head.appendChild(s2);
      };
      s1.onerror = reject;
      document.head.appendChild(s1);
    });
  }
  const fm = new window.FaceMesh({
    locateFile: (f) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${MEDIAPIPE_FACE_MESH_VERSION}/${f}`,
  });
  fm.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  faceMeshInstance = fm;
  return fm;
}

// ── Smile detection via mouth landmarks ─────────────────────
// MediaPipe 468-point face mesh landmark indices
const MOUTH_TOP    = 13;   // upper lip center
const MOUTH_BOTTOM = 14;   // lower lip center
const MOUTH_LEFT   = 61;   // left mouth corner
const MOUTH_RIGHT  = 291;  // right mouth corner
const LEFT_EYE_OUTER  = 33;   // left eye outer corner
const RIGHT_EYE_OUTER = 263;  // right eye outer corner
const NOSE_TIP     = 1;    // nose tip for vertical reference

// Temporal smoothing: butuh N frame berturut-turut terdeteksi senyum
const SMILE_FRAME_THRESHOLD = 5; // harus 5 frame berturut-turut
let smileFrameCount = 0;

function detectSmile(landmarks) {
  // Tidak ada wajah terdeteksi → reset counter, return false
  if (!landmarks || landmarks.length === 0) {
    smileFrameCount = 0;
    return false;
  }
  const lm = landmarks[0];
  // MediaPipe FaceMesh harus punya 468 landmarks
  if (!lm || lm.length < 468) {
    smileFrameCount = 0;
    return false;
  }

  const top    = lm[MOUTH_TOP];
  const bottom = lm[MOUTH_BOTTOM];
  const left   = lm[MOUTH_LEFT];
  const right  = lm[MOUTH_RIGHT];
  const eyeL   = lm[LEFT_EYE_OUTER];
  const eyeR   = lm[RIGHT_EYE_OUTER];
  const nose   = lm[NOSE_TIP];

  // Validasi: semua landmark harus punya koordinat valid
  if (!top || !bottom || !left || !right || !eyeL || !eyeR || !nose) {
    smileFrameCount = 0;
    return false;
  }

  // Face width (eye-to-eye) harus cukup besar → wajah benar-benar ada di frame
  const faceWidth = Math.abs(eyeR.x - eyeL.x);
  if (faceWidth < 0.08) {
    smileFrameCount = 0;
    return false; // wajah terlalu kecil / jauh
  }

  const mouthWidth  = Math.abs(right.x - left.x);
  const mouthHeight = Math.abs(bottom.y - top.y);

  // Smile ratio: mouth width relative to face width
  // Neutral: ~0.45-0.55, Smile: >0.62
  const smileRatio = mouthWidth / faceWidth;

  // Mouth Aspect Ratio (MAR): height/width
  // Neutral closed mouth: ~0.05-0.15, Open smile: >0.30
  const mar = mouthHeight / (mouthWidth + 1e-6);

  // Corner lift: sudut bibir naik relatif ke hidung
  // Senyum = corners naik (y lebih kecil = lebih atas di frame)
  const avgCornerY = (left.y + right.y) / 2;
  const noseMouthDist = Math.abs(nose.y - avgCornerY);
  const cornerLiftRatio = noseMouthDist / faceWidth;
  // Neutral: ~0.25-0.35, Smile: <0.22 (corners naik mendekati hidung)

  // Deteksi senyum: harus memenuhi kriteria ketat
  const isSmiling = (
    // Senyum lebar (bibir melebar signifikan)
    smileRatio > 0.62 ||
    // Mulut terbuka lebar (tertawa)
    mar > 0.35 ||
    // Kombinasi: bibir agak lebar + mulut agak terbuka
    (smileRatio > 0.56 && mar > 0.20)
  );

  if (isSmiling) {
    smileFrameCount++;
  } else {
    smileFrameCount = 0;
  }

  // Hanya return true jika terdeteksi senyum selama N frame berturut-turut
  return smileFrameCount >= SMILE_FRAME_THRESHOLD;
}

// ── Main component ──────────────────────────────────────────
export default function DosenAttendance() {
  const webcamRef   = useRef(null);
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const cooldownRef = useRef(false);   // anti-spam 3 detik setelah capture
  const processingRef = useRef(false); // ref version to avoid stale closure
  const startTimeoutRef = useRef(null); // untuk clearTimeout saat stopCamera

  const [schedules,        setSchedules]        = useState([]);
  const [sessions,         setSessions]          = useState([]);
  const [selectedSchedule, setSelectedSchedule]  = useState('');
  const [activeSessionId,  setActiveSessionId]   = useState(null);
  const [isCameraActive,   setIsCameraActive]    = useState(false);
  const [log,              setLog]               = useState([]);
  const [liveStatus,       setLiveStatus]        = useState('');
  const [smileDetected,    setSmileDetected]     = useState(false);
  const [loading,          setLoading]           = useState(true);
  const [processing,       setProcessing]        = useState(false);

  // Override modal
  const [showOverrideModal,  setShowOverrideModal]  = useState(false);
  const [editingSchedule,    setEditingSchedule]    = useState(null);
  const [editingOverrideId,  setEditingOverrideId]  = useState(null);
  const [overrideForm,       setOverrideForm]       = useState({
    original_date: '', replacement_date: '',
    new_start_time: '', new_end_time: '', new_room: '', reason: '',
  });

  // ── Data fetching ─────────────────────────────────────────
  const refreshData = useCallback(async () => {
    try {
      const [schRes, sesRes] = await Promise.all([
        api.get('/api/schedules/my'),
        api.get('/api/attendance/sessions'),
      ]);
      setSchedules(schRes.data || []);
      setSessions(sesRes.data || []);
      const open = (sesRes.data || []).find((s) => s.status === 'open');
      if (open) setActiveSessionId(open.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  // ── Add to live log ───────────────────────────────────────
  const addLog = useCallback((entry) => {
    setLog((prev) => {
      const key = `${entry.nim}_${activeSessionId}`;
      if (prev.find((p) => p._key === key)) return prev;
      return [{
        ...entry,
        _key: key,
        time: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        }),
      }, ...prev];
    });
  }, [activeSessionId]);

  // ── Capture & recognize ───────────────────────────────────
  const captureAndRecognize = useCallback(async (sessionId) => {
    // processingRef sudah di-set true oleh onResults sebelum memanggil fungsi ini
    if (!webcamRef.current || cooldownRef.current) {
      processingRef.current = false;
      return;
    }

    const imgSrc = webcamRef.current.getScreenshot();
    if (!imgSrc) {
      processingRef.current = false;
      return;
    }

    cooldownRef.current = true;
    setProcessing(true);
    setLiveStatus('🔍 Memproses wajah...');

    try {
      const res = await api.post('/api/face/recognize', {
        image: imgSrc,
        session_id: sessionId,
      });
      const d = res.data;

      if (!d.recognized) {
        setLiveStatus(d.message || '❌ Wajah tidak dikenali');
      } else if (d.rejected) {
        setLiveStatus(`⚠ ${d.name}: Tidak terdaftar di MK ini`);
      } else if (d.already_absent) {
        setLiveStatus(`⚠ ${d.name} sudah terekam di sesi ini`);
      } else {
        setLiveStatus(`✓ ${d.name} — ${d.status === 'hadir' ? 'Hadir' : 'Terlambat'}`);
        addLog(d);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Gagal menghubungi server';
      setLiveStatus(`❌ Error: ${msg}`);
    } finally {
      processingRef.current = false;
      setProcessing(false);
      // Cooldown 3 detik sebelum bisa capture lagi
      setTimeout(() => {
        cooldownRef.current = false;
        setLiveStatus('😊 Senyum untuk absen...');
      }, 3000);
    }
  }, [addLog]);

  // ── MediaPipe smile detection loop ───────────────────────
  const startSmileDetection = useCallback((sessionId) => {
    let fm = null;
    let active = true;

    const init = async () => {
      try {
        setLiveStatus('⏳ Memuat model deteksi wajah...');
        fm = await getFaceMesh();
        setLiveStatus('😊 Senyum untuk absen...');
      } catch (err) {
        console.error('FaceMesh load error:', err);
        setLiveStatus('❌ Gagal memuat model deteksi wajah. Cek koneksi internet.');
        return;
      }

      fm.onResults((results) => {
        if (!active) return;
        const lms = results.multiFaceLandmarks;
        const isSmiling = detectSmile(lms);
        setSmileDetected(isSmiling);

        if (isSmiling && !cooldownRef.current && !processingRef.current) {
          processingRef.current = true; // set SEBELUM async call untuk cegah double-fire
          captureAndRecognize(sessionId);
        }
      });

      const sendFrame = async () => {
        if (!active) return;
        if (webcamRef.current?.video?.readyState === 4) {
          await fm.send({ image: webcamRef.current.video });
        }
        rafRef.current = requestAnimationFrame(sendFrame);
      };
      sendFrame();
    };

    init().catch(console.error);

    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [captureAndRecognize]);

  // ── Camera controls ───────────────────────────────────────
  const stopCamera = useCallback(() => {
    setIsCameraActive(false);
    setSmileDetected(false);
    setLiveStatus('');
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }
  }, []);

  const startCamera = useCallback((sessionId) => {
    stopCamera();
    setIsCameraActive(true);
    setLiveStatus('😊 Senyum untuk absen...');
    // Delay sedikit agar webcam siap
    startTimeoutRef.current = setTimeout(() => startSmileDetection(sessionId), 1500);
  }, [stopCamera, startSmileDetection]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Session controls ──────────────────────────────────────
  const handleOpenSession = async () => {
    if (!selectedSchedule) return;
    try {
      const r = await api.post('/api/attendance/sessions/open', {
        schedule_id: Number(selectedSchedule),
      });
      const sessionId = r.data?.session_id;
      if (sessionId) {
        setActiveSessionId(sessionId);
        setLog([]);
        await refreshData();
        startCamera(sessionId);
      }
    } catch (err) {
      alert(err?.response?.data?.detail || 'Gagal membuka sesi');
    }
  };

  const handleCloseSession = async () => {
    if (!activeSessionId) return;
    try {
      await api.post(`/api/attendance/sessions/${activeSessionId}/close`);
      stopCamera();
      setActiveSessionId(null);
      await refreshData();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Gagal menutup sesi');
    }
  };

  // ── Override modal helpers ────────────────────────────────
  const openOverrideModal = (schedule, override = null) => {
    setEditingSchedule(schedule);
    setEditingOverrideId(override?.id || null);
    setOverrideForm({
      original_date:   override?.original_date   || schedule.upcoming_regular_date || '',
      replacement_date: override?.replacement_date || '',
      new_start_time:  override?.new_start_time  || schedule.start_time,
      new_end_time:    override?.new_end_time    || schedule.end_time,
      new_room:        override?.new_room        || schedule.room,
      reason:          override?.reason          || '',
    });
    setShowOverrideModal(true);
  };

  const handleSaveOverride = async (e) => {
    e.preventDefault();
    if (!editingSchedule) return;
    try {
      if (editingOverrideId) {
        await api.put(`/api/schedules/overrides/${editingOverrideId}`, overrideForm);
      } else {
        await api.post(`/api/schedules/${editingSchedule.id}/overrides`, overrideForm);
      }
      setShowOverrideModal(false);
      setEditingSchedule(null);
      setEditingOverrideId(null);
      await refreshData();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Gagal menyimpan kelas pengganti');
    }
  };

  const handleDeleteOverride = async (overrideId) => {
    if (!confirm('Hapus jadwal pengganti ini?')) return;
    try {
      await api.delete(`/api/schedules/overrides/${overrideId}`);
      await refreshData();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Gagal menghapus');
    }
  };

  // ── Status color ──────────────────────────────────────────
  const statusColor = liveStatus.startsWith('✓')
    ? 'rgba(16,185,129,0.9)'
    : liveStatus.startsWith('⚠') || liveStatus.startsWith('❌')
      ? 'rgba(245,158,11,0.9)'
      : smileDetected
        ? 'rgba(99,102,241,0.9)'
        : 'rgba(0,0,0,0.75)';

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">

        {/* Header */}
        <AnimatedSection delay={0.1}>
          <div className="mb-8">
            <h1 className="page-title">Sesi Absensi Kelas</h1>
            <p className="page-sub">Pilih jadwal → buka sesi → mahasiswa senyum ke kamera untuk absen otomatis</p>
          </div>
        </AnimatedSection>

        {/* Session control */}
        <AnimatedSection delay={0.2}>
          <GlassCard className="mb-6 p-5">
            <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
              <div className="w-full md:w-[60%]">
                <label className="input-label">Pilih Jadwal Kelas</label>
                <select
                  className="select-field"
                  value={selectedSchedule}
                  onChange={(e) => setSelectedSchedule(e.target.value)}
                  disabled={activeSessionId !== null}
                >
                  <option value="">-- Silakan Pilih Jadwal --</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                {!activeSessionId ? (
                  <button
                    className="btn btn-accent w-full md:w-auto"
                    disabled={!selectedSchedule}
                    onClick={handleOpenSession}
                  >
                    <Power size={16} /> Buka Sesi Absensi
                  </button>
                ) : (
                  <>
                    <button
                      className={clsx('btn', isCameraActive ? 'btn-ghost' : 'btn-primary')}
                      onClick={() => isCameraActive ? stopCamera() : startCamera(activeSessionId)}
                    >
                      <Camera size={16} />
                      {isCameraActive ? 'Jeda Kamera' : 'Mulai Kamera'}
                    </button>
                    <button className="btn btn-danger-soft" onClick={handleCloseSession}>
                      <X size={16} /> Akhiri & Kunci Sesi
                    </button>
                  </>
                )}
              </div>
            </div>
          </GlassCard>
        </AnimatedSection>

        {/* Camera + Live Log */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">

          {/* Camera */}
          <div className="lg:col-span-8">
            <AnimatedSection delay={0.3}>
              <GlassCard className="p-0 overflow-hidden border-[var(--border)] relative bg-[#050505]">
                {loading ? (
                  <div className="empty-state py-32">Menginisialisasi...</div>
                ) : !activeSessionId ? (
                  <div className="flex flex-col items-center justify-center py-32 px-6 text-center text-[var(--text-3)] bg-[var(--surface)]">
                    <div className="w-16 h-16 rounded-2xl bg-[var(--surface2)] flex items-center justify-center mb-4">
                      <Camera size={32} className="opacity-50" />
                    </div>
                    <p className="font-semibold text-[var(--text-1)] mb-1">Kamera Tidak Aktif</p>
                    <p className="text-sm">Buka sesi absensi terlebih dahulu.</p>
                  </div>
                ) : (
                  <div className="relative w-full aspect-video bg-black flex items-center justify-center">
                    {isCameraActive ? (
                      <>
                        <Webcam
                          ref={webcamRef}
                          screenshotFormat="image/jpeg"
                          screenshotQuality={0.9}
                          className="w-full object-cover aspect-video"
                          videoConstraints={{ facingMode: 'user' }}
                          mirrored
                        />

                        {/* HUD top-left */}
                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md rounded-lg px-3 py-1.5 flex items-center gap-2 border border-white/10 z-10">
                          <div className="w-2 h-2 rounded-full bg-[var(--green)] animate-ping" />
                          <span className="text-white text-xs font-bold tracking-wider">
                            SESI #{activeSessionId}
                          </span>
                        </div>

                        {/* Smile indicator top-right */}
                        <div className={clsx(
                          'absolute top-4 right-4 px-3 py-1.5 rounded-lg text-xs font-bold border z-10 flex items-center gap-1.5 transition-all duration-200',
                          smileDetected
                            ? 'bg-purple-500/80 border-purple-400 text-white'
                            : 'bg-black/60 border-white/10 text-white/60'
                        )}>
                          <Smile size={14} />
                          {smileDetected ? 'Senyum terdeteksi!' : 'Menunggu senyum...'}
                        </div>

                        {/* Status bar bottom */}
                        {liveStatus && (
                          <div
                            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white text-sm font-bold shadow-2xl backdrop-blur-md z-10 flex items-center gap-2 border border-white/20 whitespace-nowrap transition-all duration-300"
                            style={{ background: statusColor }}
                          >
                            {liveStatus}
                          </div>
                        )}

                        {/* Processing overlay */}
                        {processing && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
                            <div className="bg-black/70 rounded-2xl px-6 py-4 text-white font-bold flex items-center gap-3">
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Memproses...
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-[var(--text-3)]">
                        <Camera size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">Klik "Mulai Kamera" untuk mengaktifkan deteksi senyum.</p>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            </AnimatedSection>

            {/* Instruction box */}
            {isCameraActive && (
              <AnimatedSection delay={0.35}>
                <div className="mt-3 p-3 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-sm text-[var(--text-2)] flex items-center gap-3">
                  <Smile size={18} className="text-purple-400 shrink-0" />
                  <span>
                    Minta mahasiswa <b>menghadap kamera</b> dan <b>senyum</b> — sistem akan otomatis capture dan proses absensi.
                    Cooldown <b>3 detik</b> setelah setiap capture.
                  </span>
                </div>
              </AnimatedSection>
            )}
          </div>

          {/* Live Log */}
          <div className="lg:col-span-4 max-h-[600px] flex flex-col">
            <AnimatedSection delay={0.4} className="h-full">
              <GlassCard className="p-0 h-full flex flex-col">
                <div className="card-header border-b border-[var(--border)] px-5 py-4 flex justify-between items-center bg-[var(--surface2)]">
                  <div className="flex items-center gap-2">
                    <UserCheck size={16} className="text-[var(--accent)]" />
                    <span className="font-bold text-[var(--text-1)] text-sm uppercase tracking-wide">Live Log</span>
                  </div>
                  <span className="badge bg-[var(--accent-bg)] text-[var(--accent)]">{log.length} Terekam</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--surface)] p-2">
                  {log.length === 0 ? (
                    <div className="empty-state h-full flex flex-col justify-center">
                      Belum ada absensi terekam
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {log.map((entry, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface2)] border border-[var(--border2)] hover:border-[var(--accent)] transition-colors animate-in fade-in slide-in-from-right-4 duration-300"
                        >
                          <div className="w-10 h-10 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text-1)] flex items-center justify-center font-bold shadow-inner">
                            {entry.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-[var(--text-1)] truncate">{entry.name}</p>
                            <p className="text-[11px] font-medium text-[var(--text-3)] uppercase tracking-wider">{entry.nim}</p>
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-1">
                            <span className={clsx(
                              'badge py-0.5 px-2 text-[10px]',
                              entry.status === 'hadir' ? 'badge-green' : 'badge-amber'
                            )}>
                              {entry.status === 'hadir' ? 'Hadir' : 'Terlambat'}
                            </span>
                            <span className="text-[10px] font-bold text-[var(--text-3)] font-mono">{entry.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            </AnimatedSection>
          </div>
        </div>

        {/* Schedule Override Table */}
        <AnimatedSection delay={0.5}>
          <GlassCard className="p-0 border-[var(--blue-bg)] mb-6">
            <div className="card-header border-b border-[var(--border)] px-6 py-4">
              <span className="card-title">Manajemen Jadwal & Kelas Pengganti</span>
            </div>
            {loading ? (
              <div className="empty-state py-12">Memuat jadwal...</div>
            ) : schedules.length === 0 ? (
              <div className="empty-state py-12">Belum ada jadwal dialokasikan ke Anda</div>
            ) : (
              <div className="table-wrap custom-scrollbar rounded-none border-none">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mata Kuliah</th>
                      <th>Jadwal Utama</th>
                      <th>Status Perubahan</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((schedule) => (
                      <tr key={schedule.id}>
                        <td className="align-top">
                          <div className="font-bold text-[var(--text-1)] text-sm">{schedule.course_name}</div>
                          <div className="text-xs text-[var(--text-3)] uppercase font-semibold mt-1">Reguler</div>
                        </td>
                        <td className="align-top">
                          <div className="text-sm font-medium text-[var(--text-2)]">
                            {schedule.day} • {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                          </div>
                          <div className="text-xs text-[var(--text-3)]">R. {schedule.room}</div>
                        </td>
                        <td className="align-top">
                          {!schedule.overrides?.length ? (
                            <span className="text-[12px] font-medium text-[var(--text-3)]">Tidak ada penggantian</span>
                          ) : (
                            <div className="flex flex-col gap-3">
                              {schedule.overrides.map((ov) => (
                                <div key={ov.id} className="bg-[var(--surface2)] border border-[var(--border2)] rounded-xl p-3 relative">
                                  <div className="absolute top-3 right-3 flex gap-1">
                                    <button className="p-1.5 text-[var(--text-3)] hover:text-blue-500 rounded bg-[var(--surface)]" onClick={() => openOverrideModal(schedule, ov)}>
                                      <Edit3 size={12} />
                                    </button>
                                    <button className="p-1.5 text-[var(--text-3)] hover:text-red-500 rounded bg-[var(--surface)]" onClick={() => handleDeleteOverride(ov.id)}>
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                  <div className="badge badge-amber mb-2 w-max text-[10px]">Dialihkan</div>
                                  <div className="text-xs font-medium text-[var(--text-1)] leading-relaxed">
                                    {new Date(ov.replacement_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}<br />
                                    {ov.new_start_time.slice(0, 5)} - {ov.new_end_time.slice(0, 5)} • R. {ov.new_room}
                                  </div>
                                  {ov.reason && <div className="mt-1 text-[11px] text-[var(--text-3)] italic">Ket: {ov.reason}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="align-top text-right">
                          <button className="btn btn-ghost btn-sm border-[var(--border)]" onClick={() => openOverrideModal(schedule)}>
                            <PlusCircle size={14} /> Atur Pengganti
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </AnimatedSection>

        {/* Override Modal */}
        {showOverrideModal && editingSchedule && (
          <div className="modal-backdrop bg-black/80 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setShowOverrideModal(false)}>
            <AnimatedSection className="w-full max-w-[500px]">
              <GlassCard className="p-8 border border-[var(--border2)]">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-[var(--text-1)]">
                    {editingOverrideId ? 'Edit Perubahan Jadwal' : 'Buat Kelas Pengganti'}
                  </h2>
                  <button onClick={() => setShowOverrideModal(false)} className="text-[var(--text-3)] hover:text-[var(--text-1)]">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleSaveOverride} className="space-y-5">
                  <div className="bg-[var(--surface2)] p-4 rounded-xl border border-[var(--border)]">
                    <p className="text-xs text-[var(--text-3)] uppercase font-bold tracking-wider mb-1">Mata Kuliah</p>
                    <p className="text-sm font-semibold text-[var(--text-1)]">{editingSchedule.course_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">Tgl. Asal (Ditiadakan)</label>
                      <input type="date" className="input bg-[var(--bg)]" value={overrideForm.original_date} onChange={(e) => setOverrideForm({ ...overrideForm, original_date: e.target.value })} required />
                    </div>
                    <div>
                      <label className="input-label">Tgl. Baru (Pengganti)</label>
                      <input type="date" className="input border-[var(--accent)] bg-[var(--accent-bg)]" value={overrideForm.replacement_date} onChange={(e) => setOverrideForm({ ...overrideForm, replacement_date: e.target.value })} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">Jam Mulai Baru</label>
                      <input type="time" className="input bg-[var(--bg)]" value={overrideForm.new_start_time} onChange={(e) => setOverrideForm({ ...overrideForm, new_start_time: e.target.value })} required />
                    </div>
                    <div>
                      <label className="input-label">Jam Selesai Baru</label>
                      <input type="time" className="input bg-[var(--bg)]" value={overrideForm.new_end_time} onChange={(e) => setOverrideForm({ ...overrideForm, new_end_time: e.target.value })} required />
                    </div>
                  </div>
                  <div>
                    <label className="input-label">Ruangan Baru</label>
                    <input type="text" className="input bg-[var(--bg)]" value={overrideForm.new_room} onChange={(e) => setOverrideForm({ ...overrideForm, new_room: e.target.value })} required />
                  </div>
                  <div>
                    <label className="input-label">Alasan (Opsional)</label>
                    <textarea className="input bg-[var(--bg)] resize-none" value={overrideForm.reason} onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })} rows={2} placeholder="Misal: Dosen berhalangan dinas..." />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button type="submit" className="btn btn-accent flex-1 justify-center py-3">
                      {editingOverrideId ? 'Update Jadwal' : 'Simpan & Publikasikan'}
                    </button>
                    <button type="button" className="btn btn-ghost border-[var(--border)] px-6" onClick={() => setShowOverrideModal(false)}>
                      Batal
                    </button>
                  </div>
                </form>
              </GlassCard>
            </AnimatedSection>
          </div>
        )}

      </div>
    </div>
  );
}
