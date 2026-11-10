import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  AppState,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { ShieldAlert, Compass } from 'lucide-react-native';

const C = {
  zinc950: '#09090b',
  zinc900: '#18181b',
  zinc800: '#27272a',
  zinc400: '#a1a1aa',
  zinc300: '#d4d4d8',
  zinc100: '#f4f4f5',
  teal500: '#14b8a6',
  teal400: '#2dd4bf',
  white: '#ffffff',
};

interface BiometricGuardProps {
  children: React.ReactNode;
}

export default function BiometricGuard({ children }: BiometricGuardProps) {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 1. Check if biometric lock is turned on in local SecureStore
  useEffect(() => {
    checkLockPreference();

    // Re-lock app when it goes to background
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        checkLockPreference().then((enabled) => {
          if (enabled) {
            setIsLocked(true);
          }
        });
      } else if (nextAppState === 'active') {
        // Auto-authenticate when app returns to foreground
        checkLockPreference().then((enabled) => {
          if (enabled) {
            triggerAuthentication();
          }
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const checkLockPreference = async (): Promise<boolean> => {
    try {
      const storedVal = await SecureStore.getItemAsync('anxie_biometric_lock_enabled');
      const enabled = storedVal === 'true';
      setIsEnabled(enabled);
      if (!enabled) {
        setIsLocked(false);
      }
      return enabled;
    } catch (err) {
      setIsEnabled(false);
      setIsLocked(false);
      return false;
    }
  };

  // 2. Trigger Fingerprint / Passcode prompt
  const triggerAuthentication = async () => {
    setIsAuthenticating(true);
    setErrorMsg('');
    try {
      // Check if biometrics or passcode are configured on the device
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // Device has no lock setup or hardware — let them in
        setIsLocked(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Anxie',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
      } else {
        setErrorMsg('Authentication failed. Tap button to retry.');
      }
    } catch (err) {
      setErrorMsg('Error authenticating. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Run authenticating flow if lock is enabled
  useEffect(() => {
    if (isEnabled === true && isLocked) {
      triggerAuthentication();
    }
  }, [isEnabled]);

  // If loading preference, show background
  if (isEnabled === null) {
    return (
      <View style={s.container}>
        <ActivityIndicator size="large" color={C.teal500} />
      </View>
    );
  }

  // If enabled and currently locked, show unlock screen
  if (isEnabled && isLocked) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIconBox}>
              <Compass size={18} color={C.white} />
            </View>
            <Text style={s.headerTitle}>Anxie AI</Text>
          </View>
        </View>

        <View style={s.body}>
          <View style={s.lockIconWrapper}>
            <ShieldAlert size={48} color={C.teal400} />
          </View>
          <Text style={s.heading}>Anxie is Locked</Text>
          <Text style={s.subheading}>
            Unlock with your fingerprint or face to protect your sessions.
          </Text>

          {errorMsg ? <Text style={s.errorText}>{errorMsg}</Text> : null}

          <TouchableOpacity
            disabled={isAuthenticating}
            onPress={triggerAuthentication}
            style={s.button}
          >
            {isAuthenticating ? (
              <ActivityIndicator size="small" color={C.zinc950} />
            ) : (
              <Text style={s.buttonText}>Unlock App</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // If lock is disabled or successfully unlocked, show actual app
  return <>{children}</>;
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.zinc950,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBox: {
    height: 32,
    width: 32,
    borderRadius: 8,
    backgroundColor: C.teal500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: C.zinc100, fontWeight: '700', fontSize: 18, letterSpacing: -0.5 },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
  },
  lockIconWrapper: {
    height: 96,
    width: 96,
    borderRadius: 9999,
    backgroundColor: C.zinc900,
    borderWidth: 1,
    borderColor: C.zinc800,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heading: {
    color: C.zinc100,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subheading: {
    color: C.zinc400,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  button: {
    width: '80%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.teal400,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: C.zinc950,
    fontWeight: '700',
    fontSize: 14,
  },
});
