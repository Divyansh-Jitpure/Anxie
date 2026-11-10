import React, { useState, useEffect, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  NativeModules,
  StyleSheet,
  Alert,
  LogBox,
} from 'react-native';

LogBox.ignoreLogs([
  'Unable to resolve host',
  'AuthRetryableFetchError',
  'fetch failed',
]);
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Heart,
  Wind,
  Compass,
  Sparkles,
  ArrowRight,
  RotateCcw,
  X,
  Plus,
  Settings as SettingsIcon,
  Shield,
  TrendingDown,
  BarChart2,
  Trash2,
  ChevronLeft,
  Calendar,
  Activity,
} from 'lucide-react-native';
import {
  BOX_BREATHING_PHASES,
  GROUNDING_STEPS,
  GroundingLogEntry,
  GroundingFeedbackResponse,
} from '@anxie/shared';
import { supabase } from './supabase';
import BiometricGuard from './components/BiometricGuard';

export interface DistressLog {
  id: string;
  user_id: string;
  score_before: number;
  score_after: number;
  exercise_type: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Color palette (Zinc / Teal / Emerald — same as the Tailwind config)
// ---------------------------------------------------------------------------
const C = {
  zinc950: '#09090b',
  zinc900: '#18181b',
  zinc800: '#27272a',
  zinc600: '#52525b',
  zinc500: '#71717a',
  zinc400: '#a1a1aa',
  zinc300: '#d4d4d8',
  zinc200: '#e4e4e7',
  zinc100: '#f4f4f5',
  zinc950_text: '#09090b',
  teal500: '#14b8a6',
  teal400: '#2dd4bf',
  teal500_10: 'rgba(20,184,166,0.1)',
  teal500_05: 'rgba(20,184,166,0.05)',
  teal500_border10: 'rgba(20,184,166,0.1)',
  teal500_20: 'rgba(20,184,166,0.2)',
  emerald500: '#10b981',
  emerald400: '#34d399',
  amber400: '#fbbf24',
  amber500_10: 'rgba(245,158,11,0.1)',
  amber500_20: 'rgba(245,158,11,0.2)',
  white: '#ffffff',
};

import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// Dynamic API URL — resolves Metro dev-server IP for physical devices
// ---------------------------------------------------------------------------
const getApiUrl = () => {
  let hostname = 'localhost';
  
  // In Expo Go, expoConfig contains the hostUri (e.g. 10.166.175.225:8085)
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri;
  if (hostUri) {
    hostname = hostUri.split(':')[0];
  } else if (NativeModules.SourceCode && NativeModules.SourceCode.scriptURL) {
    try {
      const { scriptURL } = NativeModules.SourceCode;
      const address = scriptURL.split('://')[1].split('/')[0];
      hostname = address.split(':')[0];
    } catch (_) { /* keep default */ }
  }

  if (hostname === 'localhost' && Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api/calm';
  }
  return `http://${hostname}:3000/api/calm`;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ScreenState =
  | 'idle'
  | 'breathing'
  | 'grounding_distress'
  | 'grounding_steps'
  | 'grounding_final_distress'
  | 'feedback'
  | 'history';

// ===========================================================================
// App
// ===========================================================================
export default function App() {
  const [screen, setScreen] = useState<ScreenState>('idle');

  // Supabase Auth and User Profile State
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isInitializingAuth, setIsInitializingAuth] = useState(true);

  // Distress History State
  const [distressLogs, setDistressLogs] = useState<DistressLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);

  // Settings UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const [authMode, setAuthMode] = useState<'upgrade' | 'login'>('upgrade');

  // Sync biometric preference when settings is opened
  useEffect(() => {
    if (isSettingsOpen) {
      SecureStore.getItemAsync('anxie_biometric_lock_enabled').then(val => {
        setBiometricEnabled(val === 'true');
      });
      setUpgradeMessage('');
    }
  }, [isSettingsOpen]);

