import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api.js';
import { ChevronLeft, Lock, ShieldCheck, ClipboardList, Camera, SlidersHorizontal } from 'lucide-react';
export const short = (h) => (h ? `${h.slice(0, 4)}...${h.slice(-4)}` : '–');
export const fmtTime = (iso) => { if (!iso) return '–'; const d = new Date(iso); return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-GB')}`; };
export const RESULT = {
  positive: { label: 'PRESUMPTIVE POSITIVE', cls: 'bg-emerald-700 text-white', box: 'border-emerald-400 bg-emerald-50 text-emerald-900' },
  negative: { label: 'PRESUMPTIVE NEGATIVE', cls: 'bg-brand text-white', box: 'border-sky-300 bg-sky-50 text-navy' },
  inconclusive: { label: 'INCONCLUSIVE', cls: 'bg-amber-500 text-white', box: 'border-amber-300 bg-amber-50 text-amber-900' },
  invalid: { label: 'INVALID CAPTURE', cls: 'bg-red-600 text-white', box: 'border-red-300 bg-red-50 text-red-800' },
};
export const DemoTag = () => <span className="ml-1 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold text-black">DEMO</span>;
export const Badge = ({ result }) => <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold ${RESULT[result]?.cls}`}>{RESULT[result]?.label}</span>;
const NAV = [
  { to: '/', label: 'Test Log', icon: ClipboardList, match: (p) => p === '/' || p.startsWith('/record') },
  { to: '/new', label: 'New Test', icon: Camera, match: (p) => p.startsWith('/new') || p.startsWith('/analysis') },
  { to: '/verify', label: 'Verify', icon: ShieldCheck, match: (p) => p.startsWith('/verify') },
  { to: '/calibrate', label: 'Calibrate', icon: SlidersHorizontal, match: (p) => p.startsWith('/calibrate') || p.startsWith('/card') || p.startsWith('/demo-card') },
];
function BottomNav() {
  const { pathname } = useLocation();
  return (<nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_6px_rgba(11,47,107,0.08)]">
    <ul className="grid grid-cols-4">{NAV.map(({ to, label, icon: I, match }) => { const on = match(pathname); return (
      <li key={to}><Link to={to} aria-current={on ? 'page' : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${on ? 'text-brand' : 'text-slate-500'}`}>
        <span className={`rounded-full px-4 py-0.5 ${on ? 'bg-pale' : ''}`}><I size={20} strokeWidth={on ? 2.5 : 2} /></span>{label}</Link></li>); })}</ul></nav>);
}
export function Shell({ title, children, back = true }) {
  const nav = useNavigate(), [demo, setDemo] = useState(false);
  useEffect(() => { api.config().then((c) => setDemo(c.demo)).catch(() => {}); }, []);
  return (<div className="mx-auto min-h-screen max-w-md bg-white shadow-sm">
    <header className="bg-navy px-3 py-3 text-white"><div className="flex items-center justify-between text-xs font-semibold tracking-wide">
      {back ? <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm"><ChevronLeft size={18} />Back</button> : <span />}
      <span className="flex items-center gap-1"><ShieldCheck size={16} />GOVERNMENT FIELD SYSTEM</span>
      <span className="flex items-center gap-1"><Lock size={14} />SECURE</span></div></header>
    {demo && <div className="bg-amber-400 px-3 py-1 text-center text-[11px] font-extrabold text-black">DEMO CONFIGURATION – PLACEHOLDER VALUES, NOT MEASURED</div>}
    <main className="space-y-3 p-3 pb-24"><h1 className="text-2xl font-extrabold text-navy">{title}</h1>{children}
      <p className="pt-2 text-center text-[11px] text-brand">Presumptive field-test result. Laboratory confirmation is required.</p></main><BottomNav /></div>);
}
export const Card = ({ icon: I, title, children, className = '' }) => (
  <section className={`rounded-lg border border-line bg-white p-3 ${className}`}>
    {title && <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-navy">{I && <I size={18} className="text-brand" />}{title}</h2>}{children}</section>);
export const Grid = ({ items, cols }) => (
  <div className="grid divide-x divide-line rounded border border-line bg-pale/40" style={{ gridTemplateColumns: `repeat(${cols || items.length}, minmax(0,1fr))` }}>
    {items.map(([k, v]) => <div key={k} className="min-w-0 px-2 py-1.5"><div className="text-[11px] text-slate-500">{k}</div><div className="break-words text-sm font-semibold text-navy">{v}</div></div>)}</div>);
export const Btn = ({ children, outline, className = '', ...p }) => (
  <button {...p} className={`flex w-full items-center justify-center gap-2 rounded-md px-3 py-3 text-sm font-bold uppercase disabled:opacity-50 ${outline ? 'border-2 border-brand bg-white text-brand' : 'bg-brand text-white'} ${className}`}>{children}</button>);
export const Notice = ({ tone = 'info', title, children }) => {
  const t = { info: 'border-sky-300 bg-sky-50 text-navy', warn: 'border-amber-300 bg-amber-50 text-amber-900', err: 'border-red-300 bg-red-50 text-red-800', ok: 'border-emerald-400 bg-emerald-50 text-emerald-900' }[tone];
  return <div className={`rounded-lg border p-3 text-sm ${t}`}>{title && <div className="font-bold uppercase">{title}</div>}{children}</div>;
};
export const ConfigMissing = ({ missing }) => (
  <Notice tone="warn" title="Configuration incomplete">No result can be produced until measured values are supplied in <code>server/config/*.json</code>:
    <ul className="mt-1 max-h-32 list-disc overflow-auto pl-5 text-xs">{missing.map((m) => <li key={m}>{m}</li>)}</ul></Notice>);
export const HomeLink = () => <Link to="/" className="text-sm font-semibold text-brand underline">Test log</Link>;