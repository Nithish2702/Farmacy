import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import './utils/backgroundMessageHandler';

// Must be exported or Fast Refresh won't update the context
export function App() {
  return <ExpoRoot context={require.context('./app')} />;
}

registerRootComponent(App); 