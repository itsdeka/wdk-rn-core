# @tetherto/wdk-rn-core

Core functionality for React Native wallets - wallet management, balance fetching, and worklet operations.

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/itsdeka/wdk-rn-core.git
cd wdk-rn-core

# Install dependencies and build
npm install
npm run build
```

### Step 2: Install in Your App

From your app directory:

```bash
npm install https://github.com/itsdeka/wdk-rn-core.git
```

Or add to your `package.json`:

```json
{
  "dependencies": {
    "@tetherto/wdk-rn-secure-storage": "github:itsdeka/wdk-rn-secure-storage",
    "@tetherto/wdk-rn-core": "github:itsdeka/wdk-rn-core"
  }
}
```

Then run `npm install`.

### Contributing

Since you're installing from source, you can:
1. Make changes to the code in `wdk-rn-core`
2. Rebuild: `cd wdk-rn-core && npm run build`
3. The changes will be reflected in your app immediately (or after reinstalling)
4. Submit a pull request with your improvements!

## Peer Dependencies

```bash
npm install react@">=18.0.0" react-native@">=0.70.0"
npm install '@tetherto/wdk-rn-secure-storage'
```

## Usage

### Basic Wallet Usage

```typescript
import { useWallet, useWorklet } from '@tetherto/wdk-rn-worklet';

function WalletComponent() {
  const { wallet, isLoading } = useWallet();
  const { createWallet, sendTransaction } = useWorklet();

  // Create a new wallet
  const handleCreateWallet = async () => {
    await createWallet({ name: 'My Wallet' });
  };

  // Send transaction
  const handleSend = async () => {
    await sendTransaction({
      to: 'recipient-address',
      amount: '100',
      token: 'USDT'
    });
  };

  if (isLoading) return <LoadingIndicator />;

  return (
    <View>
      {!wallet ? (
        <Button onPress={handleCreateWallet}>Create Wallet</Button>
      ) : (
        <Button onPress={handleSend}>Send</Button>
      )}
    </View>
  );
}
```

### Provider with Automatic Balance Fetching

```typescript
import { WdkAppProvider, useWdkApp } from '@tetherto/wdk-rn-worklet';

function App() {
  return (
    <WdkAppProvider
      secureStorage={secureStorageInstance}
      networkConfigs={networkConfigs}
      tokenConfigs={tokenConfigs}
      autoFetchBalances={true}
      balanceRefreshInterval={30000} // Refresh every 30 seconds
    >
      <WalletApp />
    </WdkAppProvider>
  );
}

function WalletApp() {
  const { isReady, isFetchingBalances, refreshBalances } = useWdkApp();

  if (!isReady) return <LoadingScreen />;

  return (
    <View>
      {isFetchingBalances && <Text>Updating balances...</Text>}
      <Button onPress={refreshBalances}>Refresh Balances</Button>
      {/* Your wallet UI */}
    </View>
  );
}
```

## Features

- 💼 Wallet management (create, import, delete)
- 🔄 Transaction handling
- 💰 Automatic balance fetching and management
- 📊 State management with Zustand
- 🔐 Secure storage integration
- 📱 React Native optimized

## API

### WdkAppProvider Props

```typescript
interface WdkAppProviderProps {
  secureStorage: SecureStorage
  networkConfigs: NetworkConfigs
  tokenConfigs: TokenConfigs // Required for balance fetching
  requireBiometric?: boolean
  autoFetchBalances?: boolean // Default: true
  balanceRefreshInterval?: number // Default: 30000ms (30 seconds), 0 to disable
  children: React.ReactNode
}
```

### WdkAppContext (useWdkApp hook)

```typescript
interface WdkAppContextValue {
  isReady: boolean
  isInitializing: boolean
  walletExists: boolean | null
  needsBiometric: boolean
  completeBiometric: () => void
  error: Error | null
  retry: () => void
  isFetchingBalances: boolean // New: balance fetching state
  refreshBalances: () => Promise<void> // New: manual balance refresh
}
```

### Hooks

- `useWallet()` - Access wallet state and operations
- `useWorklet()` - Access worklet operations
- `useWalletSetup()` - Wallet initialization utilities
- `useWdkApp()` - WDK app context (includes balance fetching state)
- `useBalanceFetcher()` - Manual balance fetching operations

See [src/index.ts](./src/index.ts) for full API documentation.

## License

Apache-2.0

