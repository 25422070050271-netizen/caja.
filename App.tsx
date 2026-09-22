import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trash2, Image as ImageIcon, X, FileText, ArrowLeft,
  Unlock, Lock, Package, Banknote, History, ArrowLeftRight, Wallet,
  Boxes, ClipboardList, Eye, Plus, Download, Delete, Check
} from 'lucide-react';

type PagoProveedor = { id: string; nombre: string; total: number; deFondo: number; deCaja: number; ticket?: string; hora: string; };
type Transferencia = { id: string; concepto: string; monto: number; hora: string; comprobante?: string; };
type Apertura = { fecha: string; fondo: number; ventasTarjetaCesar: number; conforme: boolean; };
type VentasHoy = { efectivo: number; tarjeta: number; };
type EstadoCaja = 'cerrada' | 'abierta';
type Conteos = { caja: Record<string, number>; fondo: Record<string, number>; general: Record<string, number>; };
type HistorialEntry = {
  id: string; fechaISO: string; apertura: Apertura; proveedores: PagoProveedor[]; transferencias: Transferencia[];
  ventasHoy: VentasHoy; conteos: Conteos; adicionesFondo: AdicionFondo[];
  cierreCalculado: {
    gastosFondo: number; gastosCaja: number; fondoRestante: number;
    efectivoEsperado: number; efectivoContado: number; efectivoJustificado: number;
    diferenciaJustificada: number; tarjetaTotalDia: number;
    transferenciasTotal: number; totalADejar: number;
    totalFondo: number; totalCaja: number; totalGeneral: number;
    totalAgregadoFondo: number;
  };
};
type ArchivoPDF = { id: string; fechaISO: string; nombre: string; dataUrl: string; totalADejar: number; ventasEfectivo: number };
type AdicionFondo = { id: string; monto: number; hora: string; fechaISO: string };
type AppState = {
  apertura: Apertura; proveedores: PagoProveedor[]; transferencias: Transferencia[];
  conteos: Conteos; ventasHoy: VentasHoy; estadoCaja: EstadoCaja;
  historial: HistorialEntry[]; archivos: ArchivoPDF[]; adicionesFondo: AdicionFondo[];
};
type ViewMode = 'home' | 'abrir' | 'proveedores' | 'transferencias' | 'contar' | 'cerrar' | 'historial' | 'archivos';
type ContarOrigen = 'caja' | 'fondo' | 'general' | null;
type TipoPago = 'fondo' | 'caja' | 'combinado';
type ActiveNumeric = { id: string; value: string; label: string; onChange: (v: string) => void } | null;

const DENOMS = [
  { v: 1000, label: '$1,000' }, { v: 500, label: '$500' }, { v: 200, label: '$200' },
  { v: 100, label: '$100' }, { v: 50, label: '$50' }, { v: 20, label: '$20' },
  { v: 10, label: '$10' }, { v: 5, label: '$5' }, { v: 2, label: '$2' }, { v: 1, label: '$1' }, { v: 0.5, label: '50c' },
];
const PROV_SUGERIDOS = ['Bimbo', 'Coca-Cola', 'Lala', 'Sabritas', 'Marinela', 'Pepsi', 'Bonafont', 'Alpura', 'Gamesa', 'Barcel'];

const nowISO = () => {
  const d = new Date(); const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000); return local.toISOString().slice(0, 16);
};
const fmtMoney = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n || 0);
const totalFor = (obj: Record<string, number>) => {
  let t = 0; for (const k in obj) { const qty = obj[k] || 0; const denom = parseFloat(k); if (!isNaN(denom)) t += qty * denom; } return t;
};

const initialConteos: Conteos = { caja: {}, fondo: {}, general: {} };
const initialState: AppState = {
  apertura: { fecha: nowISO(), fondo: 0, ventasTarjetaCesar: 0, conforme: false },
  proveedores: [], transferencias: [], conteos: initialConteos,
  ventasHoy: { efectivo: 0, tarjeta: 0 }, estadoCaja: 'cerrada', historial: [], archivos: [], adicionesFondo: [],
};

