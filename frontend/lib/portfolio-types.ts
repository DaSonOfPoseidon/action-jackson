export interface ContactInfo {
  name: string;
  title: string;
  email: string;
  location: string;
  github: string;
  linkedin: string;
  website: string;
}

export interface Stat {
  label: string;
  value: string;
}

export interface Role {
  title: string;
  startDate: string;
  endDate: string;
  highlights: string[];
  stats?: Stat[];
  notableProjects?: string[];
}

export interface LifeEvent {
  title: string;
  date: string;
  icon: string;
  description?: string;
}

export interface Experience {
  company: string;
  role?: string;
  roles?: Role[];
  startDate: string;
  endDate: string;
  description: string;
  highlights?: string[];
  stats?: Stat[];
  tech: string[];
  type: 'work' | 'education';
  notableProjects?: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface SkillCategory {
  category: string;
  icon: string;
  color: string;
  skills: string[];
}

export interface Certification {
  name: string;
  issuer: string;
  date: string;
  url?: string;
}

export interface ResumeData {
  contact: ContactInfo;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: SkillCategory[];
  certifications: Certification[];
  lifeEvents?: LifeEvent[];
}

export interface ProjectLink {
  github?: string;
  live?: string;
  docs?: string;
}

export interface Project {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  stack: string[];
  features: string[];
  links: ProjectLink;
  tags: string[];
  highlighted: boolean;
  isPrivate?: boolean;
}
