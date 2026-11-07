import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, MapPin, Clock, CalendarDays, History } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from 'date-fns';
import AnimatedSection from '../../components/AnimatedSection';
import GlassCard from '../../components/GlassCard';
import { clsx } from 'clsx';

export default function MahasiswaSchedule() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    api.get('/api/schedules/student/my')
      .then((res) => setSchedules(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const onDateClick = (day) => setSelectedDate(day);

  const DAY_TO_WEEKDAY = { Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5 };

  const getSchedulesForDay = (day) => {
    const dayOfWeek = day.getDay(); // 0=Sun,1=Mon,...,6=Sat
    return schedules.filter(s => {
      const scheduleWeekday = DAY_TO_WEEKDAY[s.day];
      if (scheduleWeekday === undefined) return false;

      // Check if this calendar day matches the schedule's weekday
      const weekdayMatch = dayOfWeek === scheduleWeekday;

      // Check if there's an override replacement on this exact date
      const dayStr = format(day, 'yyyy-MM-dd');
      const hasOverrideOnThisDay = s.overrides?.some(
        o => format(new Date(o.replacement_date), 'yyyy-MM-dd') === dayStr
      );

      // Check if this day is cancelled by an override (original_date matches)
      const isCancelledDay = s.overrides?.some(
        o => format(new Date(o.original_date), 'yyyy-MM-dd') === dayStr
      );

      if (hasOverrideOnThisDay) return true;
      if (isCancelledDay) return false;
      return weekdayMatch;
    });
  };

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-[var(--text-1)] capitalize">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 bg-[var(--surface2)] hover:bg-[var(--border)] rounded-xl text-[var(--text-1)] transition-colors"><ChevronLeft size={18} /></button>
          <button onClick={nextMonth} className="p-2 bg-[var(--surface2)] hover:bg-[var(--border)] rounded-xl text-[var(--text-1)] transition-colors"><ChevronRight size={18} /></button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentDate);
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center text-xs font-bold text-[var(--text-3)] pb-2 uppercase tracking-widest">
          {format(addDays(startDate, i), 'EEE')}
        </div>
      );
    }
    return <div className="grid grid-cols-7 mb-2">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    let idx = 0;
    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const sForDay = getSchedulesForDay(cloneDay);
        const hasSchedule = sForDay.length > 0;
        const isSelected = isSameDay(day, selectedDate);
        const isCurrentMonth = isSameMonth(day, monthStart);

        days.push(
          <div
            key={day}
            onClick={() => onDateClick(cloneDay)}
            className={clsx(
              "min-h-[90px] p-2 sm:p-3 cursor-pointer transition-all duration-200 border relative group",
              isSelected ? "border-[var(--accent)] bg-[var(--accent-bg)] shadow-[inset_0_0_0_1px_var(--accent)] z-10" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface2)]",
              !isCurrentMonth && "opacity-40",
              // border collapsing trick (simplified)
              "ml-[-1px] mt-[-1px]"
            )}
          >
            <div className={clsx("text-right font-semibold text-sm mb-1.5", isSelected ? "text-[var(--accent)]" : "text-[var(--text-2)]")}>
              {format(day, 'd')}
            </div>
            {hasSchedule && (
              <div className="flex flex-col gap-1">
                {sForDay.slice(0, 2).map((sched, jdx) => (
                  <div key={jdx} className="bg-[var(--surface2)] group-hover:bg-[var(--border)] border border-[var(--border2)] text-[var(--text-1)] text-[10px] font-medium px-1.5 py-0.5 rounded truncate transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] inline-block mr-1.5"></span>
                    {sched.course_name}
                  </div>
                ))}
                {sForDay.length > 2 && (
                  <div className="text-[10px] text-[var(--text-3)] font-bold px-1 py-0.5">+{sForDay.length - 2} lagi</div>
                )}
              </div>
            )}
          </div>
        );
        day = addDays(day, 1);
        idx++;
      }
      rows.push(
        <div className="grid grid-cols-7" key={day}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="flex flex-col pt-1 pl-1">{rows}</div>;
  };

  const selectedDaySchedules = getSchedulesForDay(selectedDate);

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <AnimatedSection delay={0.1} className="mb-8">
          <h1 className="page-title">Jadwal Kalender</h1>
          <p className="page-sub">Klik pada tanggal kalender unthuk melihat rincian kelas</p>
        </AnimatedSection>

        <div className="flex flex-col xl:flex-row gap-8 items-start">
          {/* Calendar Box */}
          <AnimatedSection delay={0.2} className="w-full xl:flex-[2]">
            <GlassCard className="p-6 md:p-8 relative z-0">
              {renderHeader()}
              {renderDays()}
              {loading ? <div className="empty-state py-20">Memuat kalender...</div> : renderCells()}
            </GlassCard>
          </AnimatedSection>

          {/* Details Box */}
          <div className="w-full xl:flex-[1] flex flex-col gap-5 sticky top-8">
            <AnimatedSection delay={0.3}>
              <GlassCard className="p-6 border-t-4 border-t-[var(--accent)] bg-[var(--surface2)] shadow-sm">
                <div className="text-xl font-bold text-[var(--text-1)] mb-1 capitalize">{format(selectedDate, 'EEEE')}</div>
                <div className="text-sm font-bold text-[var(--accent)]">{format(selectedDate, 'dd MMMM yyyy')}</div>
              </GlassCard>
            </AnimatedSection>

            <div className="flex flex-col gap-4">
              <AnimatePresence mode="popLayout">
                {selectedDaySchedules.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  >
                    <GlassCard className="p-8 text-center flex flex-col items-center justify-center min-h-[200px]">
                      <div className="w-12 h-12 rounded-full bg-[var(--surface2)] flex items-center justify-center text-[var(--text-3)] mb-4">
                        <CalendarDays size={20} />
                      </div>
                      <div className="text-[var(--text-2)] font-semibold">Tidak ada jadwal kelas</div>
                      <div className="text-[var(--text-3)] text-xs mt-1">Anda bisa beristirahat hari ini!</div>
                    </GlassCard>
                  </motion.div>
                ) : (
                  selectedDaySchedules.map((schedule, i) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.1 }}
                      key={schedule.id}
                    >
                      <GlassCard className="p-6 relative overflow-hidden group hover:border-[var(--accent)] transition-colors">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex justify-between items-start mb-4 gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-[var(--text-1)] text-base mb-1 leading-snug">{schedule.course_name}</div>
                            <div className="text-xs font-bold text-[var(--text-3)] tracking-wider">CODE: {schedule.course_code || '—'}</div>
                          </div>
                          <span className="badge bg-[var(--surface2)] text-[var(--text-1)] border border-[var(--border2)] uppercase tracking-wider text-[10px] font-bold shrink-0">{schedule.day}</span>
                        </div>
                        
                        <div className="flex flex-col gap-2.5 mt-4 pt-4 border-t border-[var(--border)]">
                          <div className="flex items-center gap-3 text-sm font-medium text-[var(--text-2)]">
                            <div className="w-7 h-7 rounded-lg bg-[var(--surface2)] flex items-center justify-center text-[var(--text-3)] shrink-0">
                              <Clock size={14} />
                            </div>
                            <span>{schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm font-medium text-[var(--text-2)]">
                            <div className="w-7 h-7 rounded-lg bg-[var(--surface2)] flex items-center justify-center text-[var(--text-3)] shrink-0">
                              <MapPin size={14} />
                            </div>
                            <span>{schedule.room}</span>
                          </div>
                        </div>

                        {schedule.overrides?.length > 0 && (
                          <div className="mt-5 p-4 bg-[var(--amber-bg)] border border-[var(--amber)] rounded-xl">
                            <div className="text-xs font-bold text-[var(--amber)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <History size={12} /> Perubahan Jadwal
                            </div>
                            <div className="space-y-2">
                              {schedule.overrides.map(o => (
                                <div key={o.id} className="text-xs font-medium text-[var(--text-2)] flex flex-col gap-1">
                                  <span className="text-[var(--text-1)]">{new Date(o.replacement_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                  <span className="opacity-80 font-semibold">{o.new_start_time.slice(0,5)} - {o.new_end_time.slice(0,5)} di <b>{o.new_room}</b></span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </GlassCard>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
