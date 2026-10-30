import { router } from 'expo-router';
import { createContext, useEffect, useState, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';

import { api, authSession } from '@/common/lib/api/axios';
import { config } from '@/common/lib/config';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { createProfileApi } from '@/features/profile/api/profileApi';

import { AlertBanner } from '../components/AlertBanner';
import { alertDriver } from '../native/alertDriver';
import type { AppAlert } from '../types/alert.types';
import { ALERT_RULES, ALERT_TYPES } from '../utils/alertRules';
import { createAlertService, type AlertService } from '../utils/alertService';

export const AlertContext = createContext<AlertService | null>(null);

const profileApi = createProfileApi(api);

function navigate(alert: AppAlert) {
  if (alert.type === 'crash_detected') router.navigate('/check-in');
  else router.navigate({ pathname: '/alert/[id]', params: { id: alert.id } });
}

export function AlertProvider({ children }: PropsWithChildren) {
  const { t, i18n } = useTranslation();
  const [service] = useState(() => createAlertService({
    driver: alertDriver,
    navigate,
    sendPushToken: profileApi.registerPushToken,
  }));

  useEffect(() => {
    const channels = ALERT_TYPES.map((type) => ({
      type,
      severity: ALERT_RULES[type].severity,
      title: t(`alerts.${type}.title`),
      body: t(`alerts.${type}.body`),
    }));
    return service.start(channels, t('alerts.view'));
  }, [service, t]);

  useEffect(() => {
    if (!config.apiUrl) return undefined;
    const register = () => {
      if (authSession.status.getState().status !== 'signedIn') return;
      service.registerPushToken(getLanguage()).catch(() => undefined);
    };
    const unsubscribeAuth = authSession.status.subscribe(register);
    const unsubscribeAlerts = service.store.subscribe((state, previous) => {
      if (state.permission !== previous.permission) register();
    });
    register();
    return () => {
      unsubscribeAuth();
      unsubscribeAlerts();
    };
  }, [service, i18n.language]);

  return (
    <AlertContext value={service}>
      {children}
      <AlertBanner />
    </AlertContext>
  );
}
