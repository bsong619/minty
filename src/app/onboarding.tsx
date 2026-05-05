import { useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { markOnboardingSeen } from "@/lib/storage";
import { C, SHADOW } from "@/lib/theme";

const STEPS = [
  {
    icon: "sf:camera.fill",
    title: "Snap Your Card",
    description:
      "Place your card on a dark surface. Use the camera to snap it or pick one from your collection.",
    tips: [
      "Avoid glare and shadows",
      "Keep the card flat and centered",
      "Use natural daylight when possible",
    ],
  },
  {
    icon: "sf:wand.and.stars",
    title: "AI Analysis",
    description:
      "Our AI estimates your card across the four grading criteria professionals use — centering, corners, edges, and surface condition.",
    tips: [
      "Higher-quality photos give more detailed analysis",
      "Fill the entire frame with the card",
      "Hold the camera steady",
    ],
  },
  {
    icon: "sf:chart.bar.fill",
    title: "Get Your Estimate",
    description:
      "See an AI-estimated grade with a full breakdown — centering, corners, edges, surface — plus tips to level up. Estimates only — not an official grade.",
    tips: [
      "5 free grades a day — Pro unlocks unlimited",
      "Save your best pulls to favorites",
      "Use tips to decide which cards are worth grading",
    ],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [currentStep, setCurrentStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentStep(page);
  };

  const handleNext = async () => {
    if (currentStep < STEPS.length - 1) {
      scrollRef.current?.scrollTo({
        x: (currentStep + 1) * width,
        animated: true,
      });
    } else {
      await markOnboardingSeen();
      router.back();
    }
  };

  const handleSkip = async () => {
    await markOnboardingSeen();
    router.back();
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.bg,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          padding: 16,
          paddingTop: 60,
        }}
      >
        <Pressable onPress={handleSkip}>
          <Text
            style={{
              fontSize: 16,
              color: C.textTertiary,
              fontWeight: "500",
            }}
          >
            Skip
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {STEPS.map((step, index) => (
          <View
            key={index}
            style={{
              width,
              paddingHorizontal: 32,
              justifyContent: "center",
              alignItems: "center",
              gap: 24,
            }}
          >
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: C.goldFaint,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Image
                source={step.icon}
                style={{ width: 44, height: 44, tintColor: "#3DD68C" as any }}
              />
            </View>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: C.text,
                textAlign: "center",
              }}
            >
              {step.title}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: C.textSecondary,
                textAlign: "center",
                lineHeight: 24,
              }}
            >
              {step.description}
            </Text>
            <View style={{ gap: 12, width: "100%" }}>
              {step.tips.map((tip, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    borderRadius: 14,
                    borderCurve: "continuous",
                    backgroundColor: C.surface,
                  }}
                >
                  <Image
                    source="sf:checkmark.circle.fill"
                    style={{
                      width: 20,
                      height: 20,
                      tintColor: C.gold,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 15,
                      color: C.text,
                      flex: 1,
                    }}
                  >
                    {tip}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          padding: 24,
          paddingBottom: 48,
          gap: 16,
          alignItems: "center",
        }}
      >
        {/* Dots */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === currentStep ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  i === currentStep ? C.gold : C.border,
              }}
            />
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => ({
            backgroundColor: C.mint,
            paddingVertical: 16,
            paddingHorizontal: 48,
            borderRadius: 16,
            borderCurve: "continuous",
            width: "100%",
            alignItems: "center",
            opacity: pressed ? 0.85 : 1,
            boxShadow: SHADOW.glow,
          } as any)}
        >
          <Text style={{ fontSize: 17, fontWeight: "700", color: C.onMint }}>
            {currentStep === STEPS.length - 1 ? "Get Started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
