import XLSX from 'xlsx';
import crypto from 'crypto';
import type { ExcelParsedExpense, ExpenseCategoryType, PaymentMethodType } from '../src/types.js';

const MAIN_SHEET = 'REPORTE DE GASTOS MENSUAL';
const CONFIG_SHEET = 'DIMER_CONFIG';
const DATE_COLS = [3,4,5,6,7,8,9];
const COMPANY_ROWS = [...range(13,20),...range(22,27),...range(29,33),...range(35,36)];
const PERSONAL_ROWS = range(40,45);
function range(a:number,b:number){return Array.from({length:b-a+1},(_,i)=>a+i);}
function norm(v:unknown){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();}
function num(v:unknown){const n=typeof v==='number'?v:Number(String(v??'').replace(/[$,\s]/g,''));return Number.isFinite(n)?n:0;}
function dateOf(v:unknown){if(v instanceof Date&&!isNaN(v.getTime()))return v.toISOString().slice(0,10);if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}const d=new Date(String(v??''));return isNaN(d.getTime())?'':d.toISOString().slice(0,10);}
function cat(c:string):ExpenseCategoryType|undefined{const m:Record<string,ExpenseCategoryType>={'ESTANCIA/ HOSPEDAJE':'HOSPEDAJE','ESTANCIA/HOSPEDAJE':'HOSPEDAJE','BOLETOS DE AUTOBUS':'TRANSPORTE_FORANEO','GASOLINA':'GASOLINA','ESTACIONAMIENTO':'ESTACIONAMIENTO','CASETAS':'CASETAS','RENTAS DE AUTOS':'TRANSPORTE_LOCAL','TAXI':'TRANSPORTE_LOCAL','UBER OR OTHERS':'TRANSPORTE_LOCAL','DESAYUNO':'ALIMENTOS','COMIDA':'ALIMENTOS','CENA':'ALIMENTOS','SNACK / CAFE':'ALIMENTOS','TRAGOS':'ALIMENTOS','PROPINA':'ALIMENTOS','MANTENIMIENTO':'GASTOS_MENORES','TELEFONO DE CASA / CELULAR':'GASTOS_MENORES','PAPELERIA':'GASTOS_MENORES','MUEBLES Y MMTO DE EQUIPO':'GASTOS_MENORES','ENVIOS POSTALES':'GASTOS_MENORES','ENTRETENIMIENTO CLIENTES':'GASTOS_MENORES','REGALOS CLIENTES':'GASTOS_MENORES','OTROS (LAVAR ROPA)':'GASTOS_MENORES','BOLETOS DE AVION':'TRANSPORTE_FORANEO'};return m[norm(c)];}
function config(ws:XLSX.WorkSheet){const rows=XLSX.utils.sheet_to_json<any[]>(ws,{header:1,raw:true,defval:null});const m=new Map<string,string>();for(let i=3;i<rows.length;i++){const k=String(rows[i]?.[0]??'').trim();if(k)m.set(k,String(rows[i]?.[1]??'').trim());}return m;}
export function parseDimerExpenseExcel(input:{fileName:string;fileSize:number;fileType:string;dataUrl:string;uploadedBy?:string;}){
 const mt=input.dataUrl.match(/^data:([^;]+);base64,(.+)$/);if(!mt)throw new Error('No fue posible leer el contenido binario del archivo Excel.');
 const buffer=Buffer.from(mt[2],'base64');if(!buffer.length)throw new Error('El archivo Excel está vacío.');if(buffer.length>15*1024*1024)throw new Error('El archivo Excel supera el límite de 15 MB.');
 let wb:XLSX.WorkBook;try{wb=XLSX.read(buffer,{type:'buffer',cellDates:true});}catch{throw new Error('El archivo no es un Excel .xlsx válido o está dañado.');}
 if(!wb.SheetNames.includes(MAIN_SHEET))throw new Error(`La plantilla no es compatible: falta la hoja "${MAIN_SHEET}".`);
 if(!wb.SheetNames.includes(CONFIG_SHEET))throw new Error('La plantilla oficial está incompleta: falta la hoja DIMER_CONFIG.');
 const s=wb.Sheets[MAIN_SHEET], cfg=config(wb.Sheets[CONFIG_SHEET]);
 const required:[string,string][]=[['PLANTILLA_ID','DIMER_REPORTE_GASTOS'],['HOJA_PRINCIPAL',MAIN_SHEET],['FECHA_LABEL_CELL','B8'],['FECHA_COLUMNS','C:I'],['CONCEPTO_COLUMN','B'],['IMPORTE_COLUMNS','C:I'],['ROW_TOTAL_COLUMN','J'],['TC_EMPRESA_PAYMENT_METHOD','TARJETA_EMPRESA'],['PERSONAL_PAYMENT_METHOD','REQUIERE_REVISION'],['REEMBOLSO_LABEL_CELL','B46'],['TOTAL_GASTOS_LABEL_CELL','B47'],['ORIGINAL_FILE_REQUIRED','TRUE'],['STRICT_TEMPLATE_CHECK','TRUE']];
 const bad=required.filter(([k,v])=>cfg.get(k)!==v);if(bad.length)throw new Error(`La plantilla DIMER_CONFIG no coincide con el contrato oficial: ${bad.map(([k,v])=>k+' esperaba '+v).join('; ')}.`);
 if(norm(s.B8?.v)!=='FECHA'||norm(s.B46?.v)!=='REEMBOLSO'||norm(s.B47?.v)!=='TOTAL DE GASTOS')throw new Error('La estructura visible de la plantilla no coincide con el contrato DIMER.');
 const dates=DATE_COLS.map(c=>dateOf(s[XLSX.utils.encode_cell({r:7,c:c-1})]?.v));if(dates.some(x=>!x))throw new Error('La plantilla no contiene fechas válidas en C8:I8.');
 const items:ExcelParsedExpense[]=[];const warnings:string[]=[];
 const read=(rows:number[],paymentMethod?:PaymentMethodType,sectionTitle='')=>{for(const r of rows){const concept=String(s[`B${r}`]?.v??'').trim();if(!concept)continue;for(let i=0;i<DATE_COLS.length;i++){const col=DATE_COLS[i], amount=Number(num(s[XLSX.utils.encode_cell({r:r-1,c:col-1})]?.v).toFixed(2));if(amount<=0)continue;items.push({id:`excel_${r}_${col}_${crypto.randomUUID()}`,concept,sourceCategory:concept,amount,expenseDate:dates[i],category:cat(concept),paymentMethod,sectionTitle,excelCellRef:`${XLSX.utils.encode_col(col-1)}${r}`});}}};
 read(COMPANY_ROWS,'TARJETA_EMPRESA','TC EMPRESARIAL');read(PERSONAL_ROWS,undefined,'GASTOS EN EFECTIVO o TC PERSONAL');
 const totalImported=Number(items.reduce((a,x)=>a+x.amount,0).toFixed(2));const controlJ=num(s.J47?.v);const controlDaily=DATE_COLS.reduce((a,c)=>a+num(s[XLSX.utils.encode_cell({r:46,c:c-1})]?.v),0);const totalExcel=Number((controlJ||controlDaily).toFixed(2));const difference=Number(Math.abs(totalExcel-totalImported).toFixed(2));
 if(difference>.01)warnings.push(`Diferencia de conciliación: Excel ${totalExcel.toFixed(2)} vs partidas ${totalImported.toFixed(2)}.`);
 if(items.some(x=>x.sectionTitle==='GASTOS EN EFECTIVO o TC PERSONAL'))warnings.push('El bloque "GASTOS EN EFECTIVO o TC PERSONAL" requiere confirmar ANTICIPO o PERSONAL_REEMBOLSO antes de finalizar.');
 const uploadedAt=new Date().toISOString(),digest=crypto.createHash('sha256').update(buffer).digest('hex').slice(0,24);
 return {items,originalExcelFile:{id:`excel_${digest}`,name:input.fileName,size:input.fileSize||buffer.length,type:input.fileType||'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',dataUrl:input.dataUrl,uploadedAt,role:'DOCUMENTO_ORIGINAL_EXCEL' as const},excelAuditSummary:{filename:input.fileName,sizeBytes:input.fileSize||buffer.length,uploadedAt,uploadedBy:input.uploadedBy,sheetName:MAIN_SHEET,totalExcel,totalImported,difference,itemsCount:items.length,reconciliationStatus:difference<=.01?'CONCILIACION_CORRECTA' as const:'DIFERENCIA_DETECTADA' as const},warnings,totalExcel};
}