  const toggleBiometricLock = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Security Setup Required',
          'Please set up FaceID, Fingerprint, or a device passcode in your phone settings to use this feature.'
        );
        return;
      }

      // Prompt authentication before changing the security status
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: biometricEnabled
          ? 'Authenticate to turn off App Lock'
          : 'Authenticate to enable App Lock',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        const newVal = !biometricEnabled;
        setBiometricEnabled(newVal);
        await SecureStore.setItemAsync('anxie_biometric_lock_enabled', newVal ? 'true' : 'false');
      }
    } catch (err) {
      console.warn('Error toggling biometric lock:', err);
    }
  };

  const handleUpgradeAccount = async () => {
    if (!emailInput.trim() || !passwordInput.trim()) {
      setUpgradeMessage('Please fill in both fields.');
      return;
    }
    setIsUpgrading(true);
    setUpgradeMessage('');
    try {
      const { data, error } = await supabase.auth.updateUser({
        email: emailInput.trim(),
        password: passwordInput.trim(),
      });

      if (error) {
        setUpgradeMessage(`Upgrade failed: ${error.message}`);
      } else {
        setUpgradeMessage('Account successfully created!');
        setEmailInput('');
        setPasswordInput('');
        const { data: { session: updatedSession } } = await supabase.auth.getSession();
        setSession(updatedSession);
      }
    } catch (err) {
      setUpgradeMessage('Error upgrading account.');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleLogin = async () => {
    if (!emailInput.trim() || !passwordInput.trim()) {
      setUpgradeMessage('Please fill in both fields.');
      return;
    }
    setIsUpgrading(true);
    setUpgradeMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(),
        password: passwordInput.trim(),
      });

      if (error) {
        setUpgradeMessage(`Login failed: ${error.message}`);
      } else {
        setUpgradeMessage('Logged in successfully!');
        setEmailInput('');
        setPasswordInput('');
        setSession(data.session);
      }
    } catch (err) {
      setUpgradeMessage('Error logging in.');
    } finally {
      setIsUpgrading(false);
    }
  };

  // ── Supabase Anonymous Auth Setup ──────────────────────────────────────
  useEffect(() => {
    // 1. Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session) {
          fetchUserProfile(session.user.id);
        } else {
          signInAnonymously();
        }
      })
      .catch(err => {
        console.warn('Initial Supabase session fetch failed (project may be paused or offline):', err);
        setIsInitializingAuth(false);
      });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setIsInitializingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInAnonymously = async () => {
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.warn(
          'Anonymous sign-in failed. Please ensure "Anonymous Sign-ins" is enabled in your Supabase Auth dashboard settings.',
          error.message
        );
      } else if (data.session) {
        setSession(data.session);
        await fetchUserProfile(data.session.user.id);
      }
    } catch (err) {
      console.warn('Anonymous sign-in exception:', err);
    } finally {
      setIsInitializingAuth(false);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      // 1. Try to fetch existing profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setUserProfile(data);
        return;
      }

      // 2. If no profile exists, create/upsert it safely without duplicate key collision
      const { data: newProfile, error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          [{ id: userId, is_premium: false, free_tokens_remaining: 3 }],
          { onConflict: 'id' }
        )
        .select()
        .maybeSingle();

      if (upsertError) {
        console.warn('Could not create user profile:', upsertError.message);
      } else if (newProfile) {
        setUserProfile(newProfile);
      }
    } catch (err) {
      console.warn('Error fetching user profile:', err);
    } finally {
      setIsInitializingAuth(false);
    }
  };

  // ── Distress Logs Fetching & Management ─────────────────────────────────
  const fetchDistressLogs = async (overrideUserId?: string) => {
    const activeUserId =
      overrideUserId ||
      session?.user?.id ||
      (await supabase.auth.getSession()).data.session?.user?.id;

    if (!activeUserId) return;
    setIsLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('distress_logs')
        .select('*')
        .eq('user_id', activeUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching distress logs:', error.message);
      } else if (data) {
        setDistressLogs(data);
      }
    } catch (err: any) {
      console.warn('Error in fetchDistressLogs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchDistressLogs(session.user.id);
    }
  }, [session?.user?.id]);

  // Re-fetch distress logs whenever user navigates to the history dashboard
  useEffect(() => {
    if (screen === 'history') {
      fetchDistressLogs();
    }
  }, [screen]);

  const handleClearHistory = () => {
    if (!session?.user || distressLogs.length === 0) return;
    Alert.alert(
      'Clear Progress History',
      'Are you sure you want to permanently clear all your saved distress exercise logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setIsClearingLogs(true);
            try {
              const { error } = await supabase
                .from('distress_logs')
                .delete()
                .eq('user_id', session.user.id);

              if (error) {
                Alert.alert('Error', error.message);
              } else {
                setDistressLogs([]);
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to clear logs');
            } finally {
              setIsClearingLogs(false);
            }
          },
        },
      ]
    );
  };

  const formatLogDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) return `Today, ${timeStr}`;
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
    } catch {
      return 'Recent';
    }
  };

  // Breathing state
  const [breathingPhaseIdx, setBreathingPhaseIdx] = useState(0);
  const [breathingTimeLeft, setBreathingTimeLeft] = useState(4);
  const [breathingActive, setBreathingActive] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1.0)).current;
  const pulseAnim = useRef(new Animated.Value(1.0)).current;

  // Grounding state
  const [distressBefore, setDistressBefore] = useState(5);
  const [distressAfter, setDistressAfter] = useState(5);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [currentItemText, setCurrentItemText] = useState('');
  const [groundedItems, setGroundedItems] = useState<string[]>([]);
  const [groundingLogs, setGroundingLogs] = useState<GroundingLogEntry[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<GroundingFeedbackResponse | null>(null);
  const [isFallbackFeedback, setIsFallbackFeedback] = useState(false);

  // ── Idle pulsing animation ──────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'idle') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 2000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 2000, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [screen]);

  // ── Box-breathing animation loop ────────────────────────────────────────
  useEffect(() => {
    let timer: any;
    if (screen === 'breathing' && breathingActive) {
      const phase = BOX_BREATHING_PHASES[breathingPhaseIdx];
      const target = phase.name === 'Inhale' || phase.name === 'Hold (In)' ? 1.6 : 1.0;
      Animated.timing(scaleAnim, {
        toValue: target,
        duration: phase.durationSeconds * 1000,
        useNativeDriver: true,
      }).start();
      setBreathingTimeLeft(phase.durationSeconds);
      timer = setInterval(() => {
        setBreathingTimeLeft(prev => {
          if (prev <= 1) {
            const next = (breathingPhaseIdx + 1) % BOX_BREATHING_PHASES.length;
            setBreathingPhaseIdx(next);
            return BOX_BREATHING_PHASES[next].durationSeconds;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      scaleAnim.setValue(1.0);
      setBreathingPhaseIdx(0);
      setBreathingTimeLeft(4);
    }
    return () => clearInterval(timer);
  }, [screen, breathingActive, breathingPhaseIdx]);

  // ── Grounding helpers ───────────────────────────────────────────────────
  const handleAddGroundedItem = () => {
    if (!currentItemText.trim()) return;
    const items = [...groundedItems, currentItemText.trim()];
    setGroundedItems(items);
    setCurrentItemText('');
  };

  const handleRemoveGroundedItem = (idx: number) => {
    setGroundedItems(groundedItems.filter((_, i) => i !== idx));
  };

  const handleNextGroundingStep = () => {
    const step = GROUNDING_STEPS[currentStepIdx];
    const log: GroundingLogEntry = { stepNumber: step.stepNumber, items: groundedItems };
    setGroundingLogs([...groundingLogs, log]);
    if (currentStepIdx < GROUNDING_STEPS.length - 1) {
      setCurrentStepIdx(currentStepIdx + 1);
      setGroundedItems([]);
      setCurrentItemText('');
    } else {
      setScreen('grounding_final_distress');
    }
  };

  const handleSubmitGrounding = async () => {
    setIsLoadingFeedback(true);
    setScreen('feedback');
    setIsFallbackFeedback(false);

    // 1. Get active user id (from session state or directly from Supabase auth client)
    let activeUserId = session?.user?.id;
    if (!activeUserId) {
      try {
        const { data: authData } = await supabase.auth.getSession();
        activeUserId = authData.session?.user?.id;
        if (authData.session) setSession(authData.session);
      } catch (authErr) {
        console.warn('Could not retrieve active session for logging:', authErr);
      }
    }

    // 2. Save distress log to Supabase database
    if (activeUserId) {
      try {
        const { data: insertedData, error: logError } = await supabase
          .from('distress_logs')
          .insert([
            {
              user_id: activeUserId,
              score_before: distressBefore,
              score_after: distressAfter,
              exercise_type: 'grounding',
            },
          ])
          .select()
          .maybeSingle();

        if (logError) {
          console.warn('Failed to save distress log to database:', logError.message);
        } else {
          console.log('Saved distress log to database successfully!', insertedData?.id);
          if (insertedData) {
            setDistressLogs(prev => [
              insertedData,
              ...prev.filter(l => l.id !== insertedData.id),
            ]);
          }
          fetchDistressLogs(activeUserId);
        }
      } catch (insertErr) {
        console.warn('Exception saving distress log to database:', insertErr);
      }
    } else {
      console.warn('Cannot save distress log: No authenticated user session found.');
    }

    const apiUrl = getApiUrl();
    console.log('Submitting grounding to:', apiUrl);
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: groundingLogs,
          userDistressBefore: distressBefore,
          userDistressAfter: distressAfter,
        }),
      });
      const data = await res.json();
      if (res.ok) { setAiFeedback(data); }
      else { throw new Error(data.error || 'API error'); }
    } catch (err) {
      console.warn('API connection failed:', err);
      setIsFallbackFeedback(true);
      setAiFeedback({
        message:
          'You have done an amazing job grounding yourself today. Even when things feel overwhelming, you took concrete steps to steady your mind. Trust in your strength and allow yourself to rest.',
        suggestedAction: 'do breathing',
      });
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const resetAll = () => {
    setScreen('idle');
    setBreathingActive(false);
    setBreathingPhaseIdx(0);
    setDistressBefore(5);
    setDistressAfter(5);
    setCurrentStepIdx(0);
    setGroundedItems([]);
    setGroundingLogs([]);
    setAiFeedback(null);
    setCurrentItemText('');
    setIsFallbackFeedback(false);
  };

  const activePhase = BOX_BREATHING_PHASES[breathingPhaseIdx];
  const activeStep = GROUNDING_STEPS[currentStepIdx];

  // History Metrics Calculation
  const totalSessions = distressLogs.length;
  const totalReduction = distressLogs.reduce(
    (acc, log) => acc + (log.score_before - log.score_after),
    0
  );
  const avgReduction = totalSessions > 0 ? (totalReduction / totalSessions).toFixed(1) : '0.0';
  const improvedSessions = distressLogs.filter(log => log.score_before > log.score_after).length;
  const reliefRate = totalSessions > 0 ? Math.round((improvedSessions / totalSessions) * 100) : 0;
  const chartLogs = distressLogs.slice(0, 6).reverse();

  // =======================================================================
  // JSX
  // =======================================================================
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <BiometricGuard>
        <SafeAreaView style={s.safeArea}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            {screen === 'history' ? (
              <TouchableOpacity onPress={() => setScreen('idle')} style={{ marginRight: 6 }}>
                <ChevronLeft size={22} color={C.zinc100} />
              </TouchableOpacity>
            ) : null}
            <View style={s.headerIconBox}>
              <Heart size={18} color={C.white} />
            </View>
            <Text style={s.headerTitle}>
              {screen === 'history' ? 'Your Progress' : 'Anxie AI'}
            </Text>
          </View>
          {screen === 'idle' ? (
            <TouchableOpacity onPress={() => setIsSettingsOpen(true)} style={s.closeBtn}>
              <SettingsIcon size={16} color={C.zinc400} />
            </TouchableOpacity>
          ) : screen === 'history' ? (
            <TouchableOpacity
              onPress={handleClearHistory}
              disabled={isClearingLogs || distressLogs.length === 0}
              style={[s.closeBtn, distressLogs.length === 0 && { opacity: 0.3 }]}
            >
              {isClearingLogs ? (
                <ActivityIndicator size="small" color={C.zinc400} />
              ) : (
                <Trash2 size={16} color={C.zinc400} />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={resetAll} style={s.closeBtn}>
              <X size={16} color={C.zinc400} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.content}
        >
          {/* ░░ IDLE ░░ */}
          {screen === 'idle' && (
            <View style={s.idleWrap}>
              <View style={s.idleTextGroup}>
                <Text style={s.label}>EMERGENCY SUPPORT</Text>
                <Text style={s.idleHeading}>Are you feeling anxious?</Text>
                <Text style={s.idleSubtext}>
                  We are here to support you. Tap a tool below to begin calming down.
                </Text>
              </View>

              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  onPress={() => { setScreen('breathing'); setBreathingActive(true); }}
                  style={s.calmBtnOuter}
                >
                  <View style={s.calmBtnInner}>
                    <Wind size={40} color={C.teal400} />
                    <Text style={s.calmBtnTitle}>Calm Down</Text>
                    <Text style={s.calmBtnSub}>BOX BREATHING</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>

              <View style={{ width: '100%', gap: 12, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={() => setScreen('grounding_distress')}
                  style={s.secondaryBtn}
                >
                  <View style={s.secondaryBtnLeft}>
                    <Compass size={20} color={C.emerald400} />
                    <View>
                      <Text style={s.secondaryTitle}>Sensory Grounding (5-4-3-2-1)</Text>
                      <Text style={s.secondaryDesc}>Use your senses to connect to the present</Text>
                    </View>
                  </View>
                  <ArrowRight size={18} color={C.zinc600} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setScreen('history')}
                  style={s.secondaryBtn}
                >
                  <View style={s.secondaryBtnLeft}>
                    <BarChart2 size={20} color={C.teal400} />
                    <View>
                      <Text style={s.secondaryTitle}>Your Progress & History</Text>
                      <Text style={s.secondaryDesc}>
                        {distressLogs.length > 0
                          ? `${distressLogs.length} ${distressLogs.length === 1 ? 'exercise' : 'exercises'} logged • View trends`
                          : 'Track anxiety reduction over time'}
                      </Text>
                    </View>
                  </View>
                  <ArrowRight size={18} color={C.zinc600} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ░░ BREATHING ░░ */}
          {screen === 'breathing' && (
            <View style={s.breathWrap}>
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text style={s.breathPhaseLabel}>{activePhase.name}</Text>
                <Text style={s.breathSubLabel}>Paced Box Breathing</Text>
              </View>

              <View style={s.breathCircleContainer}>
                <View style={[s.breathRing, { transform: [{ scale: 1.2 }], borderColor: 'rgba(20,184,166,0.05)' }]} />
                <View style={[s.breathRing, { transform: [{ scale: 1.1 }], borderColor: 'rgba(20,184,166,0.1)' }]} />
                <Animated.View style={[s.breathCircle, { transform: [{ scale: scaleAnim }] }]}>
                  <Wind size={40} color={C.teal400} />
                </Animated.View>
              </View>

              <View style={{ alignItems: 'center', minHeight: 64, paddingHorizontal: 32 }}>
                <Text style={s.breathInstruction}>{activePhase.instruction}</Text>
                <Text style={s.breathTimer}>{breathingTimeLeft}s</Text>
              </View>

              <TouchableOpacity
                onPress={() => setBreathingActive(!breathingActive)}
                style={s.breathToggle}
              >
                <Text style={s.breathToggleText}>
                  {breathingActive ? 'PAUSE EXERCISE' : 'RESUME EXERCISE'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ░░ GROUNDING — INITIAL DISTRESS ░░ */}
          {screen === 'grounding_distress' && (
            <View style={{ gap: 24, paddingVertical: 24 }}>
              <View style={{ gap: 8 }}>
                <Text style={s.label}>INITIAL ASSESSMENT</Text>
                <Text style={s.sectionHeading}>How high is your distress?</Text>
                <Text style={s.sectionDesc}>
                  Rate your current anxiety or discomfort on a scale of 1 (calm) to 10 (intense panic).
                </Text>
              </View>
              <View style={s.numberRow}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setDistressBefore(n)}
                    style={[s.numberCircle, distressBefore === n && s.numberCircleActive]}
                  >
                    <Text style={[s.numberText, distressBefore === n && s.numberTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                onPress={() => { setCurrentStepIdx(0); setGroundedItems([]); setScreen('grounding_steps'); }}
                style={s.primaryBtn}
              >
                <Text style={s.primaryBtnText}>Begin Grounding</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ░░ GROUNDING — STEPS ░░ */}
          {screen === 'grounding_steps' && (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 20, paddingVertical: 10 }}
            >
              {/* Progress */}
              <View style={s.progressBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Compass size={18} color={C.teal400} />
                  <Text style={s.progressText}>
                    Step {currentStepIdx + 1} of 5: {activeStep.sensoryLabel}
                  </Text>
                </View>
                <Text style={s.progressCount}>
                  {groundedItems.length} / {activeStep.expectedCount}
                </Text>
              </View>

              {/* Prompt */}
              <View style={{ gap: 4, marginVertical: 8 }}>
                <Text style={s.label}>PROMPT</Text>
                <Text style={s.promptText}>{activeStep.prompt}</Text>
              </View>

              {/* Tags */}
              <ScrollView
                style={s.tagsBox}
                contentContainerStyle={{ flexWrap: 'wrap', flexDirection: 'row', gap: 6 }}
                keyboardShouldPersistTaps="handled"
              >
                {groundedItems.length === 0 ? (
                  <Text style={s.tagPlaceholder}>Type something you observe below and tap add...</Text>
                ) : (
                  groundedItems.map((item, i) => (
                    <View key={i} style={s.tag}>
                      <Text style={s.tagText}>{item}</Text>
                      <TouchableOpacity onPress={() => handleRemoveGroundedItem(i)}>
                        <X size={14} color={C.zinc500} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>

              {/* Input */}
              <View style={s.inputRow}>
                <TextInput
                  value={currentItemText}
                  onChangeText={setCurrentItemText}
                  onSubmitEditing={handleAddGroundedItem}
                  placeholder="Type item here..."
                  placeholderTextColor={C.zinc600}
                  style={s.textInput}
                />
                <TouchableOpacity onPress={handleAddGroundedItem} style={s.addBtn}>
                  <Plus size={20} color={C.zinc950} />
                </TouchableOpacity>
              </View>

              {/* Next / Finish */}
              <TouchableOpacity
                onPress={handleNextGroundingStep}
                disabled={groundedItems.length < activeStep.expectedCount}
                style={[
                  s.stepBtn,
                  groundedItems.length >= activeStep.expectedCount ? s.stepBtnActive : s.stepBtnDisabled,
                ]}
              >
                <Text
                  style={[
                    s.stepBtnText,
                    groundedItems.length >= activeStep.expectedCount
                      ? s.stepBtnTextActive
                      : s.stepBtnTextDisabled,
                  ]}
                >
                  {currentStepIdx === GROUNDING_STEPS.length - 1 ? 'Finish Exercise' : 'Next Step'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ░░ GROUNDING — FINAL DISTRESS ░░ */}
          {screen === 'grounding_final_distress' && (
            <View style={{ gap: 24, paddingVertical: 24 }}>
              <View style={{ gap: 8 }}>
                <Text style={s.label}>FINAL ASSESSMENT</Text>
                <Text style={s.sectionHeading}>How do you feel now?</Text>
                <Text style={s.sectionDesc}>
                  Rate your current anxiety or discomfort after the exercise from 1 (fully calm) to 10.
                </Text>
              </View>
              <View style={s.numberRow}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setDistressAfter(n)}
                    style={[s.numberCircle, distressAfter === n && s.numberCircleActive]}
                  >
                    <Text style={[s.numberText, distressAfter === n && s.numberTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={handleSubmitGrounding} style={s.primaryBtn}>
                <Text style={s.primaryBtnText}>Submit to Anxie AI</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ░░ FEEDBACK ░░ */}
          {screen === 'feedback' && (
            <View style={{ gap: 24, paddingVertical: 24, alignItems: 'center' }}>
              {isLoadingFeedback ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 16 }}>
                  <ActivityIndicator size="large" color={C.teal500} />
                  <Text style={s.loadingLabel}>Listening to you...</Text>
                  <Text style={s.loadingDesc}>
                    Anxie AI is reading your grounding notes and preparing validation.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 24, width: '100%' }}>
                  {/* AI banner */}
                  <View style={s.aiBanner}>
                    <Sparkles size={20} color={C.teal400} />
                    <View style={{ flexShrink: 1 }}>
                      <Text style={s.aiBannerLabel}>ANXIE AI RESPONSE</Text>
                      <Text style={s.aiBannerDesc}>
                        Personalized comforting validation based on your exercise.
                      </Text>
                    </View>
                  </View>

                  {isFallbackFeedback && (
                    <View style={s.fallbackBanner}>
                      <Text style={s.fallbackText}>
                        ⚠️ Could not connect to the local Anxie AI server. Showing comforting offline fallback. Make sure the backend server is running.
                      </Text>
                    </View>
                  )}

                  {/* Message */}
                  <ScrollView style={s.messageBox}>
                    <Text style={s.messageText}>"{aiFeedback?.message}"</Text>
                  </ScrollView>

                  {/* Suggestion */}
                  <View style={s.suggestionBox}>
                    <Text style={s.suggestionLabel}>RECOMMENDED NEXT STEP</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Wind size={18} color={C.emerald400} />
                      <Text style={s.suggestionText}>
                        {aiFeedback?.suggestedAction === 'do breathing'
                          ? 'Slow Box Breathing'
                          : aiFeedback?.suggestedAction === 'journal'
                            ? 'Journal coping thoughts'
                            : 'Close eyes and rest'}
                      </Text>
                    </View>
                  </View>

                  {/* Reset */}
                  <TouchableOpacity onPress={resetAll} style={s.resetBtn}>
                    <RotateCcw size={16} color={C.zinc400} />
                    <Text style={s.resetBtnText}>Back to Tools</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ░░ HISTORY & PROGRESS DASHBOARD ░░ */}
          {screen === 'history' && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 20, paddingVertical: 12, paddingBottom: 24 }}
            >
              {/* Summary Metrics */}
              <View style={s.metricsRow}>
                <View style={s.metricCard}>
                  <Text style={s.metricLabel}>EXERCISES</Text>
                  <Text style={s.metricValue}>{totalSessions}</Text>
                  <Text style={s.metricSub}>Completed</Text>
                </View>

                <View style={s.metricCard}>
                  <Text style={s.metricLabel}>AVG DROP</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TrendingDown size={18} color={C.emerald400} />
                    <Text style={[s.metricValue, { color: C.emerald400 }]}>
                      {Number(avgReduction) > 0 ? `-${avgReduction}` : avgReduction}
                    </Text>
                  </View>
                  <Text style={s.metricSub}>Points reduced</Text>
                </View>

                <View style={s.metricCard}>
                  <Text style={s.metricLabel}>RELIEF RATE</Text>
                  <Text style={[s.metricValue, { color: C.teal400 }]}>{reliefRate}%</Text>
                  <Text style={s.metricSub}>Felt calmer</Text>
                </View>
              </View>

              {/* Visual Comparison Chart */}
              {chartLogs.length > 0 && (
                <View style={s.chartCard}>
                  <View style={s.chartHeader}>
                    <View style={{ gap: 2 }}>
                      <Text style={s.label}>RECENT SESSIONS</Text>
                      <Text style={s.chartTitle}>Distress Shift Over Time</Text>
                    </View>
                    <View style={s.chartLegend}>
                      <View style={s.legendItem}>
                        <View style={[s.legendDot, { backgroundColor: '#f43f5e' }]} />
                        <Text style={s.legendText}>Before</Text>
                      </View>
                      <View style={s.legendItem}>
                        <View style={[s.legendDot, { backgroundColor: C.teal400 }]} />
                        <Text style={s.legendText}>After</Text>
                      </View>
                    </View>
                  </View>

                  {/* Visual Bar Area */}
                  <View style={s.chartPlotArea}>
                    {chartLogs.map((log, idx) => {
                      const beforeHeight = Math.max(14, (log.score_before / 10) * 110);
                      const afterHeight = Math.max(14, (log.score_after / 10) * 110);
                      return (
                        <View key={log.id || idx} style={s.chartColumn}>
                          <View style={s.barsWrapper}>
                            {/* Before Bar */}
                            <View style={s.barContainer}>
                              <Text style={s.barValText}>{log.score_before}</Text>
                              <View
                                style={[
                                  s.barView,
                                  {
                                    height: beforeHeight,
                                    backgroundColor: '#f43f5e',
                                  },
                                ]}
                              />
                            </View>

                            {/* After Bar */}
                            <View style={s.barContainer}>
                              <Text style={[s.barValText, { color: C.teal400 }]}>
                                {log.score_after}
                              </Text>
                              <View
                                style={[
                                  s.barView,
                                  {
                                    height: afterHeight,
                                    backgroundColor: C.teal400,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                          <Text style={s.chartColLabel}>
                            {formatLogDate(log.created_at).split(',')[0]}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Activity Log Feed */}
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.label}>SESSION HISTORY</Text>
                  <Text style={{ fontSize: 11, color: C.zinc500 }}>
                    {distressLogs.length} {distressLogs.length === 1 ? 'entry' : 'entries'}
                  </Text>
                </View>

                {isLoadingLogs ? (
                  <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                    <ActivityIndicator color={C.teal400} />
                    <Text style={{ color: C.zinc500, fontSize: 12, marginTop: 8 }}>
                      Loading history...
                    </Text>
                  </View>
                ) : distressLogs.length === 0 ? (
                  <View style={s.emptyHistoryCard}>
                    <Activity size={32} color={C.zinc600} />
                    <Text style={s.emptyHistoryTitle}>No logs recorded yet</Text>
                    <Text style={s.emptyHistoryDesc}>
                      Complete your first Box Breathing or Sensory Grounding exercise to track your relief progress here.
                    </Text>
                    <TouchableOpacity
                      onPress={() => setScreen('grounding_distress')}
                      style={s.emptyStartBtn}
                    >
                      <Text style={s.emptyStartBtnText}>Start Grounding Exercise</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  distressLogs.map(log => {
                    const pointDiff = log.score_before - log.score_after;
                    return (
                      <View key={log.id} style={s.historyCard}>
                        <View style={s.historyCardLeft}>
                          <View style={s.historyIconBox}>
                            {log.exercise_type === 'breathing' ? (
                              <Wind size={18} color={C.teal400} />
                            ) : (
                              <Compass size={18} color={C.emerald400} />
                            )}
                          </View>
                          <View style={{ gap: 2 }}>
                            <Text style={s.historyTitle}>
                              {log.exercise_type === 'breathing'
                                ? 'Box Breathing'
                                : 'Sensory Grounding'}
                            </Text>
                            <Text style={s.historyDate}>{formatLogDate(log.created_at)}</Text>
                          </View>
                        </View>

                        <View style={s.historyCardRight}>
                          <View style={s.scoreShiftRow}>
                            <Text style={s.scoreShiftBefore}>{log.score_before}</Text>
                            <ArrowRight size={12} color={C.zinc500} />
                            <Text style={s.scoreShiftAfter}>{log.score_after}</Text>
                          </View>
                          <View
                            style={[
                              s.reductionPill,
                              pointDiff > 0
                                ? s.reductionPillPositive
                                : pointDiff === 0
                                ? s.reductionPillNeutral
                                : s.reductionPillNegative,
                            ]}
                          >
                            <Text
                              style={[
                                s.reductionPillText,
                                pointDiff > 0
                                  ? { color: C.emerald400 }
                                  : pointDiff === 0
                                  ? { color: C.zinc400 }
                                  : { color: '#f43f5e' },
                              ]}
                            >
                              {pointDiff > 0
                                ? `-${pointDiff} pts`
                                : pointDiff === 0
                                ? '0 pts'
                                : `+${Math.abs(pointDiff)} pts`}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={s.footerText}>Always safe, secure & anonymous</Text>
        </View>
        </SafeAreaView>

        {/* ── Settings Overlay ── */}
        {isSettingsOpen && (
          <View style={s.settingsOverlay}>
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
              <View style={s.settingsHeader}>
              <View style={s.headerLeft}>
                <View style={s.headerIconBox}>
                  <SettingsIcon size={18} color={C.white} />
                </View>
                <Text style={s.headerTitle}>Settings</Text>
              </View>
              <TouchableOpacity onPress={() => setIsSettingsOpen(false)} style={s.closeBtn}>
                <X size={16} color={C.zinc400} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.settingsBody} showsVerticalScrollIndicator={false}>
              {/* Security settings */}
              <View style={s.settingsSection}>
                <Text style={s.label}>Security & Privacy</Text>
                <View style={s.settingsCard}>
                  <View style={s.settingsRow}>
                    <View style={{ gap: 4 }}>
                      <Text style={s.settingsLabelText}>Biometric Lock</Text>
                      <Text style={s.settingsDescText}>Lock app using FaceID / Fingerprint</Text>
                    </View>
                    <TouchableOpacity
                      onPress={toggleBiometricLock}
                      style={[s.toggleBtn, biometricEnabled ? s.toggleBtnOn : s.toggleBtnOff]}
                    >
                      <View style={[s.toggleKnob, biometricEnabled ? s.toggleKnobOn : s.toggleKnobOff]} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Account settings */}
              <View style={s.settingsSection}>
                <Text style={s.label}>Account & Sync</Text>
                <View style={s.settingsCard}>
                  <Text style={s.settingsInfoText}>
                    Status:{' '}
                    <Text style={{ fontWeight: '700', color: session?.user?.is_anonymous ? C.zinc400 : C.teal400 }}>
                      {session?.user?.is_anonymous ? 'Anonymous Guest' : 'Registered Member'}
                    </Text>
                  </Text>
                  
                  {session?.user?.email && !session.user.is_anonymous ? (
                    <Text style={[s.settingsDescText, { marginTop: 4 }]}>
                      Logged in as: {session.user.email}
                    </Text>
                  ) : (
                    <View style={{ gap: 12, marginTop: 12 }}>
                      {/* Tabs */}
                      <View style={{ flexDirection: 'row', gap: 16, borderBottomWidth: 1, borderBottomColor: C.zinc800, paddingBottom: 6 }}>
                        <TouchableOpacity onPress={() => { setAuthMode('upgrade'); setUpgradeMessage(''); }}>
                          <Text style={{ color: authMode === 'upgrade' ? C.teal400 : C.zinc500, fontSize: 12, fontWeight: '700' }}>
                            UPGRADE GUEST
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setAuthMode('login'); setUpgradeMessage(''); }}>
                          <Text style={{ color: authMode === 'login' ? C.teal400 : C.zinc500, fontSize: 12, fontWeight: '700' }}>
                            SIGN IN
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={s.settingsDescText}>
                        {authMode === 'upgrade'
                          ? 'Upgrade your guest account to permanent email status. Requires email verification.'
                          : 'Sign in with your verified email and password.'}
                      </Text>
                      
                      <TextInput
                        value={emailInput}
                        onChangeText={setEmailInput}
                        placeholder="Email Address"
                        placeholderTextColor={C.zinc600}
                        style={s.settingsInput}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                      <TextInput
                        value={passwordInput}
                        onChangeText={setPasswordInput}
                        placeholder="Password"
                        placeholderTextColor={C.zinc600}
                        style={s.settingsInput}
                        secureTextEntry
                      />
                      {upgradeMessage ? (
                        <Text style={s.settingsMsgText}>{upgradeMessage}</Text>
                      ) : null}
                      
                      <TouchableOpacity
                        disabled={isUpgrading}
                        onPress={authMode === 'upgrade' ? handleUpgradeAccount : handleLogin}
                        style={s.settingsActionBtn}
                      >
                        {isUpgrading ? (
                          <ActivityIndicator size="small" color={C.zinc950} />
                        ) : (
                          <Text style={s.settingsActionBtnText}>
                            {authMode === 'upgrade' ? 'Upgrade Account' : 'Sign In'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {/* Premium Subscriptions */}
              <View style={s.settingsSection}>
                <Text style={s.label}>Anxie Premium</Text>
                <View style={[s.settingsCard, { borderColor: C.teal500_border10, backgroundColor: C.teal500_05 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Shield size={20} color={C.teal400} />
                    <Text style={{ color: C.teal400, fontWeight: '700', fontSize: 15 }}>
                      Unlock Anxie Premium
                    </Text>
                  </View>
                  <Text style={[s.settingsDescText, { color: C.zinc300, marginTop: 8 }]}>
                    Get unlimited AI-guided validations, advanced breathing exercises, and cognitive reframing AI journals.
                  </Text>
                  <TouchableOpacity style={s.premiumBtn}>
                    <Text style={s.premiumBtnText}>View Premium Plans</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      )}
      </BiometricGuard>
    </SafeAreaProvider>
  );
}

// ===========================================================================
// Styles
// ===========================================================================
const s = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: C.zinc950,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  content: { flex: 1, justifyContent: 'center', marginVertical: 16 },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    flexShrink: 0,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBox: {
    height: 32, width: 32, borderRadius: 8,
    backgroundColor: C.teal500,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: C.zinc100, fontWeight: '700', fontSize: 18, letterSpacing: -0.5 },
  closeBtn: {
    padding: 6, borderRadius: 9999,
    backgroundColor: C.zinc900, borderWidth: 1, borderColor: C.zinc800,
  },

  // ── Footer ──────────────────────────────────────────────────────────────
  footer: { paddingVertical: 8, alignItems: 'center', flexShrink: 0 },
  footerText: { fontSize: 10, color: C.zinc600, fontWeight: '500' },

  // ── Shared ──────────────────────────────────────────────────────────────
  label: {
    color: C.zinc400, fontSize: 12, fontWeight: '600',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  sectionHeading: { color: C.zinc100, fontSize: 20, fontWeight: '700' },
  sectionDesc: { color: C.zinc400, fontSize: 12, lineHeight: 20 },

  // ── Idle screen ─────────────────────────────────────────────────────────
  idleWrap: { alignItems: 'center', justifyContent: 'center', gap: 32, paddingVertical: 40 },
  idleTextGroup: { gap: 8, alignItems: 'center' },
  idleHeading: { color: C.zinc100, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  idleSubtext: { color: C.zinc400, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },

  calmBtnOuter: {
    height: 192, width: 192, borderRadius: 9999,
    backgroundColor: C.teal500,
    alignItems: 'center', justifyContent: 'center', padding: 4,
  },
  calmBtnInner: {
    height: '100%' as any, width: '100%' as any, borderRadius: 9999,
    backgroundColor: C.zinc950, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  calmBtnTitle: { color: C.zinc100, fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  calmBtnSub: { color: C.teal400, fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },

  secondaryBtn: {
    width: '100%', paddingVertical: 16, paddingHorizontal: 20,
    borderRadius: 16, backgroundColor: C.zinc900,
    borderWidth: 1, borderColor: C.zinc800,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  secondaryBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  secondaryTitle: { color: C.zinc100, fontWeight: '600', fontSize: 14 },
  secondaryDesc: { color: C.zinc500, fontSize: 12, marginTop: 2 },

  // ── Breathing screen ────────────────────────────────────────────────────
  breathWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 32 },
  breathPhaseLabel: { color: C.teal400, fontSize: 12, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  breathSubLabel: { color: C.zinc400, fontSize: 12 },

  breathCircleContainer: {
    height: 224, width: 224, alignItems: 'center', justifyContent: 'center',
  },
  breathRing: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 9999, borderWidth: 1,
  },
  breathCircle: {
    height: 128, width: 128, borderRadius: 9999,
    borderWidth: 2, borderColor: C.teal500,
    backgroundColor: C.teal500_10,
    alignItems: 'center', justifyContent: 'center',
  },
  breathInstruction: { color: C.zinc100, fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 24 },
  breathTimer: { color: C.teal400, fontWeight: '700', fontSize: 18, marginTop: 12 },
  breathToggle: {
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 9999, backgroundColor: C.zinc900,
    borderWidth: 1, borderColor: C.zinc800,
  },
  breathToggleText: { color: C.zinc300, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },

  // ── Distress picker ─────────────────────────────────────────────────────
  numberRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginVertical: 16,
  },
  numberCircle: {
    height: 30, width: 30, borderRadius: 9999,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, backgroundColor: C.zinc900, borderColor: C.zinc800,
  },
  numberCircleActive: { backgroundColor: C.emerald500, borderColor: C.emerald400 },
  numberText: { fontWeight: '700', fontSize: 12, color: C.zinc400 },
  numberTextActive: { color: C.zinc950 },

  primaryBtn: {
    width: '100%', paddingVertical: 16, borderRadius: 16,
    backgroundColor: C.emerald500, alignItems: 'center',
  },
  primaryBtnText: { color: C.zinc950, fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },

  // ── Grounding steps ─────────────────────────────────────────────────────
  progressBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(24,24,27,0.5)', padding: 14,
    borderWidth: 1, borderColor: C.zinc900, borderRadius: 12,
  },
  progressText: { color: C.zinc300, fontWeight: '600', fontSize: 12 },
  progressCount: { color: C.zinc500, fontSize: 12, fontWeight: '700' },

  promptText: { color: C.zinc100, fontSize: 18, fontWeight: '700', lineHeight: 24 },

  tagsBox: {
    height: 112, borderWidth: 1, borderStyle: 'dashed',
    borderColor: C.zinc800, borderRadius: 12, padding: 12,
    backgroundColor: 'rgba(24,24,27,0.1)',
  },
  tagPlaceholder: { color: C.zinc600, fontSize: 12, padding: 4, fontStyle: 'italic' },
  tag: {
    backgroundColor: C.zinc900, borderWidth: 1, borderColor: C.zinc800,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1,
  },
  tagText: { color: C.zinc300, fontSize: 12 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  textInput: {
    flex: 1, backgroundColor: C.zinc900, borderWidth: 1, borderColor: C.zinc800,
    color: C.zinc100, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14,
  },
  addBtn: {
    height: 48, width: 48, borderRadius: 12,
    backgroundColor: C.teal500, alignItems: 'center', justifyContent: 'center',
  },

  stepBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  stepBtnActive: { backgroundColor: C.emerald500 },
  stepBtnDisabled: { backgroundColor: C.zinc900, borderWidth: 1, borderColor: C.zinc800 },
  stepBtnText: { fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  stepBtnTextActive: { color: C.zinc950 },
  stepBtnTextDisabled: { color: C.zinc600 },

  // ── Feedback ────────────────────────────────────────────────────────────
  loadingLabel: { color: C.zinc400, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  loadingDesc: { color: C.zinc500, fontSize: 12, textAlign: 'center', paddingHorizontal: 40 },

  aiBanner: {
    alignItems: 'center', flexDirection: 'row', gap: 12,
    backgroundColor: C.teal500_05, borderWidth: 1, borderColor: C.teal500_border10,
    padding: 16, borderRadius: 16,
  },
  aiBannerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: C.teal400, textTransform: 'uppercase' },
  aiBannerDesc: { color: C.zinc200, fontSize: 12, marginTop: 2, lineHeight: 20 },

  fallbackBanner: {
    backgroundColor: C.amber500_10, borderWidth: 1, borderColor: C.amber500_20,
    padding: 14, borderRadius: 16,
  },
  fallbackText: { color: C.amber400, fontSize: 11, fontWeight: '500', lineHeight: 20 },

  messageBox: {
    maxHeight: 224, backgroundColor: 'rgba(24,24,27,0.3)',
    borderWidth: 1, borderColor: C.zinc900, padding: 16, borderRadius: 16,
  },
  messageText: { color: C.zinc100, fontSize: 14, lineHeight: 24, fontStyle: 'italic', fontWeight: '500' },

  suggestionBox: {
    backgroundColor: C.zinc900, borderWidth: 1, borderColor: C.zinc800,
    borderRadius: 16, padding: 16, gap: 8,
  },
  suggestionLabel: { fontSize: 10, fontWeight: '700', color: C.zinc500, letterSpacing: 2, textTransform: 'uppercase' },
  suggestionText: { color: C.zinc100, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

  resetBtn: {
    width: '100%', paddingVertical: 16, borderRadius: 16,
    backgroundColor: C.zinc900, borderWidth: 1, borderColor: C.zinc800,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  resetBtnText: { color: C.zinc300, fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },

  // ── Settings Styles ──────────────────────────────────────────────────────
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.zinc950,
    paddingHorizontal: 24,
    paddingVertical: 16,
    zIndex: 50,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.zinc900,
    marginBottom: 16,
  },
  settingsBody: {
    gap: 24,
    paddingBottom: 40,
  },
  settingsSection: {
    gap: 8,
  },
  settingsCard: {
    backgroundColor: C.zinc900,
    borderWidth: 1,
    borderColor: C.zinc800,
    borderRadius: 16,
    padding: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsLabelText: {
    color: C.zinc100,
    fontSize: 14,
    fontWeight: '600',
  },
  settingsDescText: {
    color: C.zinc500,
    fontSize: 12,
    lineHeight: 18,
  },
  settingsInfoText: {
    color: C.zinc300,
    fontSize: 13,
  },
  settingsInput: {
    backgroundColor: C.zinc950,
    borderWidth: 1,
    borderColor: C.zinc800,
    color: C.zinc100,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  settingsMsgText: {
    color: C.teal400,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  settingsActionBtn: {
    backgroundColor: C.teal400,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  settingsActionBtnText: {
    color: C.zinc950,
    fontWeight: '700',
    fontSize: 13,
  },
  toggleBtn: {
    width: 48,
    height: 26,
    borderRadius: 9999,
    padding: 2,
  },
  toggleBtnOn: {
    backgroundColor: C.teal500,
  },
  toggleBtnOff: {
    backgroundColor: C.zinc800,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 9999,
    backgroundColor: C.zinc950,
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  toggleKnobOff: {
    alignSelf: 'flex-start',
  },
  premiumBtn: {
    backgroundColor: C.teal500,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  premiumBtnText: {
    color: C.zinc950,
    fontWeight: '700',
    fontSize: 13,
  },

  // ── History Dashboard Styles ─────────────────────────────────────────────
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  metricCard: {
    flex: 1,
    backgroundColor: C.zinc900,
    borderWidth: 1,
    borderColor: C.zinc800,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: C.zinc500,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: C.zinc100,
  },
  metricSub: {
    fontSize: 10,
    color: C.zinc500,
  },
  chartCard: {
    backgroundColor: C.zinc900,
    borderWidth: 1,
    borderColor: C.zinc800,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.zinc100,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: C.zinc400,
    fontWeight: '500',
  },
  chartPlotArea: {
    height: 140,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.zinc800,
  },
  chartColumn: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  barsWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  barContainer: {
    alignItems: 'center',
    gap: 2,
  },
  barValText: {
    fontSize: 8,
    fontWeight: '700',
    color: C.zinc500,
  },
  barView: {
    width: 10,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  chartColLabel: {
    fontSize: 9,
    color: C.zinc500,
    fontWeight: '600',
  },
  emptyHistoryCard: {
    backgroundColor: C.zinc900,
    borderWidth: 1,
    borderColor: C.zinc800,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  emptyHistoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.zinc200,
  },
  emptyHistoryDesc: {
    fontSize: 12,
    color: C.zinc500,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyStartBtn: {
    marginTop: 8,
    backgroundColor: C.emerald500,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyStartBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.zinc950,
  },
  historyCard: {
    backgroundColor: C.zinc900,
    borderWidth: 1,
    borderColor: C.zinc800,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  historyIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.zinc950,
    borderWidth: 1,
    borderColor: C.zinc800,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.zinc100,
  },
  historyDate: {
    fontSize: 11,
    color: C.zinc500,
  },
  historyCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  scoreShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreShiftBefore: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f43f5e',
  },
  scoreShiftAfter: {
    fontSize: 13,
    fontWeight: '700',
    color: C.teal400,
  },
  reductionPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  reductionPillPositive: {
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  reductionPillNeutral: {
    backgroundColor: 'rgba(113,113,122,0.1)',
  },
  reductionPillNegative: {
    backgroundColor: 'rgba(244,63,94,0.1)',
  },
  reductionPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
