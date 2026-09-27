import { getSettings } from '../db/repo';
import { useSettings } from './hooks';

const en = {
  // tabs
  dashboard: 'Dashboard', routes: 'Routes', expenses: 'Expenses', tax: 'Tax', settings: 'Settings',
  // common
  save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add', close: 'Close', confirmDelete: 'Delete this item?',
  none: 'None', other: 'Other', notes: 'Notes', date: 'Date', amount: 'Amount', vehicle: 'Vehicle', total: 'Total', required: 'Required',
  yes: 'Yes', no: 'No', search: 'Search', all: 'All', optional: 'optional',
  // dashboard
  last7Days: 'Last 7 days', thisMonth: 'This month', vsPrevious: 'vs previous 7 days', weekly: 'Week', monthly: 'Month', annual: 'Year',
  todaysRoutes: "Today's routes", byWorkType: 'By work type', perHour: '/h', perMile: '/mi', hoursWorked: 'hours',
  noRoutesToday: 'No routes today', activeDays: 'Active days', avgDaily: 'Avg / active day', totalRoutes: 'Total routes',
  // routes
  startRoute: 'Start route', endRoute: 'End route', newRoute: 'New route', routeInProgress: 'Route in progress',
  workType: 'Work type', status: 'Status', scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled',
  scheduleStart: 'Scheduled start', scheduleEnd: 'Scheduled end', actualStart: 'Actual start', actualEnd: 'Actual end',
  actualSameAsSchedule: 'Actual times same as schedule', estimatedIncome: 'Estimated income', incomes: 'Income',
  incomeSource: 'Source', addIncome: 'Add income line', startMile: 'Start odometer', endMile: 'End odometer', distance: 'Distance',
  totalIncome: 'Total income', noRoutes: 'No routes yet', importCsv: 'Import CSV', cancelRoute: 'Cancel route',
  gpsTracked: 'GPS distance', gpsPoints: 'GPS points', useGps: 'Use GPS', autofilledFromGps: 'Filled in from the GPS path: start + {d}',
  trackingBackground: 'Recording GPS in the background', trackingForeground: 'Recording GPS while the app is open – allow "all the time" location to record in the background',
  trackingDenied: 'Location permission denied – distance is not being recorded', trackingOff: 'GPS recording is off (Settings)',
  map: 'Map', noPath: 'No GPS points recorded for this route', elapsed: 'Elapsed', last7: '7 days', last14: '14 days', last30: '30 days',
  sortNewest: 'Newest', sortOldest: 'Oldest', sortIncome: 'Income', endBeforeStart: 'End odometer is lower than the start',
  // expenses
  category: 'Category', merchant: 'Merchant', litres: 'Litres', odometerOnReceipt: 'Odometer (miles)', fullyBusiness: '100% business (not apportioned)',
  photo: 'Photo', addPhoto: 'Add photo', takePhoto: 'Take photo', readReceipt: 'Read receipt (online)', odometer: 'Odometer',
  odometerReadings: 'Odometer readings', miles: 'Miles', source: 'Source', newExpense: 'New expense', newReading: 'New reading',
  milesCovered: 'Miles covered', noExpenses: 'No expenses', noReadings: 'No odometer readings', taxYear: 'Tax year',
  fuel: 'Fuel', insurance: 'Insurance', servicing: 'Servicing', repairs: 'Repairs', mot: 'MOT', roadTax: 'Road tax', breakdown: 'Breakdown cover',
  parking: 'Parking', tolls: 'Tolls', cleaning: 'Cleaning', financeInterest: 'Finance interest', vehiclePurchase: 'Vehicle purchase',
  manual: 'Manual', fuelStop: 'Fuel stop', taxYearStart: 'Tax year start', taxYearEnd: 'Tax year end',
  // vehicles
  vehicles: 'Vehicles', registration: 'Registration', make: 'Make', model: 'Model', vehicleType: 'Type', car: 'Car', van: 'Van', motorcycle: 'Motorcycle',
  fuelType: 'Fuel', petrol: 'Petrol', diesel: 'Diesel', hybrid: 'Hybrid', electric: 'Electric', co2: 'CO2 (g/km)',
  purchaseDate: 'Purchase / first used', purchasePrice: 'Purchase price', isNew: 'Bought new', disposalDate: 'Disposal date', disposalProceeds: 'Disposal proceeds',
  financeType: 'Finance', cash: 'Cash', hp: 'Hire purchase', lease: 'Lease', claimMethod: 'Claim method', actualCost: 'Actual costs', mileage: 'Flat-rate mileage',
  lockedFrom: 'Method locked from tax year', poolBf: 'Pool b/f (written-down value)', poolBfYear: 'Pool b/f tax year', active: 'Active',
  lookupDvla: 'Look up (DVLA, online)', assignByDate: 'Assign records by date', assigned: 'Assigned {r} routes, {e} expenses, {o} readings',
  noVehicles: 'No vehicles yet', newVehicle: 'New vehicle',
  // work types
  workTypes: 'Work types', newWorkType: 'New work type', name: 'Name', description: 'Description', incomeSources: 'Income sources',
  defaultAmount: 'Default amount', isRequired: 'Required',
  // tax
  combined: 'All vehicles (combined)', businessUseOverride: 'Business use % override', businessMiles: 'Business miles', totalMiles: 'Total miles',
  businessUse: 'Business use', allowable: 'Allowable', disallowable: 'Disallowable', capitalAllowance: 'Capital allowance',
  simplified: 'Simplified expenses (flat rate)', comparison: 'Comparison', betterMethod: 'Better method', sa103: 'SA103 boxes', warnings: 'Warnings',
  exportCsv: 'Export CSV', totalClaim: 'Total claim', unassigned: 'Unassigned records', receiptsMissing: 'Receipts missing',
  // settings
  preferences: 'Preferences', language: 'Language', currency: 'Currency', mileageUnit: 'Odometer unit', trackRoutes: 'Record GPS during routes',
  sync: 'Sync with IncomeMeter (Azure)', serverUrl: 'Server address', signIn: 'Sign in with Google', signOut: 'Sign out', syncNow: 'Sync now',
  account: 'Account', lastSync: 'Last sync', never: 'Never', signedInAs: 'Signed in as {e}', pasteToken: 'Or paste an API token', useToken: 'Use token',
  syncDone: 'Sync complete: {p} sent, {g} received', syncOptional: 'Optional. Everything works offline on this phone; sync copies it to your account.',
  data: 'Data', manageVehicles: 'Vehicles', manageWorkTypes: 'Work types', chartPeriod: 'Default chart period', fiscalStart: 'Fiscal year start (MM-DD)',
};

