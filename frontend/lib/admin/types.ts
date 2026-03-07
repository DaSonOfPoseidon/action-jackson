export interface AdminUser {
  username: string;
  role: string;
  lastLogin: string;
}

export interface PaginatedResponse<T> {
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
  [key: string]: T[] | PaginatedResponse<T>["pagination"];
}

export interface DashboardStats {
  stats: {
    quotes: number;
    schedules: number;
    invoices: number;
    consultations: number;
  };
  recentActivity: {
    quotes: Quote[];
    schedules: Schedule[];
    invoices: Invoice[];
    consultations: ConsultationRequest[];
  };
}

export interface Quote {
  _id: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  serviceType?: string;
  packageOption?: string;
  runs?: {
    coax: number;
    cat6: number;
    fiber: number;
  };
  services?: {
    mediaPanel: number;
    apMount: number;
    ethRelocation: number;
  };
  centralization?: string;
  equipment?: Array<{
    name: string;
    category: string;
    price: number;
    quantity: number;
  }>;
  pricing?: {
    totalCost?: number;
    depositRequired?: number;
    depositAmount?: number;
  };
  discount?: number;
  finalQuoteAmount?: number;
  adminNotes?: string;
  status: string;
  invoiceId?: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Schedule {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  date?: string;
  time?: string;
  scheduledDate?: string;
  serviceType?: string;
  notes?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  serviceDescription?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  amount?: number;
  discount?: number;
  finalAmount: number;
  dueDate?: string;
  status: string;
  quoteId?: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CostItem {
  _id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  unitType: string;
  costUnitType?: string;
  unitLabel?: string;
  price: number;
  materialCost?: number;
  laborHours?: number;
  thresholdAmount?: number;
  purchaseUrl?: string;
  billOfMaterials?: Array<{
    item: { _id: string; code: string; name: string } | string;
    quantity: number;
  }>;
  sortOrder?: number;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ConsultationRequest {
  _id: string;
  requestNumber?: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  interestedPackage?: string;
  interestedServices?: string[];
  currentIssues?: string[];
  homeDetails?: {
    squareFootage?: string;
    floors?: string;
    yearBuilt?: string;
  };
  additionalNotes?: string;
  adminNotes?: string;
  quotedAmount?: number;
  scheduledConsultation?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}
