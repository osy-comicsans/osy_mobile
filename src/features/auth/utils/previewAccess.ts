import { createStore } from 'zustand/vanilla';
export const previewAccess = createStore(() => ({ enabled: true }));
export const endHomePreview = () => previewAccess.setState({ enabled: false });
