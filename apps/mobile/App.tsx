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
  StatusBar,
  NativeModules,
  StyleSheet,
} from 'react-native';
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
} from 'lucide-react-native';
import {
  BOX_BREATHING_PHASES,
  GROUNDING_STEPS,
  GroundingLogEntry,
  GroundingFeedbackResponse,
} from '@anxie/shared';

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
  | 'feedback';

// ===========================================================================
// App
// ===========================================================================
export default function App() {
  const [screen, setScreen] = useState<ScreenState>('idle');

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

  // =======================================================================
  // JSX
  // =======================================================================
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.zinc950} />
      <SafeAreaView style={s.safeArea}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIconBox}>
              <Heart size={18} color={C.white} />
            </View>
            <Text style={s.headerTitle}>Anxie AI</Text>
          </View>
          {screen !== 'idle' && (
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
        </KeyboardAvoidingView>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={s.footerText}>Always safe, secure & anonymous</Text>
        </View>
      </SafeAreaView>
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
});
