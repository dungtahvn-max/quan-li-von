/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Moon, Sun, LogIn, Users, DollarSign, Calendar, 
  CheckCircle2, Clock, ChevronRight, ShieldCheck,
  ArrowRightCircle, CheckSquare, Square, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'USER' | null;

interface Group {
  id: number;
  name: string;
  admin_code: string;
  user_code: string;
  monthly_amount: number;
  start_date: string;
  secondary_password?: string;
  current_tracking_month?: string;
}

interface Member {
  id: number;
  group_id: number;
  name: string;
  receive_date?: string;
  note_amount: number;
  total_received: number;
  is_paid: string;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [role, setRole] = useState<Role>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [showSettleModal, setShowSettleModal] = useState<Member | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [settleData, setSettleData] = useState({ date: '', note: 0, password: '' });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth', { code: accessCode });
      const data = res.data;
      setRole(data.role);
      if (data.role === 'SUPER_ADMIN') {
        setGroups(data.groups);
      } else {
        setSelectedGroup(data.group);
        fetchMembers(data.group.id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (groupId: number) => {
    const res = await axios.get(`/api/group/${groupId}/members`);
    setMembers(res.data);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount * 1000) + ' đ';
  };

  const receivedMembers = useMemo(() => 
    members.filter(m => m.receive_date).sort((a, b) => {
      // Sort by date MM/YYYY
      const [ma, ya] = a.receive_date!.split('/').map(Number);
      const [mb, yb] = b.receive_date!.split('/').map(Number);
      return (ya * 12 + ma) - (yb * 12 + mb);
    }), [members]);

  const unreceivedMembers = useMemo(() => 
    members.filter(m => !m.receive_date), [members]);

  const latestReceiver = receivedMembers[receivedMembers.length - 1];

  const handleSettle = async () => {
    if (!showSettleModal) return;
    try {
      await axios.post('/api/settle', {
        groupId: selectedGroup?.id,
        memberId: showSettleModal.id,
        receiveDate: settleData.date || new Date().toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }),
        noteAmount: settleData.note,
        password: settleData.password
      });
      setShowSettleModal(null);
      setSettleData({ date: '', note: 0, password: '' });
      fetchMembers(selectedGroup!.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Lỗi khi chốt vốn');
    }
  };

