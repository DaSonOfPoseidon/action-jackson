const DISPOSABLE_DOMAINS = [
  "10minutemail.com",
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.org",
  "temp-mail.org",
  "0-mail.com",
];

export function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return "Please enter a valid email address";

  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && DISPOSABLE_DOMAINS.includes(domain)) {
    return "Please use a non-disposable email address";
  }

  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone) return null; // optional
  const re = /^[\d\s()+-]{7,20}$/;
  if (!re.test(phone)) return "Please enter a valid phone number";
  return null;
}

export function validateName(name: string): string | null {
  if (!name) return "Name is required";
  if (name.length < 2) return "Name must be at least 2 characters";
  if (name.length > 100) return "Name must be under 100 characters";
  const re = /^[a-zA-Z\s'-]+$/;
  if (!re.test(name)) return "Name can only contain letters, spaces, apostrophes, and hyphens";
  return null;
}

export function validateRequired(value: string | string[], label: string): string | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? null : `Please select at least one ${label}`;
  }
  return value ? null : `${label} is required`;
}
