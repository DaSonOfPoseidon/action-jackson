export interface ConsultationPayload {
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  property: {
    squareFootage: string;
    isp?: string;
    currentIssues?: string[];
  };
  interestedServices: string[];
  interestedPackage?: string;
  honeypot?: string;
}

export interface ConsultationResponse {
  id: string;
  requestNumber: string;
  message: string;
}

export interface ApiError {
  error: string;
  details?: string[];
}

export async function submitConsultation(
  data: ConsultationPayload
): Promise<ConsultationResponse> {
  const res = await fetch("/api/consultations/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!res.ok) {
    const err = json as ApiError;
    throw new Error(err.details ? err.details.join(", ") : err.error);
  }

  return json as ConsultationResponse;
}

export interface PackageDefinition {
  id: string;
  name: string;
  priceRange: string;
  idealFor: string;
  includes: string[];
}

export async function getPackages(): Promise<PackageDefinition[]> {
  const res = await fetch("/api/consultations/packages");
  if (!res.ok) throw new Error("Failed to load packages");
  return res.json();
}

export interface StandaloneService {
  id: string;
  name: string;
  price: string;
  description: string;
}

export async function getServices(): Promise<StandaloneService[]> {
  const res = await fetch("/api/consultations/services");
  if (!res.ok) throw new Error("Failed to load services");
  return res.json();
}