  const togglePayment = async (memberId: number, currentPaid: boolean) => {
    try {
      await axios.post('/api/payment/toggle', { 
        memberId, 
        isPaid: !currentPaid, 
        groupId: selectedGroup?.id 
      });
      fetchMembers(selectedGroup!.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportReport = () => {
    if (!selectedGroup) return;

    const formatCurrencyReport = (amount: number) => {
      return new Intl.NumberFormat('vi-VN').format(amount * 1000) + ' đ';
    };

    const formatDateToMMYYYY = (date: Date) => {
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      return `${String(m).padStart(2, '0')}/${y}`;
    };

    const parseDate = (dateStr: string) => {
      const parts = dateStr.split('/');
      if (parts.length === 2) {
        return { month: Number(parts[0]), year: Number(parts[1]) };
      }
      // Fallback for ISO strings
      const d = new Date(dateStr);
      return { month: d.getMonth() + 1, year: d.getFullYear() };
    };

    const formatDate = (m: number, y: number) => {
      return `${String(m).padStart(2, '0')}/${y}`;
    };

    const addMonths = (dateStr: string, months: number) => {
      let { month, year } = parseDate(dateStr);
      month += months;
      while (month > 12) {
        month -= 12;
        year += 1;
      }
      while (month < 1) {
        month += 12;
        year -= 1;
      }
      return formatDate(month, year);
    };

    const startDateRaw = selectedGroup.start_date;
    const startDate = startDateRaw.includes('/') ? startDateRaw : formatDateToMMYYYY(new Date(startDateRaw));
    
    const endDate = addMonths(startDate, members.length - 1);
    const currentMonth = formatDateToMMYYYY(new Date());
    const currentNote = latestReceiver?.note_amount || 0;
    const cleanGroupName = selectedGroup.name.split('(')[0].trim();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Báo cáo Dây hụi - ${cleanGroupName}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { text-align: center; color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
          .info-section { background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #e2e8f0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .label { font-weight: bold; color: #64748b; }
          .value { font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
          th { background-color: #f1f5f9; color: #475569; }
          .received { color: #10b981; font-weight: 600; }
          .unreceived { color: #f59e0b; font-weight: 600; }
          .latest-row { background-color: #fef9c3; }
          .footer { margin-top: 40px; text-align: center; font-size: 0.8em; color: #94a3b8; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <h1>BÁO CÁO CHI TIẾT DÂY HỤI</h1>
        
        <div class="info-section">
          <div class="info-grid">
            <div><span class="label">Tên Dây hụi:</span> <span class="value">${cleanGroupName}</span></div>
            <div><span class="label">Tháng hiện tại:</span> <span class="value">${currentMonth}</span></div>
            <div><span class="label">Ngày bắt đầu:</span> <span class="value">${startDate}</span></div>
            <div><span class="label">Ngày kết thúc:</span> <span class="value">${endDate}</span></div>
            <div><span class="label">Số tiền mỗi kỳ:</span> <span class="value">${formatCurrencyReport(selectedGroup.monthly_amount)}</span></div>
            <div><span class="label">Tiền thảo kỳ này:</span> <span class="value">${formatCurrencyReport(currentNote)}</span></div>
          </div>
        </div>

        <h3>1. Danh sách hụi viên đã nhận (${receivedMembers.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Tháng nhận</th>
              <th>Tiền thảo</th>
              <th>Tổng tiền nhận</th>
            </tr>
          </thead>
          <tbody>
            ${receivedMembers.map(m => `
              <tr class="${m.id === latestReceiver?.id ? 'latest-row' : ''}">
                <td>${m.name}</td>
                <td>${m.receive_date}</td>
                <td>${formatCurrencyReport(m.note_amount)}</td>
                <td class="received">${formatCurrencyReport(m.total_received)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3>2. Danh sách hụi viên chưa nhận (${unreceivedMembers.length})</h3>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Họ tên</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            ${unreceivedMembers.map((m, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${m.name}</td>
                <td class="unreceived">Chưa nhận</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Báo cáo được tạo tự động vào lúc ${new Date().toLocaleString('vi-VN')}
        </div>
        
        <div class="no-print" style="margin-top: 20px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer;">In báo cáo</button>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bao-cao-Hui-${cleanGroupName.replace(/\s+/g, '-')}-${currentMonth.replace('/', '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!role) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-orange-50 to-pink-100 transition-colors duration-500`}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/20 backdrop-blur-sm"
        >
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-purple-500 rounded-2xl shadow-lg shadow-purple-200">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">Quản lý Xoay vòng vốn</h1>
          <p className="text-center text-gray-500 mb-8">Vui lòng nhập mã truy cập để tiếp tục</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Mã truy cập..."
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-400 transition-all text-lg font-medium"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}
            <button
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-purple-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Đang xác thực...' : 'Xác thực'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b ${darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-zinc-200'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <h2 className="font-bold text-lg leading-tight">Xoay Vòng Vốn</h2>
              <p className="text-xs opacity-60 font-medium uppercase tracking-wider">{role === 'SUPER_ADMIN' ? 'Tổng quản trị' : 'Thành viên'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {selectedGroup && (role === 'SUPER_ADMIN' || role === 'ADMIN') && (
              <button
                onClick={handleExportReport}
                className={`hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-sm ${darkMode ? 'bg-zinc-800 text-indigo-400 border border-indigo-900/30' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}
              >
                <ArrowRightCircle className="w-4 h-4 rotate-90" />
                Xuất báo cáo
              </button>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2.5 rounded-xl transition-all ${darkMode ? 'bg-zinc-800 text-yellow-400' : 'bg-zinc-100 text-zinc-600'}`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
                      {(role === 'SUPER_ADMIN' || role === 'ADMIN') && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleExportReport}
                            className={`md:hidden p-2.5 rounded-xl transition-all ${darkMode ? 'bg-zinc-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}
                          >
                            <ArrowRightCircle className="w-5 h-5 rotate-90" />
                          </button>
                          <button 
                            onClick={() => { setRole(null); setAccessCode(''); }}
                            className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      {!(role === 'SUPER_ADMIN' || role === 'ADMIN') && (
                        <button 
                          onClick={() => { setRole(null); setAccessCode(''); }}
                          className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Selection for Super Admin */}
        {role === 'SUPER_ADMIN' && (
          <div className="mb-8">
            <label className="block text-sm font-bold mb-2 opacity-60 uppercase tracking-widest">Chọn dây vốn quản lý</label>
            <select 
              className={`w-full p-4 rounded-2xl border-none font-bold text-lg shadow-sm focus:ring-2 focus:ring-purple-400 ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}
              onChange={(e) => {
                const g = groups.find(x => x.id === Number(e.target.value));
                setSelectedGroup(g || null);
                if (g) fetchMembers(g.id);
              }}
            >
              <option value="">-- Chọn dây vốn --</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}

        {selectedGroup && (
          <div className="space-y-8">
            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={`p-6 rounded-3xl shadow-sm border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl"><Users className="w-6 h-6" /></div>
                  <div>
                    <p className="text-xs font-bold opacity-50 uppercase">Thành viên</p>
                    <h3 className="text-2xl font-black">{members.length}</h3>
                  </div>
                </div>
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500" style={{ width: `${(receivedMembers.length / members.length) * 100}%` }}></div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`p-6 rounded-3xl shadow-sm border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl"><DollarSign className="w-6 h-6" /></div>
                  <div>
                    <p className="text-xs font-bold opacity-50 uppercase">Định kỳ tháng</p>
                    <h3 className="text-2xl font-black">{formatCurrency(selectedGroup.monthly_amount)}</h3>
                  </div>
                </div>
                <p className="text-sm font-medium opacity-60">Tổng vốn: {formatCurrency(selectedGroup.monthly_amount * members.length)}</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`p-6 rounded-3xl shadow-sm border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-pink-100 text-pink-600 rounded-2xl"><Calendar className="w-6 h-6" /></div>
                  <div>
                    <p className="text-xs font-bold opacity-50 uppercase">Thời gian</p>
                    <h3 className="text-2xl font-black">
                      {selectedGroup.start_date?.includes('/') ? selectedGroup.start_date : new Date(selectedGroup.start_date).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}
                    </h3>
                  </div>
                </div>
                <p className="text-sm font-medium opacity-60">Bắt đầu dây vốn</p>
              </motion.div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Received List */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-500" />
                    Đã nhận vốn <span className="text-sm font-medium opacity-40">({receivedMembers.length})</span>
                  </h3>
                  {latestReceiver && (role === 'SUPER_ADMIN' || role === 'ADMIN') && (
                    <button 
                      onClick={() => setShowTrackingModal(true)}
                      className="px-4 py-2 bg-purple-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-200 hover:scale-105 transition-all"
                    >
                      Theo dõi chuyển khoản
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {receivedMembers.map((m, idx) => (
                    <motion.div 
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`p-5 rounded-3xl border relative overflow-hidden transition-all ${
                        m.id === latestReceiver?.id 
                        ? 'border-purple-400 bg-purple-50/50 dark:bg-purple-900/20 ring-2 ring-purple-400/20' 
                        : darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'
                      }`}
                    >
                      {m.id === latestReceiver?.id && (
                        <div className="absolute top-0 right-0 px-3 py-1 bg-purple-500 text-white text-[10px] font-black uppercase rounded-bl-xl">Mới nhất</div>
                      )}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-black text-lg">{m.name}</h4>
                          <p className="text-sm font-bold text-purple-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Nhận: {m.receive_date}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold opacity-40 uppercase">Tổng nhận</p>
                          <p className="text-lg font-black text-emerald-500">{formatCurrency(m.total_received)}</p>
                        </div>
                      </div>
                      <div className={`p-3 rounded-2xl text-sm font-medium ${darkMode ? 'bg-zinc-800/50' : 'bg-zinc-50'}`}>
                        <span className="opacity-50">Tiền thảo:</span> {formatCurrency(m.note_amount)}
                      </div>
                    </motion.div>
                  ))}
                  {receivedMembers.length === 0 && (
                    <div className="text-center py-12 opacity-30 font-bold italic">Chưa có ai nhận vốn</div>
                  )}
                </div>
              </section>

              {/* Unreceived List */}
              <section className="space-y-6">
                <h3 className="text-xl font-black flex items-center gap-2">
                  <Clock className="text-orange-500" />
                  Chưa nhận vốn <span className="text-sm font-medium opacity-40">({unreceivedMembers.length})</span>
                </h3>

                <div className="space-y-3">
                  {unreceivedMembers.map((m, idx) => (
                    <motion.div 
                      key={m.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`p-4 rounded-2xl border flex items-center justify-between group transition-all ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-zinc-400">
                          {idx + 1}
                        </div>
                        <span className="font-bold text-lg">{m.name}</span>
                      </div>
                      {(role === 'SUPER_ADMIN' || role === 'ADMIN') && (
                        <button 
                          onClick={() => {
                            setShowSettleModal(m);
                            const now = new Date();
                            const mm = String(now.getMonth() + 1).padStart(2, '0');
                            const yyyy = now.getFullYear();
                            setSettleData({ ...settleData, date: `${mm}/${yyyy}` });
                          }}
                          className="p-2 bg-purple-50 text-purple-500 rounded-xl hover:bg-purple-500 hover:text-white transition-all shadow-sm"
                        >
                          <ArrowRightCircle className="w-6 h-6" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Settle Modal */}
      <AnimatePresence>
        {showSettleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-md p-8 rounded-3xl shadow-2xl ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}
            >
              <h3 className="text-2xl font-black mb-6 flex items-center gap-2">
                <ShieldCheck className="text-purple-500" />
                Chốt người nhận vốn
              </h3>
              <div className="space-y-6">
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl">
                  <p className="text-sm font-bold opacity-50 uppercase mb-1">Người nhận</p>
                  <p className="text-xl font-black">{showSettleModal.name}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-2 opacity-60">Tháng/Năm nhận (mm/yyyy)</label>
                    <input 
                      type="text" 
                      placeholder="mm/yyyy"
                      value={settleData.date}
                      onChange={(e) => setSettleData({...settleData, date: e.target.value})}
                      className={`w-full p-4 rounded-2xl border-none font-bold ${darkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2 opacity-60">Tiền thảo (k)</label>
                    <input 
                      type="number" 
                      value={settleData.note}
                      onChange={(e) => setSettleData({...settleData, note: Number(e.target.value)})}
                      className={`w-full p-4 rounded-2xl border-none font-bold ${darkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}
                    />
                  </div>
                  {selectedGroup?.secondary_password && (
                    <div>
                      <label className="block text-sm font-bold mb-2 opacity-60">Mật khẩu xác thực</label>
                      <input 
                        type="password" 
                        value={settleData.password}
                        onChange={(e) => setSettleData({...settleData, password: e.target.value})}
                        className={`w-full p-4 rounded-2xl border-none font-bold ${darkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowSettleModal(null)}
                    className="flex-1 py-4 font-bold rounded-2xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={handleSettle}
                    className="flex-1 py-4 font-bold rounded-2xl bg-purple-500 text-white shadow-lg shadow-purple-200"
                  >
                    Xác nhận
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tracking Modal */}
      <AnimatePresence>
        {showTrackingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className={`w-full max-w-2xl p-8 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black">Theo dõi chuyển khoản</h3>
                <button 
                  onClick={() => setShowTrackingModal(false)} 
                  className="p-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800 mb-6">
                  <p className="text-xs font-black text-emerald-600 uppercase mb-1">Đang theo dõi kỳ</p>
                  <p className="text-xl font-black">{new Date().toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}</p>
                </div>

                <div className="space-y-2">
                  {members.filter(m => m.id !== latestReceiver?.id).map(m => {
                    const isReceived = !!m.receive_date;
                    const amountToPay = isReceived ? selectedGroup?.monthly_amount : (selectedGroup?.monthly_amount || 0) - (latestReceiver?.note_amount || 0);
                    
                    return (
                      <div 
                        key={m.id}
                        className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                          m.is_paid === 'x' 
                          ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' 
                          : darkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-100'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => togglePayment(m.id, m.is_paid === 'x')}
                            className={`transition-all ${m.is_paid === 'x' ? 'text-emerald-500' : 'text-zinc-400'}`}
                          >
                            {m.is_paid === 'x' ? <CheckSquare className="w-7 h-7" /> : <Square className="w-7 h-7" />}
                          </button>
                          <div>
                            <p className="font-bold text-lg">{m.name}</p>
                            <p className="text-xs font-bold opacity-40 uppercase">{isReceived ? 'Đã nhận vốn' : 'Chưa nhận vốn'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-purple-500">{formatCurrency(amountToPay || 0)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