function NumericKeypad({ active, onClose }: { active: ActiveNumeric; onClose: () => void }) {
  const [localValue, setLocalValue] = useState(active?.value || '');
  useEffect(() => { setLocalValue(active?.value || ''); }, [active?.id, active?.value]);
  useEffect(() => {
    if (active) document.body.style.overflow = 'hidden'; else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [active]);
  if (!active) return null;
  const pushValue = (next: string) => { setLocalValue(next); active.onChange(next); };
  const handlePress = (key: string) => {
    if (key === 'del') { pushValue(localValue.slice(0, -1)); return; }
    if (key === '.') {
      if (localValue.includes('.')) return;
      if (localValue === '') { pushValue('0.'); return; }
      pushValue(localValue + '.'); return;
    }
    if (localValue === '0' && key !== '.') { pushValue(key); return; }
    pushValue(localValue + key);
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-white rounded-t-[28px] border-t border-black/10 shadow-[0_-12px_40px_rgba(0,0,0,0.18)] animate-[slideUp_0.28s_cubic-bezier(.16,1,.3,1)] pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 rounded-full bg-black/10" /></div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">{active.label}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-bold tracking-tight leading-none truncate max-w-[220px]">{localValue === '' ? '0' : localValue}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#FFFBF2] border border-black/5 grid place-items-center shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-3 pb-2 grid grid-cols-3 gap-2.5">
          {['1','2','3','4','5','6','7','8','9','.','0','del'].map((k) => {
            const isDel = k === 'del'; const isAction = k === '.' || isDel;
            return (
              <button key={k} onPointerDown={(e) => { e.preventDefault(); handlePress(k); }}
                className={`h-[60px] rounded-[16px] font-bold text-[22px] active:scale-[0.97] transition-all select-none touch-manipulation
                  ${isDel ? 'bg-white border border-black/10' : isAction ? 'bg-[#FFFBF2] border border-black/5' : 'bg-white border border-black/[0.06] shadow-[0_2px_8px_rgba(0,0,0,0.04)]'}`}>
                {isDel ? <Delete className="w-6 h-6 mx-auto" /> : k}
              </button>
            );
          })}
        </div>
        <div className="px-3 pt-1 pb-3">
          <button onClick={onClose} className="w-full h-[56px] rounded-full bg-black text-white font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98]"><Check className="w-5 h-5" /> confirmar</button>
        </div>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [view, setView] = useState<ViewMode>('home');
  const [ticketModal, setTicketModal] = useState<string | null>(null);
  const [historialDetail, setHistorialDetail] = useState<HistorialEntry | null>(null);
  const [pdfViewer, setPdfViewer] = useState<ArchivoPDF | null>(null);
  const [contarOrigen, setContarOrigen] = useState<ContarOrigen>(null);
  const [proveedorForm, setProveedorForm] = useState<{ nombre: string; tipo: TipoPago; total: string; deFondo: string; deCaja: string; ticket?: string }>({ nombre: '', tipo: 'fondo', total: '', deFondo: '', deCaja: '', ticket: undefined });
  const [transForm, setTransForm] = useState<{ concepto: string; monto: string; comprobante?: string }>({ concepto: '', monto: '', comprobante: undefined });
  const fileProvRef = useRef<HTMLInputElement>(null);
  const fileTransRef = useRef<HTMLInputElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [activeNumeric, setActiveNumeric] = useState<ActiveNumeric>(null);
  const [showAddFondoModal, setShowAddFondoModal] = useState(false);
  const [addFondoMonto, setAddFondoMonto] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const keys = ['cajaApp_v19','cajaApp_v18','cajaApp_v17','cajaApp_v16','cajaApp_v15','cajaApp_v14','cajaApp_v13','cajaApp_v12','cajaApp_v11','cajaApp_v10','cajaApp_v9','cajaApp_v8','cajaApp_v7','cajaApp_v6','cajaApp_v5'];
      let raw: string | null = null;
      for (const k of keys) { const r = localStorage.getItem(k); if (r) { raw = r; break; } }
      if (raw) {
        const parsed = JSON.parse(raw);
        setState(s => {
          const conteosRaw = parsed.conteos || {};
          const migratedConteos: Conteos = {
            caja: conteosRaw.caja || {},
            fondo: conteosRaw.fondo || {},
            general: conteosRaw.general || conteosRaw.cierre || {},
          };
          return {
            ...s, ...parsed,
            apertura: { fecha: parsed.apertura?.fecha || s.apertura.fecha, fondo: parsed.apertura?.fondo ?? 0, ventasTarjetaCesar: parsed.apertura?.ventasTarjetaCesar ?? 0, conforme: parsed.apertura?.conforme ?? false },
            ventasHoy: { ...s.ventasHoy, ...(parsed.ventasHoy || {}) },
            conteos: migratedConteos,
            archivos: Array.isArray(parsed.archivos) ? parsed.archivos : [],
            historial: Array.isArray(parsed.historial) ? parsed.historial.map((h:any)=>({
              ...h,
              conteos: h.conteos ? { caja: h.conteos.caja||{}, fondo: h.conteos.fondo||{}, general: h.conteos.general||h.conteos.cierre||{} } : {caja:{},fondo:{},general:{}},
              cierreCalculado: { ...h.cierreCalculado, totalGeneral: h.cierreCalculado?.totalGeneral ?? h.cierreCalculado?.totalCierre ?? 0 }
            })) : [],
            adicionesFondo: Array.isArray(parsed.adicionesFondo) ? parsed.adicionesFondo : [],
          };
        });
      }
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('cajaApp_v19', JSON.stringify(state)); } catch {} }, [state]);

  const gastosFondo = useMemo(() => state.proveedores.reduce((a,b)=>a+(b.deFondo||0),0), [state.proveedores]);
  const gastosCaja = useMemo(() => state.proveedores.reduce((a,b)=>a+(b.deCaja||0),0), [state.proveedores]);
  const totalAgregadoFondo = useMemo(() => (state.adicionesFondo||[]).reduce((a,b)=>a+(b.monto||0),0), [state.adicionesFondo]);
  const fondoRestante = (state.apertura.fondo||0) - gastosFondo;
  const totalCaja = useMemo(() => totalFor(state.conteos.caja), [state.conteos.caja]);
  const totalFondo = useMemo(() => totalFor(state.conteos.fondo), [state.conteos.fondo]);
  const totalGeneral = useMemo(() => totalFor(state.conteos.general), [state.conteos.general]);
  const totalCajonFisico = totalCaja + totalFondo;

  const efectivoContado = totalCaja;
  const efectivoEsperado = (state.ventasHoy.efectivo||0) - gastosCaja;
  const efectivoJustificado = efectivoContado + gastosCaja;
  const diferenciaJustificada = efectivoJustificado - (state.ventasHoy.efectivo||0);
  const tarjetaTotalDia = (state.apertura.ventasTarjetaCesar||0) + (state.ventasHoy.tarjeta||0);
  const transferenciasTotal = useMemo(() => state.transferencias.reduce((a,b)=>a+b.monto,0), [state.transferencias]);
  const totalADejar = Math.max(0, fondoRestante);
  const isAbierta = state.estadoCaja === 'abierta';

  const getTotalForOrigen = (o: ContarOrigen) => {
    if (o === 'caja') return totalCaja;
    if (o === 'fondo') return totalFondo;
    if (o === 'general') return totalGeneral;
    return 0;
  };

  const longPressTimer = useRef<any>(null);
  const longPressInterval = useRef<any>(null);
  const clearLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (longPressInterval.current) { clearInterval(longPressInterval.current); longPressInterval.current = null; }
  };
  useEffect(() => {
    const h = () => clearLongPress();
    window.addEventListener('pointerup', h); window.addEventListener('pointercancel', h);
    return () => { window.removeEventListener('pointerup', h); window.removeEventListener('pointercancel', h); };
  }, []);
  const setConteoQty = (origen: ContarOrigen, denomKey: string, qty: number) => {
    if (!origen) return;
    const safeQty = Math.max(0, Math.floor(qty));
    setState(s => {
      const current = (s.conteos[origen] as any)[denomKey] || 0;
      if (current === safeQty) return s;
      const nextConteos = { ...s.conteos, [origen]: { ...(s.conteos[origen] as any) } };
      if (safeQty === 0) delete (nextConteos[origen] as any)[denomKey]; else (nextConteos[origen] as any)[denomKey] = safeQty;
      return { ...s, conteos: nextConteos };
    });
  };
  const incDenom = (origen: ContarOrigen, denomKey: string) => {
    if (!origen) return;
    setState(s => { const cur = (s.conteos[origen!] as any)[denomKey] || 0; return { ...s, conteos: { ...s.conteos, [origen!]: { ...(s.conteos[origen!] as any), [denomKey]: cur + 1 } } }; });
  };
  const decDenom = (origen: ContarOrigen, denomKey: string) => {
    if (!origen) return;
    setState(s => { const cur = (s.conteos[origen!] as any)[denomKey] || 0; const next = Math.max(0, cur - 1); const copy = { ...(s.conteos[origen!] as any) }; if (next === 0) delete copy[denomKey]; else copy[denomKey] = next; return { ...s, conteos: { ...s.conteos, [origen!]: copy } }; });
  };
  const startLongPress = (action: () => void) => {
    clearLongPress(); longPressTimer.current = setTimeout(() => { longPressInterval.current = setInterval(action, 85); }, 320);
  };
  const openNumeric = (id: string, value: string, setter: (v: string) => void, label: string) => setActiveNumeric({ id, value: value ?? '', label, onChange: setter });
  const closeNumeric = () => { setActiveNumeric(null); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); };
  const showToast = (msg: string) => { setToast(msg); setTimeout(()=> setToast(null), 2200); };

  const handleConfirmAddFondo = () => {
    const monto = parseFloat(addFondoMonto)||0; if (monto<=0) return;
    const ahora = new Date();
    const nueva: AdicionFondo = { id: Date.now().toString(), monto, hora: ahora.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), fechaISO: ahora.toISOString() };
    setState(s => ({ ...s, apertura: { ...s.apertura, fondo: (s.apertura.fondo||0)+monto }, adicionesFondo: [nueva, ...(s.adicionesFondo||[])] }));
    setShowAddFondoModal(false); setAddFondoMonto(''); setActiveNumeric(null); showToast(`+${fmtMoney(monto)}`);
  };
  const addQuickFondo = (inc: number) => {
    const cur = parseFloat(addFondoMonto)||0; const next = cur+inc; setAddFondoMonto(String(next));
    if (activeNumeric && activeNumeric.id === 'add-fondo') setActiveNumeric(a=> a?{...a, value: String(next)}:a);
  };
  const handleAbrir = () => { if (!state.apertura.conforme) return; setState(s=>({...s, estadoCaja:'abierta' as EstadoCaja})); setView('home'); };

  const totalProvFondoCaja = useMemo(()=>{
    const t=parseFloat(proveedorForm.total)||0; const df=parseFloat(proveedorForm.deFondo)||0; const dc=parseFloat(proveedorForm.deCaja)||0;
    if(proveedorForm.tipo==='combinado') return { total: df+dc, deFondo: df, deCaja: dc, valid: (df+dc)>0 };
    if(proveedorForm.tipo==='fondo') return { total: t, deFondo: t, deCaja: 0, valid: t>0 };
    return { total: t, deFondo: 0, deCaja: t, valid: t>0 };
  }, [proveedorForm]);
  const handleAddProveedor = () => {
    if (!proveedorForm.nombre.trim() || !totalProvFondoCaja.valid) return;
    const nuevo: PagoProveedor = { id: Date.now().toString(), nombre: proveedorForm.nombre.trim(), total: totalProvFondoCaja.total, deFondo: totalProvFondoCaja.deFondo, deCaja: totalProvFondoCaja.deCaja, ticket: proveedorForm.ticket, hora: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) };
    setState(s=>({...s, proveedores:[nuevo, ...s.proveedores]}));
    setProveedorForm({ nombre:'', tipo:'fondo', total:'', deFondo:'', deCaja:'', ticket: undefined }); if(fileProvRef.current) fileProvRef.current.value='';
  };
  const handleFileProv = (e: React.ChangeEvent<HTMLInputElement>) => { const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>setProveedorForm(p=>({...p, ticket: r.result as string})); r.readAsDataURL(f); };
  const handleAddTransfer = () => {
    const monto=parseFloat(transForm.monto); if(!transForm.concepto.trim()||!monto||monto<=0) return;
    const nuevo: Transferencia = { id: Date.now().toString(), concepto: transForm.concepto.trim(), monto, hora: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), comprobante: transForm.comprobante };
    setState(s=>({...s, transferencias:[nuevo, ...s.transferencias]})); setTransForm({ concepto:'', monto:'', comprobante: undefined }); if(fileTransRef.current) fileTransRef.current.value='';
  };
  const handleFileTrans = (e: React.ChangeEvent<HTMLInputElement>) => { const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>setTransForm(p=>({...p, comprobante: r.result as string})); r.readAsDataURL(f); };

  const formatFileNameDate = (d=new Date())=>{ const pad=(n:number)=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}`; };
  const crearPDFInterno = async (): Promise<{ok:boolean; dataUrl:string}> => {
    let jsPDFClass:any; try{ const mod=await import('https://esm.sh/jspdf@2.5.2'); jsPDFClass=(mod as any).jsPDF||(mod as any).default; }catch{ try{ const mod2:any=await import('jspdf'); jsPDFClass=mod2.jsPDF||mod2.default||mod2; }catch{ return {ok:false,dataUrl:''}; } }
    try{
      const doc=new jsPDFClass({unit:'mm',format:'a4',compress:true}); const pageW=doc.internal.pageSize.getWidth(); const pageH=doc.internal.pageSize.getHeight(); const margin=14; const usableW=pageW-margin*2; let y=margin; let tableRowIndex=0;
      const checkPage=(needed:number)=>{ if(y+needed>pageH-margin){ doc.addPage(); y=margin; tableRowIndex=0; } };
      const sectionTitle=(titulo:string)=>{ checkPage(14); if(y>margin+2) y+=10; doc.setFillColor(0,0,0); doc.rect(margin,y,usableW,9,'F'); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text(titulo.toUpperCase(),margin+4,y+6); doc.setTextColor(0,0,0); y+=13; tableRowIndex=0; };
      const addRow=(label:string,value:string,bold=false)=>{ const h=7; checkPage(h+1); if(tableRowIndex%2===1){ doc.setFillColor(245,245,245); doc.rect(margin,y,usableW,h,'F'); } doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(100,100,100); doc.text(label,margin+3,y+4.5); doc.setFont('helvetica',bold?'bold':'normal'); doc.setFontSize(9); doc.setTextColor(0,0,0); const vw=doc.getTextWidth(value); doc.text(value,pageW-margin-3-vw,y+4.5); doc.setDrawColor(230,230,230); doc.setLineWidth(0.2); doc.line(margin,y+h,pageW-margin,y+h); y+=h; tableRowIndex++; };
      const addRowColored=(label:string,value:string,bg:[number,number,number],fg:[number,number,number])=>{ const h=7; checkPage(h+1); doc.setFillColor(bg[0],bg[1],bg[2]); doc.rect(margin,y,usableW,h,'F'); doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(80,80,80); doc.text(label,margin+3,y+4.5); doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(fg[0],fg[1],fg[2]); const vw=doc.getTextWidth(value); doc.text(value,pageW-margin-3-vw,y+4.5); doc.setTextColor(0,0,0); doc.setDrawColor(230,230,230); doc.setLineWidth(0.2); doc.line(margin,y+h,pageW-margin,y+h); y+=h; tableRowIndex++; };
      const addTable=(headers:string[],rows:string[][],colWidths:number[],opts?:{small?:boolean})=>{ const headerH=8,rowH=7; checkPage(headerH+rowH); doc.setFillColor(45,45,45); doc.rect(margin,y,usableW,headerH,'F'); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8); let x=margin; headers.forEach((h,i)=>{ doc.text(h,x+2,y+5.2); x+=colWidths[i]; }); doc.setTextColor(0,0,0); y+=headerH; rows.forEach((row,rIdx)=>{ checkPage(rowH+2); if(rIdx%2===1){ doc.setFillColor(245,245,245); doc.rect(margin,y,usableW,rowH,'F'); } doc.setFont('helvetica','normal'); doc.setFontSize(opts?.small?7.5:8); let cx=margin; row.forEach((cell,cIdx)=>{ const w=colWidths[cIdx]; const txt=doc.splitTextToSize(cell,w-4)[0]||''; if(cIdx===0) doc.setFont('helvetica','bold'); else doc.setFont('helvetica','normal'); if(cIdx>=2){ const tw=doc.getTextWidth(txt); doc.text(txt,cx+w-2-tw,y+4.6); } else doc.text(txt,cx+2,y+4.6); cx+=w; }); doc.setDrawColor(230,230,230); doc.setLineWidth(0.15); doc.line(margin,y+rowH,pageW-margin,y+rowH); y+=rowH; }); y+=2; };

      doc.setFont('helvetica','bold'); doc.setFontSize(28); doc.text('caja',margin,y+10); y+=14; doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor(110,110,110); doc.text('cierre de turno',margin,y); doc.setTextColor(0,0,0); y+=6; doc.setDrawColor(0,0,0); doc.setLineWidth(0.6); doc.line(margin,y,pageW-margin,y); y+=7;
      const fechaAperturaFull=new Date(state.apertura.fecha).toLocaleString('es-MX',{dateStyle:'long',timeStyle:'short'}); const fechaCierreFull=new Date().toLocaleString('es-MX',{dateStyle:'long',timeStyle:'short'}); const fechaGen=new Date().toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'});
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(60,60,60); doc.text(`De: ${fechaAperturaFull}`,margin,y); y+=5; doc.text(`Hasta: ${fechaCierreFull}`,margin,y); y+=5; doc.setFontSize(8); doc.setTextColor(130,130,130); doc.text(`Generado: ${fechaGen}`,margin,y); doc.setTextColor(0,0,0); y+=6;

      sectionTitle('1. apertura'); tableRowIndex=0;
      addRow('Fecha', new Date(state.apertura.fecha).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}));
      const fondoCesarBase=Math.max(0,(state.apertura.fondo||0)-(totalAgregadoFondo||0));
      addRow('Fondo inicial', fmtMoney(fondoCesarBase)); addRow('Agregado hoy', `${fmtMoney(totalAgregadoFondo)} (${(state.adicionesFondo||[]).length})`, totalAgregadoFondo>0);
      addRow('Fondo actual', fmtMoney(state.apertura.fondo), true); addRow('Fondo restante', fmtMoney(fondoRestante), true);
      addRow('Gastos fondo', fmtMoney(gastosFondo)); addRow('Tarjeta cesar', fmtMoney(state.apertura.ventasTarjetaCesar), true);
      if((state.adicionesFondo||[]).length>0){ checkPage(12); doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(100,100,100); doc.text('ADICIONES FONDO:',margin+2,y); y+=4; doc.setTextColor(0,0,0); const colW=[10,40,30]; const scale=usableW/colW.reduce((a,b)=>a+b,0); const colWS=colW.map(w=>w*scale); const rows=state.adicionesFondo.map((ad,i)=>[String(i+1),fmtMoney(ad.monto),ad.hora]); addTable(['#','Monto','Hora'],rows,colWS,{small:true}); }

      sectionTitle('2. ventas'); checkPage(22); doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text(`Efectivo: ${fmtMoney(state.ventasHoy.efectivo)}`,margin,y+6); y+=10; tableRowIndex=0;
      addRow('Tarjeta hoy', fmtMoney(state.ventasHoy.tarjeta), true); addRow('Transferencias', `${fmtMoney(transferenciasTotal)} (${state.transferencias.length})`, true);
      const totalVentasDia=state.ventasHoy.efectivo+state.ventasHoy.tarjeta; addRow('Total ventas', fmtMoney(totalVentasDia), true); addRow('Total + transf', fmtMoney(totalVentasDia+transferenciasTotal), true);

      if(state.transferencias.length>0){ sectionTitle(`3. transferencias (${state.transferencias.length})`); const colWidths=[10,usableW-10-38-20,38,20]; const rows=state.transferencias.map((tr,i)=>[String(i+1),tr.concepto,fmtMoney(tr.monto),tr.hora]); addTable(['#','Concepto','Monto','Hora'],rows,colWidths); checkPage(8); doc.setFont('helvetica','bold'); doc.setFontSize(9); const totalW=doc.getTextWidth(`Total: ${fmtMoney(transferenciasTotal)}`); doc.text(`Total: ${fmtMoney(transferenciasTotal)}`,pageW-margin-totalW,y); y+=6; } else { sectionTitle('3. transferencias'); doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(120,120,120); doc.text('Sin movimientos',margin+2,y+2); doc.setTextColor(0,0,0); y+=8; }

      sectionTitle(`4. proveedores (${state.proveedores.length})`); const totalGastado=gastosFondo+gastosCaja; const gap=3,boxW=(usableW-gap*3)/4,boxH=16; checkPage(boxH+6);
      const boxes=[{label:'TOTAL',value:fmtMoney(totalGastado),bg:[0,0,0] as [number,number,number],fg:[255,255,255] as [number,number,number],sub:`${state.proveedores.length}`},{label:'FONDO',value:fmtMoney(gastosFondo),bg:[245,245,245] as [number,number,number],fg:[0,0,0] as [number,number,number],sub:''},{label:'CAJA',value:fmtMoney(gastosCaja),bg:[245,245,245] as [number,number,number],fg:[0,0,0] as [number,number,number],sub:''},{label:'RESTANTE',value:fmtMoney(fondoRestante),bg:[232,245,233] as [number,number,number],fg:[26,77,46] as [number,number,number],sub:''}];
      let bx=margin; boxes.forEach(b=>{ doc.setFillColor(b.bg[0],b.bg[1],b.bg[2]); if(b.bg[0]===245){ doc.setDrawColor(220,220,220); doc.setLineWidth(0.2); doc.rect(bx,y,boxW,boxH,'FD'); } else doc.rect(bx,y,boxW,boxH,'F'); doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(b.fg[0]===255?200:120,b.fg[0]===255?200:120,b.fg[0]===255?200:120); if(b.bg[0]===0) doc.setTextColor(180,180,180); if(b.bg[0]===232) doc.setTextColor(90,140,100); doc.text(b.label,bx+2.5,y+4); doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(b.fg[0],b.fg[1],b.fg[2]); doc.text(doc.splitTextToSize(b.value,boxW-5)[0],bx+2.5,y+9); doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(b.fg[0]===255?180:100,b.fg[0]===255?180:100,b.fg[0]===255?180:100); doc.text(b.sub,bx+2.5,y+12.5); bx+=boxW+gap; }); doc.setTextColor(0,0,0); y+=boxH+6;
      if(state.proveedores.length===0){ doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(120,120,120); doc.text('Sin pagos',margin+2,y); doc.setTextColor(0,0,0); y+=6; } else { const colW=[8,54,26,26,26,18,24]; const scale=usableW/colW.reduce((a,b)=>a+b,0); const colWS=colW.map(w=>w*scale); const rows=state.proveedores.map((p,i)=>{ const tipo=p.deFondo>0&&p.deCaja>0?'comb':p.deFondo>0?'fondo':'caja'; return [String(i+1),p.nombre,fmtMoney(p.total),fmtMoney(p.deFondo),fmtMoney(p.deCaja),p.hora,tipo+(p.ticket?' +foto':'')]; }); addTable(['#','Proveedor','Total','Fondo','Caja','Hora','Tipo'],rows,colWS,{small:true}); }

      sectionTitle('5. conteos'); const headersConteos=['Origen','Total','Detalle']; const colWConteos=[usableW*0.28,usableW*0.28,usableW*0.44]; const difFondo=totalFondo-fondoRestante;
      const rowsConteos=[['Caja',fmtMoney(totalCaja),'efectivo'],['Fondo',fmtMoney(totalFondo),`esp ${fmtMoney(fondoRestante)} dif ${fmtMoney(difFondo)}`],['General',fmtMoney(totalGeneral),'cajón completo'],['Cajón (caja+fondo)',fmtMoney(totalCajonFisico),`caja ${fmtMoney(totalCaja)} + fondo ${fmtMoney(totalFondo)}`]];
      addTable(headersConteos,rowsConteos,colWConteos);

      sectionTitle('6. cuadre'); tableRowIndex=0;
      addRow(`Esperado ef (ventas ${fmtMoney(state.ventasHoy.efectivo)} - caja ${fmtMoney(gastosCaja)})`, fmtMoney(efectivoEsperado), true);
      addRow('Contado caja', fmtMoney(efectivoContado), true); addRow(`Justificado (${fmtMoney(efectivoContado)} + ${fmtMoney(gastosCaja)})`, fmtMoney(efectivoJustificado), true);
      const difText=diferenciaJustificada===0?'ok':diferenciaJustificada>0?'sobrante':'faltante';
      if(diferenciaJustificada<0) addRowColored(`Diferencia (${difText})`,fmtMoney(diferenciaJustificada),[255,240,240],[180,30,30]); else addRowColored(`Diferencia (${difText})`,fmtMoney(diferenciaJustificada),[234,247,238],[26,77,46]);
      addRow(`Tarjeta total (cesar ${fmtMoney(state.apertura.ventasTarjetaCesar)} + hoy ${fmtMoney(state.ventasHoy.tarjeta)})`, fmtMoney(tarjetaTotalDia), true);
      checkPage(24); y+=2; const bigBoxH=22; doc.setFillColor(0,0,0); doc.roundedRect(margin,y,usableW,bigBoxH,2,2,'F'); doc.setTextColor(180,180,180); doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.text('TOTAL A DEJAR',margin+4,y+6); doc.setTextColor(255,255,255); doc.setFontSize(16); doc.text(fmtMoney(totalADejar),margin+4,y+14); doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(180,180,180); const rightText=`fondo ${fmtMoney(state.apertura.fondo)} - gastado ${fmtMoney(gastosFondo)} | dif ${fmtMoney(diferenciaJustificada)}`; doc.text(doc.splitTextToSize(rightText,usableW-70),margin+55,y+14); doc.setTextColor(0,0,0); y+=bigBoxH+6;

      const allImages:{label:string;sublabel:string;data:string}[]=[]; state.proveedores.forEach(p=>{ if(p.ticket){ const tipo=p.deFondo>0&&p.deCaja>0?'combinado':p.deFondo>0?'fondo':'caja'; allImages.push({label:`${p.nombre} - ${fmtMoney(p.total)}`,sublabel:`${tipo} | ${fmtMoney(p.deFondo)} ${fmtMoney(p.deCaja)} | ${p.hora}`,data:p.ticket}); } }); state.transferencias.forEach(t=>{ if(t.comprobante) allImages.push({label:`${t.concepto} - ${fmtMoney(t.monto)}`,sublabel:`transferencia | ${t.hora}`,data:t.comprobante}); });
      doc.addPage(); y=margin; sectionTitle(`7. fotos (${allImages.length})`);
      if(allImages.length===0){ doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(120,120,120); doc.text('sin fotos',margin+2,y+4); doc.setTextColor(0,0,0); y+=8; } else { const imgW=85,imgH=65,gapX=8,gapY=16,cols=2; let col=0; y+=2; checkPage(imgH+12); for(let i=0;i<allImages.length;i++){ const img=allImages[i]; if(y+imgH+14>pageH-margin){ doc.addPage(); y=margin; col=0; } const currentX=margin+col*(imgW+gapX); doc.setDrawColor(220,220,220); doc.setLineWidth(0.3); doc.rect(currentX,y,imgW,imgH); try{ let format='JPEG'; const d=img.data.toLowerCase(); if(d.includes('image/png')) format='PNG'; else if(d.includes('image/webp')) format='WEBP'; try{ doc.addImage(img.data,format as any,currentX+0.5,y+0.5,imgW-1,imgH-1); }catch{ doc.addImage(img.data,'JPEG',currentX+0.5,y+0.5,imgW-1,imgH-1); } }catch{ doc.setFontSize(7); doc.text('imagen no disponible',currentX+2,y+6); } doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(0,0,0); const labelLines=doc.splitTextToSize(img.label,imgW); doc.text(labelLines,currentX,y+imgH+3.5); doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(110,110,110); const subLines=doc.splitTextToSize(img.sublabel,imgW); const labelH=labelLines.length*2.8; doc.text(subLines,currentX,y+imgH+3.5+labelH); if(col===cols-1){ col=0; y+=imgH+gapY+labelH+3; } else col++; } }
      const fileName=`caja-${formatFileNameDate()}.pdf`; let dataUrl=''; try{ dataUrl=doc.output('datauristring'); }catch{} try{ doc.save(fileName); }catch{} return {ok:true,dataUrl};
    }catch(e){ console.error(e); return {ok:false,dataUrl:''}; }
  };
  const generarPDF = async () => { setIsGeneratingPDF(true); try{ const res=await crearPDFInterno(); if(res.dataUrl){ const nuevo:ArchivoPDF={id:Date.now().toString(),fechaISO:new Date().toISOString(),nombre:`caja-${formatFileNameDate()}.pdf`,dataUrl:res.dataUrl,totalADejar,ventasEfectivo:state.ventasHoy.efectivo||0}; setState(s=>({...s,archivos:[nuevo,...s.archivos].slice(0,50)})); } }catch(e){console.error(e);} finally{ setIsGeneratingPDF(false); } };
  const handleCerrarTurno = async () => {
    setIsGeneratingPDF(true); let pdfRes:{ok:boolean;dataUrl:string}={ok:false,dataUrl:''}; try{ pdfRes=await crearPDFInterno(); }catch(e){console.error(e);}
    try{
      const entry:HistorialEntry={ id: Date.now().toString(), fechaISO: new Date().toISOString(), apertura:{...state.apertura}, proveedores:[...state.proveedores], transferencias:[...state.transferencias], ventasHoy:{...state.ventasHoy}, conteos:{ caja:{...state.conteos.caja}, fondo:{...state.conteos.fondo}, general:{...state.conteos.general} }, adicionesFondo:[...state.adicionesFondo], cierreCalculado:{ gastosFondo,gastosCaja,fondoRestante, efectivoEsperado,efectivoContado,efectivoJustificado,diferenciaJustificada,tarjetaTotalDia,transferenciasTotal,totalADejar,totalFondo,totalCaja,totalGeneral,totalAgregadoFondo } };
      const newHistorial=[entry,...state.historial].slice(0,100); let newArchivos=state.archivos;
      if(pdfRes.dataUrl){ const archivo:ArchivoPDF={id:Date.now().toString(),fechaISO:new Date().toISOString(),nombre:`caja-${formatFileNameDate()}.pdf`,dataUrl:pdfRes.dataUrl,totalADejar,ventasEfectivo:state.ventasHoy.efectivo||0}; newArchivos=[archivo,...state.archivos].slice(0,50); }
      const reset:AppState={ ...initialState, apertura:{ fecha: nowISO(), fondo:0, ventasTarjetaCesar:0, conforme:false }, proveedores:[], transferencias:[], conteos:{ caja:{}, fondo:{}, general:{} }, ventasHoy:{efectivo:0,tarjeta:0}, estadoCaja:'cerrada' as EstadoCaja, historial:newHistorial, archivos:newArchivos, adicionesFondo:[] };
      try{ localStorage.setItem('cajaApp_v19',JSON.stringify(reset)); }catch{} setState(reset); setContarOrigen(null); setView('home');
    }catch(e){console.error(e);} finally{ setIsGeneratingPDF(false); }
  };

  const AppTile = ({ icon: Icon, title, onClick, badge, accent }: { icon:any; title:string; onClick:()=>void; badge?:string; accent?:boolean; }) => (
    <button onClick={onClick} className={`text-left aspect-square rounded-[24px] border p-4 flex flex-col justify-between active:scale-[0.98] transition-all ${accent?'bg-black text-white border-black':'bg-white border-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.04)]'}`}>
      <div className={`w-10 h-10 rounded-[12px] grid place-items-center ${accent?'bg-white/10':'bg-[#FFFBF2]'}`}><Icon className={`w-5 h-5 ${accent?'text-white':'text-black'}`} /></div>
      <div><p className="font-bold text-[16px] leading-none tracking-tight lowercase">{title}</p>{badge && <span className={`mt-2 inline-flex text-[10px] font-bold px-2 py-1 rounded-full ${accent?'bg-white text-black':'bg-black text-white'}`}>{badge}</span>}</div>
    </button>
  );

  return (
    <div className="min-h-screen text-[#111111] font-[Inter,system-ui,sans-serif] bg-[#FFFBF2]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'); @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <header className="sticky top-0 z-20">
        <div className="max-w-[980px] mx-auto px-4 md:px-6 pt-4">
          <div className="h-[56px] rounded-[18px] bg-white border border-black/[0.06] flex items-center justify-between px-4">
            <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-[10px] bg-black text-white grid place-items-center font-bold text-[14px]">c</div><h1 className="font-bold text-[16px] tracking-tight lowercase">caja</h1><span className="text-[11px] text-black/30 ml-1">{new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'short'})}</span></div>
            <div className={`h-7 px-3 rounded-full text-[11px] font-bold flex items-center gap-2 border ${isAbierta?'bg-black text-white border-black':'bg-white text-black/50 border-black/10'}`}><span className={`w-1.5 h-1.5 rounded-full ${isAbierta?'bg-[#22c55e]':'bg-black/20'}`} />{isAbierta?'abierta':'cerrada'}</div>
          </div>
        </div>
      </header>

      <main className="max-w-[980px] mx-auto px-4 md:px-6 pb-28 pt-6">
        {view==='home' && (
          <div className="animate-[fadeIn_0.25s_ease]">
            {!isAbierta ? (
              <div className="min-h-[62vh] flex flex-col items-center justify-center">
                <button onClick={()=>setView('abrir')} className="group w-[300px] h-[300px] md:w-[360px] md:h-[360px] rounded-[36px] bg-black text-white shadow-[0_20px_50px_rgba(0,0,0,0.18)] hover:-translate-y-1 active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-5">
                  <div className="w-[72px] h-[72px] rounded-[20px] bg-white/10 grid place-items-center"><Unlock className="w-8 h-8" /></div>
                  <p className="font-bold text-[28px] leading-none tracking-tight lowercase">abrir caja</p>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-[760px]">
                <AppTile icon={Package} title="proveedores" onClick={()=>setView('proveedores')} badge={`${state.proveedores.length} · ${fmtMoney(gastosFondo+gastosCaja)}`} />
                <AppTile icon={ArrowLeftRight} title="transferencias" onClick={()=>setView('transferencias')} badge={fmtMoney(transferenciasTotal)} />
                <AppTile icon={Banknote} title="contar" onClick={()=>{ setContarOrigen(null); setView('contar'); }} badge={fmtMoney(totalCajonFisico)} />
                <AppTile icon={Lock} title="cierre" onClick={()=>setView('cerrar')} badge={fmtMoney(totalADejar)} accent />
                <AppTile icon={FileText} title="archivos" onClick={()=>setView('archivos')} badge={`${state.archivos.length}`} />
                <AppTile icon={History} title="historial" onClick={()=>setView('historial')} badge={`${state.historial.length}`} />
              </div>
            )}
          </div>
        )}

        {view==='abrir' && (
          <div className="max-w-[640px] mx-auto animate-[fadeIn_0.25s_ease]">
            <button onClick={()=>setView('home')} className="h-8 px-3 rounded-full bg-white border border-black/10 text-[12px] font-bold flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> inicio</button>
            <h2 className="mt-5 font-bold text-[28px] tracking-tight lowercase">abrir</h2>
            {isAbierta ? (
              <div className="mt-4 bg-white rounded-[20px] border border-black/5 p-5">
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div className="p-3 rounded-xl bg-[#FFFBF2]"><p className="text-black/40 text-[10px]">fondo</p><p className="font-bold">{fmtMoney(state.apertura.fondo)}</p></div>
                  <div className="p-3 rounded-xl bg-[#FFFBF2]"><p className="text-black/40 text-[10px]">tarjeta</p><p className="font-bold">{fmtMoney(state.apertura.ventasTarjetaCesar)}</p></div>
                </div>
                <button onClick={()=>setView('home')} className="mt-4 w-full h-10 rounded-full bg-black text-white text-[13px] font-bold">inicio</button>
              </div>
            ) : (
              <div className="mt-4 bg-white rounded-[20px] border border-black/5 p-5 space-y-4">
                <label className="block"><span className="text-[10px] uppercase font-bold text-black/40">fecha</span><input type="datetime-local" value={state.apertura.fecha} onChange={e=>setState(s=>({...s, apertura:{...s.apertura, fecha:e.target.value}}))} className="mt-1.5 w-full h-10 rounded-xl border border-black/10 bg-[#FFFBF2] px-3 text-[13px] font-semibold outline-none" /></label>
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-black/40">fondo</span>
                  <input type="text" inputMode="none" readOnly value={state.apertura.fondo?String(state.apertura.fondo):''} placeholder="0" onFocus={()=>openNumeric('ap-fondo',state.apertura.fondo?String(state.apertura.fondo):'',(v)=>setState(s=>({...s, apertura:{...s.apertura, fondo:parseFloat(v)||0}})),'fondo')} onClick={()=>openNumeric('ap-fondo',state.apertura.fondo?String(state.apertura.fondo):'',(v)=>setState(s=>({...s, apertura:{...s.apertura, fondo:parseFloat(v)||0}})),'fondo')} className="mt-1 w-full h-11 rounded-xl border border-black/10 px-3 text-[18px] font-bold outline-none bg-white cursor-pointer" />
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-black/40">tarjeta cesar</span>
                  <input type="text" inputMode="none" readOnly value={state.apertura.ventasTarjetaCesar?String(state.apertura.ventasTarjetaCesar):''} placeholder="0" onFocus={()=>openNumeric('ap-tj',state.apertura.ventasTarjetaCesar?String(state.apertura.ventasTarjetaCesar):'',(v)=>setState(s=>({...s, apertura:{...s.apertura, ventasTarjetaCesar:parseFloat(v)||0}})),'tarjeta')} onClick={()=>openNumeric('ap-tj',state.apertura.ventasTarjetaCesar?String(state.apertura.ventasTarjetaCesar):'',(v)=>setState(s=>({...s, apertura:{...s.apertura, ventasTarjetaCesar:parseFloat(v)||0}})),'tarjeta')} className="mt-1 w-full h-11 rounded-xl border border-black/10 px-3 text-[18px] font-bold outline-none bg-white cursor-pointer" />
                </div>
                <label className="flex gap-2 items-center p-3 rounded-xl bg-[#FFFBF2] border border-black/5 cursor-pointer"><input type="checkbox" checked={state.apertura.conforme} onChange={e=>setState(s=>({...s, apertura:{...s.apertura, conforme:e.target.checked}}))} className="w-4 h-4 accent-black" /><span className="text-[12px] font-medium">conforme</span></label>
                <button onClick={handleAbrir} disabled={!state.apertura.conforme} className="w-full h-11 rounded-full bg-black text-white font-bold text-[13px] disabled:opacity-40">abrir</button>
              </div>
            )}
          </div>
        )}

        {view==='proveedores' && (
          <div className="max-w-[920px] mx-auto animate-[fadeIn_0.25s_ease]">
            <div className="flex items-center justify-between gap-2">
              <button onClick={()=>setView('home')} className="h-8 px-3 rounded-full bg-white border border-black/10 text-[12px] font-bold flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> inicio</button>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#FFFBF2] border border-black/5">{fmtMoney(fondoRestante)}</span>
                <button onClick={()=>{ setAddFondoMonto(''); setShowAddFondoModal(true); }} className="w-8 h-8 rounded-full bg-black text-white grid place-items-center"><span className="text-[18px] font-bold leading-none translate-y-[-1px]">+</span></button>
              </div>
            </div>
            <h2 className="mt-2 font-bold text-[26px] tracking-tight lowercase">proveedores</h2>
            {(state.adicionesFondo && state.adicionesFondo.length>0) && (
              <div className="mt-3 bg-white rounded-[16px] border border-black/5 p-3">
                <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-widest text-black/40">{fmtMoney(totalAgregadoFondo)}</p><span className="text-[10px] font-bold text-black/30">{state.adicionesFondo.length}</span></div>
                <div className="mt-2 space-y-1.5 max-h-[120px] overflow-auto pr-1">
                  {state.adicionesFondo.map(ad=>(
                    <div key={ad.id} className="flex items-center justify-between gap-2 p-2 rounded-[10px] bg-[#FFFBF2] border border-black/5">
                      <span className="text-[12px] font-bold">{fmtMoney(ad.monto)} <span className="text-[11px] font-normal text-black/40">· {ad.hora}</span></span>
                      <button onClick={()=>setState(s=>({...s, apertura:{...s.apertura, fondo: Math.max(0,(s.apertura.fondo||0)-ad.monto)}, adicionesFondo: s.adicionesFondo.filter(x=>x.id!==ad.id)}))} className="w-6 h-6 rounded-full bg-white border border-black/10 grid place-items-center"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 grid lg:grid-cols-[0.9fr_1.1fr] gap-4">
              <div className="bg-white rounded-[20px] border border-black/5 p-5">
                <div className="mt-1 space-y-4">
                  <label className="block"><span className="text-[10px] uppercase font-bold text-black/40">nombre</span><input list="prov-list" value={proveedorForm.nombre} onChange={e=>setProveedorForm(p=>({...p, nombre:e.target.value}))} placeholder="" className="mt-1.5 w-full h-10 rounded-xl border border-black/10 bg-[#FFFBF2] px-3 text-[13px] font-semibold outline-none" /><datalist id="prov-list">{PROV_SUGERIDOS.map(s=><option key={s} value={s} />)}</datalist></label>
                  <div><span className="text-[10px] uppercase font-bold text-black/40">tipo</span><div className="mt-1.5 grid grid-cols-3 gap-1 p-1 rounded-full bg-[#FFFBF2] border border-black/5">{(['fondo','caja','combinado'] as TipoPago[]).map(tp=><button key={tp} onClick={()=>setProveedorForm(p=>({...p, tipo:tp, total: tp==='combinado'?'':p.total}))} className={`h-9 rounded-full text-[11px] font-bold lowercase ${proveedorForm.tipo===tp?'bg-black text-white':'text-black/50'}`}>{tp}</button>)}</div></div>
                  {proveedorForm.tipo!=='combinado' ? (
                    <div className="space-y-2"><span className="text-[10px] uppercase font-bold text-black/40">monto</span><input type="text" inputMode="none" readOnly value={proveedorForm.total} placeholder="0" onFocus={()=>openNumeric('prov-total',proveedorForm.total,(v)=>setProveedorForm(p=>({...p,total:v})),'monto')} onClick={()=>openNumeric('prov-total',proveedorForm.total,(v)=>setProveedorForm(p=>({...p,total:v})),'monto')} className="w-full h-[56px] rounded-[16px] border border-black/10 bg-white px-4 text-[22px] font-bold outline-none cursor-pointer" /></div>
                  ) : (
                    <div className="space-y-3">
                      <div><span className="text-[10px] uppercase font-bold text-black/40">fondo</span><input type="text" inputMode="none" readOnly value={proveedorForm.deFondo} placeholder="0" onFocus={()=>openNumeric('prov-fondo',proveedorForm.deFondo,(v)=>setProveedorForm(p=>({...p,deFondo:v})),'fondo')} onClick={()=>openNumeric('prov-fondo',proveedorForm.deFondo,(v)=>setProveedorForm(p=>({...p,deFondo:v})),'fondo')} className="mt-1 w-full h-11 rounded-xl border border-black/10 bg-white px-3 text-[18px] font-bold outline-none cursor-pointer" /></div>
                      <div><span className="text-[10px] uppercase font-bold text-black/40">caja</span><input type="text" inputMode="none" readOnly value={proveedorForm.deCaja} placeholder="0" onFocus={()=>openNumeric('prov-caja',proveedorForm.deCaja,(v)=>setProveedorForm(p=>({...p,deCaja:v})),'caja')} onClick={()=>openNumeric('prov-caja',proveedorForm.deCaja,(v)=>setProveedorForm(p=>({...p,deCaja:v})),'caja')} className="mt-1 w-full h-11 rounded-xl border border-black/10 bg-white px-3 text-[18px] font-bold outline-none cursor-pointer" /></div>
                      <div className="flex justify-between items-center text-[12px] font-bold"><span className="text-black/40 text-[11px] uppercase tracking-widest">total</span><span className="text-[18px]">{fmtMoney(totalProvFondoCaja.total)}</span></div>
                    </div>
                  )}
                  <div className="space-y-1.5"><span className="text-[10px] uppercase font-bold text-black/40">ticket</span><div className="flex gap-2"><input ref={fileProvRef} type="file" accept="image/*" onChange={handleFileProv} className="hidden" /><button onClick={()=>fileProvRef.current?.click()} className="flex-1 h-10 rounded-xl border border-dashed border-black/20 bg-[#FFFBF2] text-[12px] font-bold flex items-center justify-center gap-1.5"><ImageIcon className="w-4 h-4" /> {proveedorForm.ticket?'cambiar':'foto'}</button>{proveedorForm.ticket && <img src={proveedorForm.ticket} className="w-10 h-10 rounded-xl object-cover border border-black/10" alt="t" />}</div></div>
                  <button onClick={handleAddProveedor} disabled={!totalProvFondoCaja.valid || !proveedorForm.nombre.trim()} className="w-full h-11 rounded-full bg-black text-white text-[13px] font-bold disabled:opacity-30">guardar</button>
                </div>
              </div>
              <div className="bg-white rounded-[20px] border border-black/5 p-5">
                <div className="flex items-center justify-between"><p className="text-[11px] font-bold text-black/40">{state.proveedores.length}</p><span className="text-[11px] font-bold">{fmtMoney(gastosFondo+gastosCaja)}</span></div>
                <div className="mt-4 space-y-2 max-h-[560px] overflow-auto pr-1">
                  {state.proveedores.length===0 ? <p className="text-[12px] text-black/40 py-8 text-center">—</p> : state.proveedores.map(p=>(
                    <div key={p.id} className="flex items-center gap-2 p-3 rounded-[14px] bg-[#FFFBF2] border border-black/5">
                      <div className="flex-1 min-w-0"><p className="text-[13px] font-bold truncate lowercase">{p.nombre}</p><p className="text-[13px] font-bold">{fmtMoney(p.total)}</p></div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border shrink-0 ${p.deFondo>0&&p.deCaja>0?'bg-black text-white border-black':'bg-white border-black/10'}`}>{p.deFondo>0&&p.deCaja>0?'comb':p.deFondo>0?'fondo':'caja'}</span>
                      <div className="flex gap-1 shrink-0">{p.ticket && <button onClick={()=>setTicketModal(p.ticket!)} className="w-8 h-8 rounded-full bg-white border border-black/10 grid place-items-center"><ImageIcon className="w-4 h-4" /></button>}<button onClick={()=>setState(s=>({...s, proveedores: s.proveedores.filter(x=>x.id!==p.id)}))} className="w-8 h-8 rounded-full bg-white border border-black/10 grid place-items-center"><Trash2 className="w-4 h-4" /></button></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {view==='transferencias' && (
          <div className="max-w-[920px] mx-auto animate-[fadeIn_0.25s_ease]">
            <div className="flex items-center justify-between"><button onClick={()=>setView('home')} className="h-8 px-3 rounded-full bg-white border border-black/10 text-[12px] font-bold flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> inicio</button><span className="text-[11px] font-bold px-3 py-1 rounded-full bg-black text-white">{fmtMoney(transferenciasTotal)}</span></div>
            <h2 className="mt-4 font-bold text-[26px] tracking-tight lowercase">transferencias</h2>
            <div className="mt-4 grid lg:grid-cols-[0.9fr_1.1fr] gap-4">
              <div className="bg-white rounded-[20px] border border-black/5 p-5 space-y-4">
                <label className="block"><span className="text-[10px] uppercase font-bold text-black/40">concepto</span><input value={transForm.concepto} onChange={e=>setTransForm(p=>({...p, concepto:e.target.value}))} placeholder="" className="mt-1.5 w-full h-10 rounded-xl border border-black/10 bg-[#FFFBF2] px-3 text-[13px] font-semibold outline-none" /></label>
                <div className="space-y-2"><span className="text-[10px] uppercase font-bold text-black/40">monto</span><input type="text" inputMode="none" readOnly value={transForm.monto} placeholder="0" onFocus={()=>openNumeric('trans-monto',transForm.monto,(v)=>setTransForm(p=>({...p,monto:v})),'monto')} onClick={()=>openNumeric('trans-monto',transForm.monto,(v)=>setTransForm(p=>({...p,monto:v})),'monto')} className="w-full h-[56px] rounded-[16px] border border-black/10 bg-white px-4 text-[22px] font-bold outline-none cursor-pointer" /></div>
                <div className="space-y-1.5"><span className="text-[10px] uppercase font-bold text-black/40">foto</span><div className="flex gap-2"><input ref={fileTransRef} type="file" accept="image/*" onChange={handleFileTrans} className="hidden" /><button onClick={()=>fileTransRef.current?.click()} className="flex-1 h-10 rounded-xl border border-dashed border-black/20 bg-[#FFFBF2] text-[12px] font-bold flex items-center justify-center gap-1.5"><ImageIcon className="w-4 h-4" /> {transForm.comprobante?'cambiar':'foto'}</button>{transForm.comprobante && <img src={transForm.comprobante} className="w-10 h-10 rounded-xl object-cover border border-black/10" alt="c" />}</div></div>
                <button onClick={handleAddTransfer} className="w-full h-11 rounded-full bg-black text-white text-[13px] font-bold">guardar</button>
              </div>
              <div className="bg-white rounded-[20px] border border-black/5 p-5">
                <p className="text-[11px] font-bold text-black/40">{state.transferencias.length}</p>
                <div className="mt-4 space-y-2 max-h-[560px] overflow-auto pr-1">
                  {state.transferencias.length===0 ? <p className="text-[12px] text-black/40 py-8 text-center">—</p> : state.transferencias.map(tr=>(
                    <div key={tr.id} className="flex items-center gap-3 p-3 rounded-[14px] bg-[#FFFBF2] border border-black/5">
                      <div className="flex-1 min-w-0"><p className="text-[13px] font-bold truncate lowercase">{tr.concepto}</p><p className="text-[13px] font-bold">{fmtMoney(tr.monto)}</p></div>
                      <div className="flex gap-1 shrink-0">{tr.comprobante && <button onClick={()=>setTicketModal(tr.comprobante!)} className="w-8 h-8 rounded-full bg-white border border-black/10 grid place-items-center"><Eye className="w-4 h-4" /></button>}<button onClick={()=>setState(s=>({...s, transferencias: s.transferencias.filter(x=>x.id!==tr.id)}))} className="w-8 h-8 rounded-full bg-white border border-black/10 grid place-items-center"><Trash2 className="w-4 h-4" /></button></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {view==='contar' && (
          <div className="max-w-[760px] mx-auto animate-[fadeIn_0.25s_ease] pb-[90px]">
            <div className="flex items-center justify-between gap-2">
              <button onClick={()=>setView('home')} className="h-8 px-3 rounded-full bg-white border border-black/5 text-[12px] font-bold flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> inicio</button>
              <span className="h-8 px-3 rounded-full bg-white border border-black/5 text-[11px] font-bold flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" />{fmtMoney(totalCajonFisico)}</span>
            </div>
            <h2 className="mt-4 font-bold text-[26px] tracking-tight lowercase leading-none">contar</h2>
            <div className="sticky top-[68px] z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-[#FFFBF2]/90 backdrop-blur-[10px]">
              <div className="grid grid-cols-3 gap-[10px]">
                {[
                  { key:'caja' as ContarOrigen, label:'caja', icon:Wallet, total:totalCaja },
                  { key:'fondo' as ContarOrigen, label:'fondo', icon:Boxes, total:totalFondo },
                  { key:'general' as ContarOrigen, label:'general', icon:ClipboardList, total:totalGeneral },
                ].map(o=>{ const Icon=o.icon; const selected=contarOrigen===o.key; return (
                  <button key={o.key} onClick={()=>setContarOrigen(o.key)} className={`h-[64px] rounded-[16px] border text-left px-[12px] flex flex-col justify-center active:scale-[0.98] ${selected?'bg-black text-white border-black':'bg-white border-black/5 shadow-[0_1px_6px_rgba(0,0,0,0.04)]'}`}>
                    <div className="flex items-center gap-[6px]"><Icon className={`w-[18px] h-[18px] ${selected?'text-white':'text-black'}`} /><span className="font-bold text-[12px] lowercase tracking-tight leading-none">{o.label}</span></div>
                    <span className={`mt-[6px] font-bold text-[11px] leading-none truncate ${selected?'text-white/70':'text-black/45'}`}>{fmtMoney(o.total)}</span>
                  </button>
                )})}
              </div>
              {contarOrigen==='general' && Object.keys(state.conteos.fondo).length>0 && (
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={()=>{ setState(s=>({...s, conteos:{...s.conteos, general:{...s.conteos.fondo}}})); showToast('fondo → general'); }} className="h-[32px] px-3 rounded-full bg-white border border-black/5 text-[11px] font-bold flex items-center gap-1.5"><Boxes className="w-[14px] h-[14px]" /> copiar fondo</button>
                </div>
              )}
            </div>
            {!contarOrigen ? (
              <div className="mt-4 bg-white rounded-[16px] border border-black/5 p-6 text-center">
                <p className="font-bold text-[13px] lowercase">elige</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 rounded-[10px] bg-[#FFFBF2] border border-black/5"><p className="text-black/40 text-[10px]">caja</p><p className="font-bold text-[12px]">{fmtMoney(totalCaja)}</p></div>
                  <div className="p-2 rounded-[10px] bg-[#FFFBF2] border border-black/5"><p className="text-black/40 text-[10px]">fondo</p><p className="font-bold text-[12px]">{fmtMoney(totalFondo)}</p></div>
                  <div className="p-2 rounded-[10px] bg-[#FFFBF2] border border-black/5"><p className="text-black/40 text-[10px]">general</p><p className="font-bold text-[12px]">{fmtMoney(totalGeneral)}</p></div>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <div className="flex flex-col gap-[8px] pb-[24px]">
                  {DENOMS.map(d=>{
                    const key=String(d.v); const qty=(state.conteos[contarOrigen!] as any)[key]||0; const parcial=qty*d.v; const hasQty=qty>0;
                    return (
                      <div key={d.v} className={`bg-white rounded-[12px] border h-[56px] px-3 flex items-center ${hasQty?'border-black/10':'border-black/5'}`} style={{display:'grid',gridTemplateColumns:'30% 35% 35%'}}>
                        <div className="flex flex-col justify-center min-w-0 pr-2">
                          <p className="font-bold text-[15px] leading-none tracking-tight">{d.label}</p>
                        </div>
                        <div className="flex justify-center items-center">
                          <button type="button" onClick={()=>{ const cur=String(qty||''); openNumeric(`${contarOrigen}-${d.v}`,cur,(v)=>{ const vv=parseInt(v)||0; setConteoQty(contarOrigen,key,vv); },`${d.label}`); }}
                            className={`w-[64px] h-[36px] rounded-[10px] border font-bold text-[18px] leading-none grid place-items-center active:scale-[0.96] ${hasQty?'bg-black text-white border-black':'bg-[#FFFBF2] border-black/5'}`}>{qty||0}</button>
                        </div>
                        <div className="flex items-center justify-end gap-[6px] min-w-0">
                          <button type="button" onPointerDown={(e)=>{ e.preventDefault(); decDenom(contarOrigen,key); startLongPress(()=>decDenom(contarOrigen,key)); }} onPointerUp={clearLongPress} onPointerLeave={clearLongPress} className="w-[36px] h-[36px] rounded-full bg-white border border-black/10 grid place-items-center font-bold text-[16px] leading-none active:scale-[0.92] select-none touch-manipulation shrink-0">−</button>
                          <button type="button" onPointerDown={(e)=>{ e.preventDefault(); incDenom(contarOrigen,key); startLongPress(()=>incDenom(contarOrigen,key)); }} onPointerUp={clearLongPress} onPointerLeave={clearLongPress} className="w-[36px] h-[36px] rounded-full bg-black text-white grid place-items-center font-bold text-[16px] leading-none active:scale-[0.92] select-none touch-manipulation shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.12)]">+</button>
                          <div className="w-[70px] shrink-0 text-right leading-none pl-1">{hasQty ? <span className="font-bold text-[12px] tracking-tight">{fmtMoney(parcial)}</span> : <span className="text-[11px] text-black/20 font-bold">—</span>}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {contarOrigen && (
              <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-black/5 h-[72px] px-4 md:px-6 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
                <div className="max-w-[760px] mx-auto flex items-center justify-between gap-3 h-full py-[12px]">
                  <div className="min-w-0">
                    <p className="font-bold text-[20px] leading-none tracking-tight">{fmtMoney(getTotalForOrigen(contarOrigen))}</p>
                    <p className="text-[11px] text-black/40 font-medium mt-[4px] leading-none truncate">{contarOrigen}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={()=>{ if(confirm(`Limpiar ${contarOrigen}?`)){ setState(s=>({...s, conteos:{...s.conteos,[contarOrigen!]:{}}})); } }} className="h-[40px] px-4 rounded-full bg-white border border-black/10 text-[12px] font-bold">limpiar</button>
                    <button onClick={()=>setView('cerrar')} className="h-[40px] px-5 rounded-full bg-black text-white text-[12px] font-bold flex items-center gap-1.5">guardar <ArrowLeft className="w-4 h-4 rotate-180" /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view==='cerrar' && (
          <div className="max-w-[760px] mx-auto animate-[fadeIn_0.25s_ease]">
            <button onClick={()=>setView('home')} className="h-8 px-3 rounded-full bg-white border border-black/10 text-[12px] font-bold flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> inicio</button>
            <h2 className="mt-4 font-bold text-[30px] tracking-tight lowercase">cierre</h2>
            <div className="mt-5 space-y-4">
              <div className="bg-white rounded-[20px] border border-black/5 p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-[11px] text-black/40">efectivo</p><input type="text" inputMode="none" readOnly value={state.ventasHoy.efectivo?String(state.ventasHoy.efectivo):''} placeholder="0" onFocus={()=>openNumeric('v-ef',state.ventasHoy.efectivo?String(state.ventasHoy.efectivo):'',(v)=>setState(s=>({...s, ventasHoy:{...s.ventasHoy, efectivo:parseFloat(v)||0}})),'efectivo')} onClick={()=>openNumeric('v-ef',state.ventasHoy.efectivo?String(state.ventasHoy.efectivo):'',(v)=>setState(s=>({...s, ventasHoy:{...s.ventasHoy, efectivo:parseFloat(v)||0}})),'efectivo')} className="mt-1 w-full bg-transparent text-[32px] font-bold leading-none tracking-tight outline-none placeholder:text-black/20 cursor-pointer" /></div>
                  <div><p className="text-[11px] text-black/40">tarjeta</p><input type="text" inputMode="none" readOnly value={state.ventasHoy.tarjeta?String(state.ventasHoy.tarjeta):''} placeholder="0" onFocus={()=>openNumeric('v-tj',state.ventasHoy.tarjeta?String(state.ventasHoy.tarjeta):'',(v)=>setState(s=>({...s, ventasHoy:{...s.ventasHoy, tarjeta:parseFloat(v)||0}})),'tarjeta')} onClick={()=>openNumeric('v-tj',state.ventasHoy.tarjeta?String(state.ventasHoy.tarjeta):'',(v)=>setState(s=>({...s, ventasHoy:{...s.ventasHoy, tarjeta:parseFloat(v)||0}})),'tarjeta')} className="mt-1 w-full bg-transparent text-[32px] font-bold leading-none tracking-tight outline-none placeholder:text-black/20 cursor-pointer" /></div>
                </div>
                <div className="mt-5 pt-4 border-t border-black/5 grid grid-cols-2 gap-4">
                  <div><p className="text-[11px] text-black/40">transferencias</p><p className="mt-1 text-[20px] font-bold leading-none">{fmtMoney(transferenciasTotal)}</p></div>
                  <div><p className="text-[11px] text-black/40">esperado</p><p className="mt-1 text-[18px] font-bold leading-none">{fmtMoney(efectivoEsperado)}</p></div>
                </div>
                <div className="mt-4 flex gap-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-full border font-bold text-[11px] ${diferenciaJustificada===0?'bg-[#FFFBF2] border-black/5':diferenciaJustificada>0?'bg-[#EAF7EE] border-[#1A4D2E]/20 text-[#1A4D2E]':'bg-[#FFF0F0] border-red-200 text-red-700'}`}>{fmtMoney(diferenciaJustificada)}</span>
                  <span className="px-2.5 py-1 rounded-full bg-[#FFFBF2] border border-black/5 text-[11px]">{fmtMoney(efectivoContado)}</span>
                  <span className="px-2.5 py-1 rounded-full bg-white border text-[11px]">{fmtMoney(efectivoJustificado)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-[16px] border border-black/5 p-3"><p className="text-[10px] text-black/30">caja</p><p className="font-bold text-[13px]">{fmtMoney(totalCaja)}</p></div>
                <div className="bg-white rounded-[16px] border border-black/5 p-3"><p className="text-[10px] text-black/30">fondo</p><p className="font-bold text-[13px]">{fmtMoney(totalFondo)}</p><p className="text-[10px] text-black/30">{fmtMoney(fondoRestante)}</p></div>
                <div className="bg-white rounded-[16px] border border-black/5 p-3"><p className="text-[10px] text-black/30">general</p><p className="font-bold text-[13px]">{fmtMoney(totalGeneral)}</p></div>
              </div>
              <div className="rounded-[20px] bg-white border border-black/5 p-5">
                <p className="text-[10px] uppercase font-bold tracking-widest text-black/30">a dejar</p>
                <p className="mt-3 text-[36px] font-bold leading-none tracking-tight">{fmtMoney(totalADejar)}</p>
                <div className="mt-3 flex gap-2 text-[11px] flex-wrap">
                  <span className="px-2.5 py-1 rounded-full bg-black text-white font-bold">{fmtMoney(fondoRestante)}</span>
                  <span className="px-2.5 py-1 rounded-full bg-[#FFFBF2] border border-black/5">{fmtMoney(gastosFondo)}</span>
                  <span className="px-2.5 py-1 rounded-full bg-[#FFFBF2] border border-black/5">{fmtMoney(gastosCaja)}</span>
                </div>
                <div className="mt-3 text-[11px] text-black/50">{fmtMoney(tarjetaTotalDia)}</div>
              </div>
              <div className="space-y-3">
                <button type="button" onClick={handleCerrarTurno} disabled={isGeneratingPDF} className="w-full rounded-[24px] bg-black text-white shadow-[0_16px_32px_rgba(0,0,0,0.22)] flex flex-col items-center justify-center py-8 px-6 gap-4 active:scale-[0.98] disabled:opacity-50">
                  <div className="w-[88px] h-[88px] rounded-[20px] bg-white/10 grid place-items-center">
                    <svg width="56" height="56" viewBox="0 0 64 64" fill="none"><path d="M20 28V20C20 13.37 26.37 8 33 8C39.63 8 46 13.37 46 20V28" stroke="white" strokeWidth="2.6" strokeLinecap="round"/><rect x="12" y="28" width="40" height="28" rx="8" stroke="white" strokeWidth="2.4"/><circle cx="32" cy="42" r="4" fill="white"/><path d="M32 46V50" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                  </div>
                  <p className="font-bold text-[24px] leading-none tracking-tight lowercase">cerrar caja</p>
                  {isGeneratingPDF && <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 animate-pulse">generando...</span>}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={generarPDF} disabled={isGeneratingPDF} className="h-11 rounded-[14px] bg-white border border-black/10 font-bold text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-30"><Download className="w-4 h-4" /> pdf</button>
                  <div className="h-11 rounded-[14px] bg-[#FFFBF2] border border-black/5 grid place-items-center text-[11px] font-bold text-black/40">{fmtMoney(totalADejar)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view==='historial' && (
          <div className="max-w-[760px] mx-auto animate-[fadeIn_0.25s_ease]">
            <div className="flex items-center justify-between"><button onClick={()=>setView('home')} className="h-8 px-3 rounded-full bg-white border border-black/10 text-[12px] font-bold flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> inicio</button><button onClick={()=>{ if(confirm('Limpiar?')) setState(s=>({...s, historial:[]})); }} className="h-8 px-3 rounded-full bg-white border border-black/10 text-[11px] font-bold">limpiar</button></div>
            <h2 className="mt-4 font-bold text-[26px] tracking-tight lowercase">historial</h2>
            <div className="mt-4 space-y-2">
              {state.historial.length===0 ? <div className="bg-white rounded-[20px] border border-black/5 p-10 text-center"><p className="font-bold text-[13px] lowercase">—</p></div> : state.historial.map(h=>(
                <div key={h.id} className="bg-white rounded-[20px] border border-black/5 p-4 cursor-pointer" onClick={()=>setHistorialDetail(h)}>
                  <div className="flex justify-between items-start gap-3">
                    <div><p className="text-[12px] font-bold">{new Date(h.fechaISO).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</p><p className="text-[11px] text-black/50 mt-1">{fmtMoney(h.ventasHoy.efectivo)} · {fmtMoney(h.cierreCalculado.transferenciasTotal)}</p><p className="mt-2 text-[13px]"><span className="font-bold">{fmtMoney(h.cierreCalculado.totalADejar)}</span> <span className="text-[10px] text-black/30">{fmtMoney(h.cierreCalculado.diferenciaJustificada)}</span></p></div>
                    <button onClick={(e)=>{ e.stopPropagation(); if(confirm('Borrar?')) setState(s=>({...s, historial:s.historial.filter(x=>x.id!==h.id)})); }} className="w-7 h-7 rounded-full bg-[#FFFBF2] border grid place-items-center"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view==='archivos' && (
          <div className="max-w-[760px] mx-auto animate-[fadeIn_0.25s_ease]">
            <div className="flex items-center justify-between"><button onClick={()=>setView('home')} className="h-8 px-3 rounded-full bg-white border border-black/10 text-[12px] font-bold flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> inicio</button>{state.archivos.length>0 && <button onClick={()=>{ if(confirm('Borrar pdf?')) setState(s=>({...s, archivos:[]})); }} className="h-8 px-3 rounded-full bg-white border border-black/10 text-[11px] font-bold">limpiar</button>}</div>
            <h2 className="mt-4 font-bold text-[26px] tracking-tight lowercase">archivos</h2>
            <div className="mt-4 space-y-2">
              {state.archivos.length===0 ? <div className="bg-white rounded-[20px] border border-black/5 p-10 text-center"><div className="w-12 h-12 rounded-full bg-[#FFFBF2] border border-black/5 grid place-items-center mx-auto mb-3"><FileText className="w-5 h-5 text-black/40" /></div><p className="font-bold text-[13px] lowercase">—</p></div> : state.archivos.map(f=>(
                <div key={f.id} className="bg-white rounded-[20px] border border-black/5 p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-[#FFFBF2] border border-black/5 grid place-items-center shrink-0"><FileText className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0"><p className="text-[12px] font-bold truncate">{f.nombre}</p><p className="text-[11px] text-black/50">{new Date(f.fechaISO).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})} · {fmtMoney(f.totalADejar)}</p></div>
                  <div className="flex items-center gap-1.5 shrink-0"><button onClick={()=>setPdfViewer(f)} className="w-8 h-8 rounded-full bg-[#FFFBF2] border border-black/5 grid place-items-center"><Eye className="w-4 h-4" /></button><button onClick={()=>{ try{ const a=document.createElement('a'); a.href=f.dataUrl; a.download=f.nombre; document.body.appendChild(a); a.click(); a.remove(); }catch{} }} className="w-8 h-8 rounded-full bg-black text-white grid place-items-center"><Download className="w-4 h-4" /></button><button onClick={()=>{ if(confirm('Borrar?')) setState(s=>({...s, archivos:s.archivos.filter(x=>x.id!==f.id)})); }} className="w-8 h-8 rounded-full bg-white border border-black/10 grid place-items-center"><Trash2 className="w-4 h-4" /></button></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <NumericKeypad active={activeNumeric} onClose={closeNumeric} />

      {ticketModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={()=>setTicketModal(null)}>
          <div className="bg-white rounded-[20px] p-2 max-w-[520px] w-full shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-3"><p className="text-[12px] font-bold lowercase">foto</p><button onClick={()=>setTicketModal(null)} className="w-7 h-7 rounded-full bg-black text-white grid place-items-center"><X className="w-4 h-4" /></button></div>
            <img src={ticketModal} className="w-full rounded-[14px] max-h-[75vh] object-contain bg-[#FFFBF2]" alt="t" />
          </div>
        </div>
      )}
      {pdfViewer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-3 md:p-6 flex flex-col" onClick={()=>setPdfViewer(null)}>
          <div className="bg-white rounded-[20px] w-full max-w-[900px] mx-auto flex-1 flex flex-col overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="h-12 px-4 flex items-center justify-between border-b border-black/5 shrink-0"><div className="flex items-center gap-2 min-w-0"><FileText className="w-4 h-4 shrink-0" /><p className="text-[12px] font-bold truncate">{pdfViewer.nombre}</p></div><div className="flex items-center gap-2"><button onClick={()=>{ try{ const a=document.createElement('a'); a.href=pdfViewer.dataUrl; a.download=pdfViewer.nombre; document.body.appendChild(a); a.click(); a.remove(); }catch{} }} className="h-7 px-3 rounded-full bg-black text-white text-[11px] font-bold flex items-center gap-1"><Download className="w-3.5 h-3.5" /> descargar</button><button onClick={()=>setPdfViewer(null)} className="w-7 h-7 rounded-full bg-[#FFFBF2] border grid place-items-center"><X className="w-4 h-4" /></button></div></div>
            <div className="flex-1 bg-[#FFFBF2] relative"><iframe src={pdfViewer.dataUrl} className="w-full h-full border-0" title={pdfViewer.nombre} /></div>
          </div>
        </div>
      )}
      {historialDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-auto p-4" onClick={()=>setHistorialDetail(null)}>
          <div className="bg-[#FFFBF2] rounded-[24px] max-w-[640px] w-full mx-auto my-6 shadow-2xl overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="p-4 bg-white border-b border-black/5 flex items-center justify-between"><h3 className="font-bold text-[13px] lowercase flex items-center gap-2"><FileText className="w-4 h-4" /> {new Date(historialDetail.fechaISO).toLocaleString('es-MX')}</h3><button onClick={()=>setHistorialDetail(null)} className="w-7 h-7 rounded-full bg-[#FFFBF2] border grid place-items-center"><X className="w-4 h-4" /></button></div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-white border">fondo {fmtMoney(historialDetail.apertura.fondo)}</div>
                <div className="p-2.5 rounded-xl bg-white border">tarjeta {fmtMoney((historialDetail.apertura as any).ventasTarjetaCesar ?? 0)}</div>
                <div className="p-2.5 rounded-xl bg-white border">ef {fmtMoney(historialDetail.ventasHoy.efectivo)}</div>
                <div className="p-2.5 rounded-xl bg-white border">tj {fmtMoney(historialDetail.ventasHoy.tarjeta)}</div>
                <div className="p-2.5 rounded-xl bg-black text-white col-span-2">a dejar {fmtMoney(historialDetail.cierreCalculado.totalADejar)} · transf {fmtMoney(historialDetail.cierreCalculado.transferenciasTotal)} · dif {fmtMoney(historialDetail.cierreCalculado.diferenciaJustificada)}</div>
              </div>
              <div className="bg-white rounded-xl border p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-black/30">{historialDetail.proveedores.length} · {fmtMoney(historialDetail.cierreCalculado.gastosFondo)} / {fmtMoney(historialDetail.cierreCalculado.gastosCaja)}</p><div className="mt-2 space-y-1.5 max-h-[200px] overflow-auto">{historialDetail.proveedores.map(p=><div key={p.id} className="flex justify-between text-[11px] p-2 rounded-lg bg-[#FFFBF2]"><span>{p.nombre} {fmtMoney(p.total)}</span><span className="font-bold">{p.deFondo>0&&p.deCaja>0?'comb':p.deFondo>0?'fondo':'caja'}</span></div>)}</div></div>
              <div className="bg-white rounded-xl border p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-black/30">conteos</p><div className="mt-2 grid grid-cols-3 gap-2 text-[11px]"><div className="p-2 rounded-lg bg-[#FFFBF2]">caja {fmtMoney(historialDetail.cierreCalculado.totalCaja)}</div><div className="p-2 rounded-lg bg-[#FFFBF2]">fondo {fmtMoney(historialDetail.cierreCalculado.totalFondo)}</div><div className="p-2 rounded-lg bg-[#FFFBF2]">general {fmtMoney(historialDetail.cierreCalculado.totalGeneral)}</div></div></div>
              <div className="bg-white rounded-xl border p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-black/30">fotos</p><div className="mt-2 grid grid-cols-3 gap-2">{[...historialDetail.proveedores.filter(p=>p.ticket).map(p=>p.ticket!), ...historialDetail.transferencias.filter(t=>t.comprobante).map(t=>t.comprobante!)].map((src,i)=><img key={i} src={src!} onClick={()=>setTicketModal(src!)} className="w-full h-20 object-cover rounded-xl border cursor-pointer" alt="f" />)}</div></div>
            </div>
          </div>
        </div>
      )}
      {showAddFondoModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={()=>{ setShowAddFondoModal(false); setActiveNumeric(null); }}>
          <div className="bg-white rounded-[24px] w-full max-w-[420px] shadow-[0_24px_64px_rgba(0,0,0,0.28)] border border-black/5 overflow-hidden animate-[fadeIn_0.22s_ease]" onClick={e=>e.stopPropagation()}>
            <div className="p-5 pb-3 flex items-start justify-between gap-3"><div><h3 className="font-bold text-[18px] tracking-tight lowercase leading-none">agregar fondo</h3></div><button onClick={()=>{ setShowAddFondoModal(false); setActiveNumeric(null); }} className="w-8 h-8 rounded-full bg-[#FFFBF2] border border-black/5 grid place-items-center"><X className="w-4 h-4" /></button></div>
            <div className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[14px] bg-[#FFFBF2] border border-black/5 p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-black/40">actual</p><p className="mt-1 font-bold text-[16px]">{fmtMoney(state.apertura.fondo)}</p></div>
                <div className="rounded-[14px] bg-black text-white p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-white/50">restante</p><p className="mt-1 font-bold text-[16px]">{fmtMoney(fondoRestante)}</p></div>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-black/40">monto</span>
                <button type="button" onClick={()=>openNumeric('add-fondo',addFondoMonto,(v)=>setAddFondoMonto(v),'monto')} className="w-full h-[62px] rounded-[16px] border border-black/10 bg-white px-4 flex items-center justify-between hover:border-black/20 transition text-left">
                  <span className={`font-bold text-[26px] tracking-tight ${addFondoMonto?'text-black':'text-black/20'}`}>{addFondoMonto?fmtMoney(parseFloat(addFondoMonto)||0):'$0.00'}</span><span className="text-[10px] font-bold uppercase tracking-widest text-black/30 ml-2">MXN</span>
                </button>
                <div className="grid grid-cols-3 gap-2">{[100,200,500].map(v=><button key={v} onClick={()=>addQuickFondo(v)} className="h-10 rounded-full bg-[#FFFBF2] border border-black/5 text-[12px] font-bold hover:bg-black hover:text-white transition">+${v}</button>)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1"><button onClick={()=>{ setShowAddFondoModal(false); setActiveNumeric(null); setAddFondoMonto(''); }} className="h-11 rounded-full bg-white border border-black/10 text-[13px] font-bold">cancelar</button><button onClick={handleConfirmAddFondo} disabled={!addFondoMonto || (parseFloat(addFondoMonto)||0)<=0} className="h-11 rounded-full bg-black text-white text-[13px] font-bold disabled:opacity-30 flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" /> agregar</button></div>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] bg-black text-white text-[12px] font-bold px-4 py-2.5 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.3)] animate-[fadeIn_0.22s_ease] flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-white/15 grid place-items-center"><Check className="w-3 h-3" /></div>{toast}
        </div>
      )}
      <style>{`button{cursor:pointer} input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0} input[type=number]{-moz-appearance:textfield}`}</style>
    </div>
  );
}
