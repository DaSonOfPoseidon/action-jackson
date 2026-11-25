// Jackson's public profiles, in one place so every site that shows them (the main hub, the dev portfolio) agrees. They
// are public facts, not secrets, and the API never uses them, so they live here and not in contracts/.
export interface Social {
  readonly key: 'github' | 'linkedin' | 'email';
  // The visible link text.
  readonly label: string;
  // An https URL, or a mailto: URL for the email.
  readonly href: string;
}

export const SOCIALS: readonly Social[] = [
  { key: 'github', label: 'GitHub', href: 'https://github.com/DaSonOfPoseidon' },
  { key: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/jackson-keithley-115582213/' },
  { key: 'email', label: 'jackson@actionjacksoninstalls.com', href: 'mailto:jackson@actionjacksoninstalls.com' },
];
