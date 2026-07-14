export interface UserData {
  name: string;
  role: string;
  avatarUrl: string;
}

export interface HeaderProps {
  onThemeToggle: () => void;
  isDarkMode: boolean;
}