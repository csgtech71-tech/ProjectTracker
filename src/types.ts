export type Tab =
  | 'dashboard'
  | 'summary'
  | 'stakeholders'
  | 'timeline'
  | 'tracking'
  | 'sow'
  | 'costing'
  | 'readiness'
  | 'closure'
  | 'settings'
  | 'analyzer';

export type Sentiment = 'happy' | 'disappointed' | 'sad' | 'angry';
export type UserRole = 'admin' | 'user';
export type DeploymentType = 'onsite' | 'remote' | 'both';

export interface AppUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  phone?: string;
}

export interface ProjectRevision {
  id: string;
  version: number;
  timestamp: string;
  author: string;
  comment: string;
  changesSummary?: string;
}

export type HardwareAuthType =
  | 'Card Only'
  | 'Card + Pin'
  | 'Card/User Id/Fingerprint'
  | 'Card/User Id + Pin'
  | 'Card/User Id + Fingerprint'
  | 'Card/User Id + Fingerprint (Pin Fallback)'
  | 'Fingerprint Only';

export interface HardwareNode {
  id: string;
  project_id?: string;
  friendlyName?: string;
  serialNumber?: string;
  macAddress?: string;
  locationId?: string;
  installDate?: string;
  status: 'active' | 'maintenance' | 'offline';
  authType?: HardwareAuthType;
  firmware?: string;
  ipAddress?: string;
  wifiSsid?: string;
  notes?: string;
  lastSeen?: string;
  certExpires?: string;
}

// Raw event parsed from a log file (stored in DB)
export interface AccessEvent {
  id?: string;
  import_id?: string;
  device_id: string;
  project_id?: string;
  occurred_at: string; // ISO
  auth_type: HardwareAuthType;
  result: 'success' | 'failure' | 'unknown';
  failure_reason?: string;
  user_id_raw?: string;
  card_bits?: number;
  door_id?: number;
  door_open_at?: string;
  door_close_at?: string;
  door_open_ms?: number;
}

export interface SystemEvent {
  id?: string;
  import_id?: string;
  device_id: string;
  project_id?: string;
  occurred_at: string;
  event_type: string;
  module: string;
  details: string;
  raw_line?: string;
}

export interface LogImport {
  id?: string;
  device_id: string;
  project_id: string;
  filename: string;
  imported_by?: string;
  line_count: number;
  event_count: number;
  imported_at?: string;
}

export interface AnalyticsDisplaySettings {
  id?: string;
  project_id?: string;
  show_access_timeline: boolean;
  show_auth_method_breakdown: boolean;
  show_failed_attempts: boolean;
  show_door_open_duration: boolean;
  show_user_activity: boolean;
  show_mqtt_events: boolean;
  show_reboots: boolean;
  show_health_checks: boolean;
  show_firmware_info: boolean;
  show_wifi_signal: boolean;
  show_ip_address: boolean;
  show_cert_expiry: boolean;
  show_config_changes: boolean;
}

export const DEFAULT_ANALYTICS_SETTINGS: AnalyticsDisplaySettings = {
  show_access_timeline: true,
  show_auth_method_breakdown: true,
  show_failed_attempts: true,
  show_door_open_duration: true,
  show_user_activity: true,
  show_mqtt_events: false,
  show_reboots: false,
  show_health_checks: false,
  show_firmware_info: false,
  show_wifi_signal: false,
  show_ip_address: false,
  show_cert_expiry: false,
  show_config_changes: false,
};

export interface SuccessCriterion {
  id: string;
  text: string;
  isMet: boolean;
}

export type MilestoneType =
  | 'success'
  | 'exception'
  | 'failure'
  | 'milestone'
  | 'start'
  | 'finish'
  | 'meeting'
  | 'delayed'
  | 'onhold'
  | 'blocked'
  | 'internal-task'
  | 'customer-task'
  | 'touchpoint';

export interface Milestone {
  id: string;
  title: string;
  date: string;
  type: MilestoneType;
  description: string;
  iconVariant?: number;
}

export interface TimelineItem {
  id: string;
  text: string;
  date: string;
  isMet: boolean;
  assignee: 'internal' | 'customer';
  isEod: boolean;
}

export interface SurveyQuestion {
  id: string;
  question: string;
  type: 'rating' | 'text' | 'boolean';
}

export interface Contact {
  id: string;
  side: 'customer' | 'internal';
  name: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  address: string;
  notes: string;
  locationId?: string;
}

export interface ProjectLocation {
  id: string;
  name: string;
  address: string;
  stakeholderName: string;
  stakeholderEmail: string;
  stakeholderPhone: string;
  stakeholderRole: string;
  numUsers?: number;
  numSafes?: number;
  deploymentType?: 'On-site' | 'Remote';
}

export interface CostingItem {
  id: string;
  service: string;
  hours: number;
  rate: number;
}

export interface ReadinessItem {
  id: string;
  task: string;
  isComplete: boolean;
  value?: string;
  type: 'checkbox' | 'select' | 'date';
  options?: string[];
}

export interface ReadinessCategory {
  id: string;
  name: string;
  items: ReadinessItem[];
}

export interface SowSection {
  id: string;
  title: string;
  content: string;
  isLocked?: boolean;
  timelineItems?: TimelineItem[];
}

export interface GlobalSettings {
  sidebarIconBase64?: string;
  companyLogoBase64?: string;
  sidebarTitle: string;
  companyName?: string;
  address?: string;
  phone?: string;
  supportEmail?: string;
  salesEmail?: string;
  globalSowSections?: SowSection[];
}

export interface Project {
  id: string;
  title: string;
  customerName: string;
  projectOverview?: string;
  deploymentType: DeploymentType;
  locations: ProjectLocation[];
  startDate: string;
  endDate: string;
  revision: number;
  revisions?: ProjectRevision[];
  logoUrl?: string;
  logoBase64?: string;
  customerSuccessCriteria: SuccessCriterion[];
  ourSuccessCriteria: SuccessCriterion[];
  accomplishments: string[];
  milestones: Milestone[];
  contacts: Contact[];
  isClosed: boolean;
  isArchived?: boolean;
  isExtended: boolean;
  extensionReason?: string;
  extendedEndDate?: string;
  customerSignature?: string;
  ourSignature?: string;
  surveyQuestions: SurveyQuestion[];
  sowCost?: number;
  costingItems?: CostingItem[];
  costingCurrency?: 'USD' | 'CAD';
  sowTOC?: string;
  sowSections?: SowSection[];
  customerSentiment?: Sentiment;
  hardwareNodes?: HardwareNode[];
  aiAnalysisSummary?: string;
  readinessCategories?: ReadinessCategory[];
  // DB timestamps
  created_at?: string;
  updated_at?: string;
}