type Key = keyof typeof en;

const zh: Record<Key, string> = {
  dashboard: '總覽', routes: '路線', expenses: '開支', tax: '稅務', settings: '設定',
  save: '儲存', cancel: '取消', delete: '刪除', edit: '編輯', add: '新增', close: '關閉', confirmDelete: '確定刪除？',
  none: '無', other: '其他', notes: '備註', date: '日期', amount: '金額', vehicle: '車輛', total: '總計', required: '必填',
  yes: '是', no: '否', search: '搜尋', all: '全部', optional: '可選',
  last7Days: '過去 7 日', thisMonth: '本月', vsPrevious: '對比之前 7 日', weekly: '週', monthly: '月', annual: '年',
  todaysRoutes: '今日路線', byWorkType: '按工作類型', perHour: '/小時', perMile: '/英里', hoursWorked: '小時',
  noRoutesToday: '今日未有路線', activeDays: '開工日數', avgDaily: '每個開工日平均', totalRoutes: '路線總數',
  startRoute: '開始路線', endRoute: '結束路線', newRoute: '新增路線', routeInProgress: '路線進行中',
  workType: '工作類型', status: '狀態', scheduled: '已排程', in_progress: '進行中', completed: '已完成', cancelled: '已取消',
  scheduleStart: '預定開始', scheduleEnd: '預定結束', actualStart: '實際開始', actualEnd: '實際結束',
  actualSameAsSchedule: '實際時間與預定相同', estimatedIncome: '預計收入', incomes: '收入',
  incomeSource: '來源', addIncome: '新增收入項目', startMile: '開始里數', endMile: '結束里數', distance: '距離',
  totalIncome: '總收入', noRoutes: '未有路線', importCsv: '匯入 CSV', cancelRoute: '取消路線',
  gpsTracked: 'GPS 距離', gpsPoints: 'GPS 點數', useGps: '用 GPS', autofilledFromGps: '已按 GPS 路徑自動填寫：開始 + {d}',
  trackingBackground: '正在背景記錄 GPS', trackingForeground: '只會喺 app 開住時記錄 GPS – 允許「一律允許」位置權限先可以背景記錄',
  trackingDenied: '冇位置權限 – 無法記錄距離', trackingOff: 'GPS 記錄已關閉（設定）',
  map: '地圖', noPath: '呢條路線未有 GPS 記錄', elapsed: '已用時間', last7: '7 日', last14: '14 日', last30: '30 日',
  sortNewest: '最新', sortOldest: '最舊', sortIncome: '收入', endBeforeStart: '結束里數低過開始里數',
  category: '類別', merchant: '商戶', litres: '公升', odometerOnReceipt: '里程表（英里）', fullyBusiness: '100% 業務用途（不分攤）',
  photo: '相片', addPhoto: '加相片', takePhoto: '影相', readReceipt: '讀取收據（需連線）', odometer: '里程表',
  odometerReadings: '里程表讀數', miles: '英里', source: '來源', newExpense: '新增開支', newReading: '新增讀數',
  milesCovered: '行駛里數', noExpenses: '未有開支', noReadings: '未有里程表讀數', taxYear: '課稅年度',
  fuel: '燃油', insurance: '保險', servicing: '保養', repairs: '維修', mot: 'MOT 驗車', roadTax: '道路稅', breakdown: '拯救服務',
  parking: '泊車', tolls: '過路費', cleaning: '清潔', financeInterest: '融資利息', vehiclePurchase: '購車',
  manual: '手動', fuelStop: '入油', taxYearStart: '課稅年度開始', taxYearEnd: '課稅年度結束',
  vehicles: '車輛', registration: '車牌', make: '品牌', model: '型號', vehicleType: '類型', car: '私家車', van: '貨車', motorcycle: '電單車',
  fuelType: '燃料', petrol: '汽油', diesel: '柴油', hybrid: '混能', electric: '電動', co2: 'CO2（g/km）',
  purchaseDate: '購入／開始使用', purchasePrice: '購入價', isNew: '新車', disposalDate: '出售日期', disposalProceeds: '出售所得',
  financeType: '付款方式', cash: '現金', hp: '分期', lease: '租賃', claimMethod: '申報方法', actualCost: '實際開支', mileage: '里數定額',
  lockedFrom: '方法鎖定自課稅年度', poolBf: '承前資產池（減值後）', poolBfYear: '承前資產池年度', active: '使用中',
  lookupDvla: 'DVLA 查詢（需連線）', assignByDate: '按日期分配記錄', assigned: '已分配 {r} 條路線、{e} 項開支、{o} 個讀數',
  noVehicles: '未有車輛', newVehicle: '新增車輛',
  workTypes: '工作類型', newWorkType: '新增工作類型', name: '名稱', description: '描述', incomeSources: '收入來源',
  defaultAmount: '預設金額', isRequired: '必填',
  combined: '所有車輛（合併）', businessUseOverride: '業務用途 % 覆寫', businessMiles: '業務里數', totalMiles: '總里數',
  businessUse: '業務用途', allowable: '可扣除', disallowable: '不可扣除', capitalAllowance: '資本免稅額',
  simplified: '簡化開支（定額）', comparison: '比較', betterMethod: '較佳方法', sa103: 'SA103 欄目', warnings: '提示',
  exportCsv: '匯出 CSV', totalClaim: '申報總額', unassigned: '未分配記錄', receiptsMissing: '缺少收據',
  preferences: '偏好', language: '語言', currency: '貨幣', mileageUnit: '里程表單位', trackRoutes: '路線進行中記錄 GPS',
  sync: '同步到 IncomeMeter（Azure）', serverUrl: '伺服器地址', signIn: '用 Google 登入', signOut: '登出', syncNow: '立即同步',
  account: '帳戶', lastSync: '上次同步', never: '從未', signedInAs: '已登入：{e}', pasteToken: '或者貼上 API token', useToken: '使用 token',
  syncDone: '同步完成：上載 {p}，下載 {g}', syncOptional: '可選。所有功能都可以喺手機離線使用；同步會複製到你嘅帳戶。',
  data: '資料', manageVehicles: '車輛', manageWorkTypes: '工作類型', chartPeriod: '預設圖表時段', fiscalStart: '財政年度開始（MM-DD）',
};

const dicts: Record<string, Record<Key, string>> = { 'en-GB': en, 'zh-HK': zh };

export type TKey = Key;

export function translate(key: Key, vars?: Record<string, string | number>, language = getSettings().language): string {
  let s = (dicts[language] ?? en)[key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/** Hook form so screens re-render when the language changes. */
export function useT() {
  const { language } = useSettings();
  return (key: Key, vars?: Record<string, string | number>) => translate(key, vars, language);
}

/** Translate a value that may be a known key (category, status…) and fall back to the raw value. */
export function tOr(t: ReturnType<typeof useT>, value: string | null | undefined): string {
  if (!value) return '';
  return value in en ? t(value as Key) : value;
}
