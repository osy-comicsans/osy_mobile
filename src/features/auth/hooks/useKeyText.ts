import { useTranslation } from 'react-i18next';

// Translates keys that are only known at runtime, such as schema messages.
export function useKeyText() {
  const { t } = useTranslation();
  return t as unknown as (key: string) => string;
}
