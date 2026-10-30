import NetInfo from '@react-native-community/netinfo';

export function subscribeToConnectivity(listener: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => {
    listener(state.isConnected === true && state.isInternetReachable !== false);
  });
}
